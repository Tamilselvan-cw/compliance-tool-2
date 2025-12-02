from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from app.db.session import get_conn


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    v = s.strip()
    return v or None


def _competency_get_or_create(
    org_id: UUID,
    name: str,
    category: str,
    description: Optional[str],
    actor_user_id: Optional[UUID],
) -> str:
    """Returns competency_id (uuid::text)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            # find existing
            cur.execute(
                """
                select id::text
                from public.competencys
                where organization_id=%s
                  and is_active=true
                  and lower(name)=lower(%s)
                  and category=%s
                limit 1
                """,
                (str(org_id), name, category),
            )
            row = cur.fetchone()
            if row:
                return row[0]

            # create new competency
            cur.execute(
                """
                insert into public.competencys
                  (organization_id, name, category, description, is_active, created_by, updated_by)
                values (%s, %s, %s, %s, true, %s, %s)
                returning id::text
                """,
                (
                    str(org_id),
                    name,
                    category,
                    _clean(description),
                    str(actor_user_id) if actor_user_id else None,
                    str(actor_user_id) if actor_user_id else None,
                ),
            )
            return cur.fetchone()[0]


def _row_to_expectation(row):
    # row indexes based on the SELECT above
    (
      rse_id, rse_role_id, rse_competency_id, expected_level, created_at, updated_at,
      c_id, c_name, c_category, c_description, c_competency_code
    ) = row

    return {
        "id": rse_id,
        "role_id": rse_role_id,
        "competency_id": rse_competency_id,
        "expected_level": expected_level,
        "created_at": created_at,
        "updated_at": updated_at,
        "competency": {
            "id": c_id,
            "name": c_name,
            "category": c_category,
            "description": c_description,
            "competency_code": c_competency_code,
        },
    }

def list_role_competencys(
    org_id: UUID, role_id: UUID, page: int = 1, limit: int = 500
) -> Tuple[List[Dict[str, Any]], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")
    offset = (page - 1) * limit

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select count(*)
                from public.role_competency_expectations rse
                where rse.organization_id=%s
                  and rse.role_id=%s
                  and rse.deleted_at is null
                """,
                (str(org_id), str(role_id)),
            )
            total = cur.fetchone()[0]

            cur.execute(
                """
                select
                  rse.id::text,
                  rse.role_id::text,
                  rse.competency_id::text,
                  rse.expected_level,
                  rse.created_at,
                  rse.updated_at,
                  s.id::text as s_id,
                  s.name as s_name,
                  s.category as s_category,
                  s.description as s_description,
                  s.competency_code as s_competency_code
                from public.role_competency_expectations rse
                left join public.competencys s on s.id=rse.competency_id
                where rse.organization_id=%s
                  and rse.role_id=%s
                  and rse.deleted_at is null
                order by rse.updated_at desc
                offset %s limit %s
                """,
                (str(org_id), str(role_id), offset, limit),
            )
            rows = cur.fetchall()

    return [_row_to_expectation(r) for r in rows], total

def add_role_competency(
    org_id: UUID,
    role_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    name = _clean(payload.get("competency_name"))
    category = _clean(payload.get("category"))
    description = _clean(payload.get("description"))
    expected_level = int(payload.get("expected_level") or 0)

    if not name or not category:
        raise ValueError("competency_name and category are required")

    competency_id = _competency_get_or_create(
        org_id, name, category, description, actor_user_id
    )

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.role_competency_expectations
                  (organization_id, role_id, competency_id, expected_level, created_by, updated_by)
                values (%s, %s, %s, %s, %s, %s)
                returning id::text, role_id::text, competency_id::text, expected_level, created_at, updated_at
                """,
                (
                    str(org_id),
                    str(role_id),
                    competency_id,
                    expected_level,
                    str(actor_user_id) if actor_user_id else None,
                    str(actor_user_id) if actor_user_id else None,
                ),
            )
            row = cur.fetchone()

            # join competency
            cur.execute(
                """
                select
                  %s::text as id,
                  %s::text as role_id,
                  %s::text as competency_id,
                  %s::int as expected_level,
                  %s::timestamptz as created_at,
                  %s::timestamptz as updated_at,
                  s.id::text as s_id,
                  s.name,
                  s.category,
                  s.description
                from public.competencys s
                where s.id = %s::uuid
                """,
                (row[0], row[1], row[2], row[3], row[4], row[5], row[2]),
            )
            joined = cur.fetchone()

    return _row_to_expectation(joined)


def bulk_upsert_role_competencies(
    org_id: UUID,
    role_id: UUID,
    items: List[Dict[str, Any]],
    actor_user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    org_id_str = str(org_id)
    role_id_str = str(role_id)
    actor_str = str(actor_user_id) if actor_user_id else None

    # 1) Clean + validate items (allow competency_id + competency_code)
    cleaned_items: List[Dict[str, Any]] = []
    for raw in items or []:
        name = (raw.get("competency_name") or raw.get("name") or "").strip()
        competency_id = raw.get("competency_id") or None
        if competency_id is not None:
            competency_id = str(competency_id).strip() or None

        competency_code = (raw.get("competency_code") or None)
        if competency_code is not None:
            competency_code = str(competency_code).strip() or None

        # If there's neither a name nor any identifier, skip
        if not name and not competency_code and not competency_id:
            continue

        category = raw.get("category")
        expected_level = raw.get("expected_level")
        desc = (raw.get("description") or "").strip() or None

        if category not in ("technical", "functional", "behavioral"):
            raise ValueError(f"Invalid category: {category} for competency '{name or competency_code or competency_id}'")
        if expected_level is None:
            raise ValueError(f"expected_level is required for competency '{name or competency_code or competency_id}'")

        cleaned_items.append(
            {
                "name": name or None,
                "category": category,
                "expected_level": int(expected_level),
                "description": desc,
                "competency_code": competency_code,
                "competency_id": competency_id,
            }
        )

    # 2) Deduplicate: prefer last occurrence in payload
    unique_map: Dict[tuple[str | None, str, str | None, str | None], Dict[str, Any]] = {}
    for item in cleaned_items:
        key = (
            item["name"].lower().strip() if item["name"] else None,
            item["category"],
            item["competency_code"],
            item["competency_id"],
        )
        unique_map[key] = item
    unique_items = list(unique_map.values())

    with get_conn() as conn:
        with conn.cursor() as cur:
            # load existing role expectations
            cur.execute(
                """
                SELECT id::text, competency_id::text, expected_level, is_active
                FROM public.role_competency_expectations
                WHERE role_id = %s
                """,
                (role_id_str,),
            )
            existing_rse_rows = cur.fetchall()  # [(rse_id, competency_id, expected_level, is_active), ...]
            existing_rse_by_comp: Dict[str, tuple[str, bool]] = {
                row[1]: (row[0], bool(row[3])) for row in existing_rse_rows
            }
            existing_comp_ids = {row[1] for row in existing_rse_rows}

            # load existing competencies for this org into lookup maps
            cur.execute(
                """
                SELECT id::text, lower(name) AS lname, category, description, competency_code
                FROM public.competencys
                WHERE organization_id = %s
                """,
                (org_id_str,),
            )
            comps = cur.fetchall()  # [(id, lname, category, description, competency_code), ...]
            comp_map_by_id: Dict[str, str] = {row[0]: row[0] for row in comps}
            comp_map_by_namecat: Dict[str, str] = {
                f"{row[1].strip()}::{row[2]}": row[0] for row in comps
            }
            comp_map_by_code: Dict[str, str] = {
                row[4]: row[0] for row in comps if row[4]
            }

            def get_or_create_competency_id(
                name: str | None,
                category: str,
                desc: str | None,
                code: str | None,
                cid: str | None,
            ) -> str:
                # 1) If competency_id provided and exists, use it (and update)
                if cid:
                    if cid in comp_map_by_id:
                        # update canonical competency with provided values (if any)
                        cur.execute(
                            """
                            UPDATE public.competencys
                            SET name = %s,
                                description = %s,
                                updated_by = %s,
                                updated_at = now()
                            WHERE id = %s
                            """,
                            (name or "", desc, actor_str, cid),
                        )
                        return cid
                    # if provided cid not found, continue to try other matches or create new

                # 2) Prefer lookup by code if provided & exists
                if code:
                    if code in comp_map_by_code:
                        comp_row_id = comp_map_by_code[code]
                        cur.execute(
                            """
                            UPDATE public.competencys
                            SET name = %s,
                                description = %s,
                                updated_by = %s,
                                updated_at = now()
                            WHERE id = %s
                            """,
                            (name or "", desc, actor_str, comp_row_id),
                        )
                        return comp_row_id

                # 3) fallback: if we have a name, try name+category
                if name:
                    key = f"{name.lower().strip()}::{category}"
                    if key in comp_map_by_namecat:
                        existing_id = comp_map_by_namecat[key]
                        # update canonical competency's name/description (propagate edits)
                        cur.execute(
                            """
                            UPDATE public.competencys
                            SET name = %s,
                                description = %s,
                                updated_by = %s,
                                updated_at = now()
                            WHERE id = %s
                            """,
                            (name, desc, actor_str, existing_id),
                        )
                        return existing_id

                # 4) create new competency if nothing matched
                cur.execute(
                    """
                    INSERT INTO public.competencys
                      (organization_id, name, category, description, is_active, created_by, updated_by)
                    VALUES (%s, %s, %s, %s, true, %s, %s)
                    RETURNING id::text
                    """,
                    (org_id_str, (name or ""), category, desc, actor_str, actor_str),
                )
                new_id = cur.fetchone()[0]

                # refresh maps
                if name:
                    comp_map_by_namecat[f"{name.lower().strip()}::{category}"] = new_id
                if code:
                    comp_map_by_code[code] = new_id
                comp_map_by_id[new_id] = new_id
                return new_id

            # process incoming unique_items
            kept_competency_ids = set()
            touched_rse_ids = set()

            for item in unique_items:
                name = (item.get("name") or "").strip() or None
                category = item["category"]
                expected_level = item["expected_level"]
                desc = item.get("description")
                code = item.get("competency_code")
                cid = item.get("competency_id")

                competency_id = get_or_create_competency_id(name, category, desc, code, cid)
                kept_competency_ids.add(competency_id)

                # If incoming item has a competency_code and maps to an existing competency row,
                # update the competency row's name/description (redundant if already updated above, but safe)
                if code and code in comp_map_by_code:
                    comp_row_id = comp_map_by_code[code]
                    cur.execute(
                        """
                        UPDATE public.competencys
                        SET name = %s,
                            description = %s,
                            updated_by = %s,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (name or "", desc, actor_str, comp_row_id),
                    )

                # upsert expectation
                if competency_id in existing_rse_by_comp:
                    rse_id, was_active = existing_rse_by_comp[competency_id]
                    cur.execute(
                        """
                        UPDATE public.role_competency_expectations
                        SET expected_level = %s,
                            is_active = true,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (expected_level, rse_id),
                    )
                    touched_rse_ids.add(rse_id)
                else:
                    cur.execute(
                        """
                        INSERT INTO public.role_competency_expectations
                          (organization_id, role_id, competency_id, expected_level, is_active)
                        VALUES (%s, %s, %s, %s, true)
                        RETURNING id::text
                        """,
                        (org_id_str, role_id_str, competency_id, expected_level),
                    )
                    new_rse_id = cur.fetchone()[0]
                    touched_rse_ids.add(new_rse_id)
                    existing_rse_by_comp[competency_id] = (new_rse_id, True)

            # compute comp ids to remove = existing active comp ids - kept_competency_ids
            comp_ids_to_remove = [
                cid for cid in existing_comp_ids if cid not in kept_competency_ids
                and existing_rse_by_comp.get(cid, (None, False))[1]
            ]

            if comp_ids_to_remove:
                cur.execute(
                    """
                    UPDATE public.role_competency_expectations
                    SET is_active = false,
                        deleted_at = now(),
                        updated_at = now()
                    WHERE role_id = %s
                    AND competency_id = ANY(%s::uuid[])
                    """,
                    (role_id_str, comp_ids_to_remove),
                )

            # --- re-fetch final active list ---
            cur.execute(
                """
                SELECT
                  rse.id::text,
                  rse.role_id::text,
                  rse.competency_id::text,
                  rse.expected_level,
                  rse.created_at,
                  rse.updated_at,
                  c.id::text,
                  c.name,
                  c.category,
                  c.description,
                  c.competency_code
                FROM public.role_competency_expectations rse
                JOIN public.competencys c ON c.id = rse.competency_id
                WHERE rse.role_id = %s
                  AND rse.is_active = true
                ORDER BY c.category, c.name
                """,
                (role_id_str,),
            )
            rows = cur.fetchall()

    out = [_row_to_expectation(r) for r in rows]
    return {"items": out, "total": len(out)}


def delete_role_competency(org_id: UUID, role_id: UUID, expectation_id: UUID, soft: bool = True):
    with get_conn() as conn:
        with conn.cursor() as cur:
            if soft:
                cur.execute(
                    """
                    update public.role_competency_expectations
                    set deleted_at = now(),
                        is_active = false,
                        updated_at = now()
                    where id = %s
                      and organization_id = %s
                      and role_id = %s
                    returning id
                    """,
                    (str(expectation_id), str(org_id), str(role_id)),
                )
            else:
                cur.execute(
                    """
                    delete from public.role_competency_expectations
                    where id = %s
                      and organization_id = %s
                      and role_id = %s
                    returning id
                    """,
                    (str(expectation_id), str(org_id), str(role_id)),
                )

            r = cur.fetchone()

    if not r:
        raise ValueError("Role competency not found or already deleted")
