# app/modules/org_competencys/service.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Optional
from uuid import UUID

from app.db.session import get_conn
from app.modules.competencys.schemas import SkillCategory


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    v = s.strip()
    return v or None


def _row_to_org(row) -> Dict[str, Any]:
    cols = [
        "id",
        "organization_id",
        "competency_id",
        "required_level",
        "weight",
        "is_active",
        "created_at",
        "updated_at",
        "s_id",
        "s_name",
        "s_category",
        "s_description",
    ]
    d = dict(zip(cols, row))

    out: Dict[str, Any] = {
        "id": d["id"],
        "organization_id": d["organization_id"],
        "competency_id": d["competency_id"],
        "required_level": d["required_level"],
        "weight": float(d["weight"]) if d["weight"] is not None else None,
        "is_active": d["is_active"],
        "created_at": d["created_at"],
        "updated_at": d["updated_at"],
    }

    if d["s_id"]:
        out["competency"] = {
            "id": d["s_id"],
            "name": d["s_name"],
            "category": d["s_category"],
            "description": d["s_description"],
        }
    else:
        out["competency"] = None

    return out


def create_org_competency_for_org(
    org_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    """
    Create mapping: organization <-> ORGANIZATION-level competency.

    Enforces:
      - competency.category == ORGANIZATION
      - competency.organization_id == org_id
    """
    competency_id = payload.get("competency_id")
    if not competency_id:
        raise ValueError("competency_id is required")

    required_level = payload.get("required_level")
    weight = payload.get("weight")
    is_active = payload.get("is_active", True)

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Validate competency exists, category ORGANIZATION, and belongs to same org
            cur.execute(
                """
                select id::text, category, organization_id::text
                from public.competencys
                where id = %s
                """,
                (str(competency_id),),
            )
            comp = cur.fetchone()
            if not comp:
                raise ValueError("Competency not found")

            comp_id, comp_category, comp_org_id = comp

            if comp_category != SkillCategory.ORGANIZATION.value:
                raise ValueError(
                    "Only ORGANIZATION category competencies can be attached as org_competencys"
                )

            if comp_org_id is not None and comp_org_id != str(org_id):
                raise ValueError("Competency belongs to a different organization")

            # Insert mapping
            cur.execute(
                """
                insert into public.org_competencys
                  (organization_id, competency_id, required_level, weight, is_active, created_by, updated_by)
                values (%s, %s, %s, %s, %s, %s, %s)
                returning id::text, organization_id::text, competency_id::text,
                          required_level, weight, is_active, created_at, updated_at
                """,
                (
                    str(org_id),
                    comp_id,
                    required_level,
                    weight,
                    bool(is_active),
                    str(actor_user_id) if actor_user_id else None,
                    str(actor_user_id) if actor_user_id else None,
                ),
            )
            base = cur.fetchone()

            # Join competency for output
            cur.execute(
                """
                select
                  %s::text as id,
                  %s::text as organization_id,
                  %s::text as competency_id,
                  %s::int as required_level,
                  %s::numeric as weight,
                  %s::boolean as is_active,
                  %s::timestamptz as created_at,
                  %s::timestamptz as updated_at,
                  s.id::text as s_id,
                  s.name as s_name,
                  s.category as s_category,
                  s.description as s_description
                from public.competencys s
                where s.id = %s::uuid
                """,
                (
                    base[0],
                    base[1],
                    base[2],
                    base[3],
                    base[4],
                    base[5],
                    base[6],
                    base[7],
                    base[2],
                ),
            )
            joined = cur.fetchone()

    return _row_to_org(joined)


def list_org_competencys(
    org_id: UUID,
    page: int,
    limit: int,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    List org_competencys for an organization (active ones by default).
    """
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")

    offset = (page - 1) * limit

    with get_conn() as conn:
        with conn.cursor() as cur:
            # total count
            cur.execute(
                """
                select count(*)
                from public.org_competencys c
                where c.organization_id = %s
                  and c.is_active = true
                """,
                (str(org_id),),
            )
            total = cur.fetchone()[0]

            # page rows with join to competencys
            cur.execute(
                """
                select
                  c.id::text,
                  c.organization_id::text,
                  c.competency_id::text,
                  c.required_level,
                  c.weight,
                  c.is_active,
                  c.created_at,
                  c.updated_at,
                  s.id::text as s_id,
                  s.name as s_name,
                  s.category as s_category,
                  s.description as s_description
                from public.org_competencys c
                left join public.competencys s on s.id = c.competency_id
                where c.organization_id = %s
                  and c.is_active = true
                order by c.updated_at desc
                offset %s limit %s
                """,
                (str(org_id), offset, limit),
            )
            rows = cur.fetchall()

    items = [_row_to_org(r) for r in rows]
    return items, total


def get_org_competency(
    org_id: UUID,
    org_competency_id: UUID,
) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  c.id::text,
                  c.organization_id::text,
                  c.competency_id::text,
                  c.required_level,
                  c.weight,
                  c.is_active,
                  c.created_at,
                  c.updated_at,
                  s.id::text as s_id,
                  s.name as s_name,
                  s.category as s_category,
                  s.description as s_description
                from public.org_competencys c
                left join public.competencys s on s.id = c.competency_id
                where c.organization_id = %s
                  and c.id = %s
                limit 1
                """,
                (str(org_id), str(org_competency_id)),
            )
            row = cur.fetchone()

    if not row:
        raise ValueError("Organization competency mapping not found")

    return _row_to_org(row)


def update_org_competency(
    org_id: UUID,
    org_competency_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    """
    Update required_level / weight / is_active.
    """
    fields: Dict[str, Any] = {}
    if "required_level" in payload:
        fields["required_level"] = payload["required_level"]
    if "weight" in payload:
        fields["weight"] = payload["weight"]
    if "is_active" in payload:
        fields["is_active"] = bool(payload["is_active"])

    if not fields:
        return get_org_competency(org_id, org_competency_id)

    fields["updated_by"] = str(actor_user_id) if actor_user_id else None

    set_clause = ", ".join(f"{k} = %s" for k in fields.keys())
    params = list(fields.values()) + [str(org_competency_id), str(org_id)]

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                update public.org_competencys
                set {set_clause}, updated_at = now()
                where id = %s and organization_id = %s
                returning id
                """,
                params,
            )
            upd = cur.fetchone()

    if not upd:
        raise ValueError("Organization competency mapping not found")

    return get_org_competency(org_id, org_competency_id)


def delete_org_competency(
    org_id: UUID,
    org_competency_id: UUID,
    soft: bool = True,
) -> None:
    """
    Soft delete = set is_active = false.
    Hard delete = remove row.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            if soft:
                cur.execute(
                    """
                    update public.org_competencys
                    set is_active = false, updated_at = now()
                    where id = %s and organization_id = %s and is_active = true
                    returning id
                    """,
                    (str(org_competency_id), str(org_id)),
                )
            else:
                cur.execute(
                    """
                    delete from public.org_competencys
                    where id = %s and organization_id = %s
                    returning id
                    """,
                    (str(org_competency_id), str(org_id)),
                )
            row = cur.fetchone()

    if not row:
        raise ValueError("Organization competency mapping not found or already deleted")
