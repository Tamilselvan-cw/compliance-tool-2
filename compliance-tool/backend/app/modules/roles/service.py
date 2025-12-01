from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID
import logging
from psycopg2 import errors
from psycopg2.extras import execute_values
from app.db.session import get_conn
from psycopg2.extras import execute_values
from typing import Sequence

logger = logging.getLogger(__name__)

IdType = Union[str, UUID]


def _clean_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _normalize_create(org_id: UUID, body: Dict[str, Any]) -> Dict[str, Any]:
    title = _clean_str(body.get("title"))
    if not title:
        raise ValueError("title is required")

    dept = body.get("department_id")
    if not dept:
        raise ValueError("department_id is required")

    ey = body.get("experience_years")
    el = body.get("experience_level")
    if ey is not None:
        ey = float(ey)
        if ey < 0 or ey > 60:
            raise ValueError("experience_years must be between 0 and 60")
    if el is not None:
        el = int(el)
        if el < 0 or el > 60:
            raise ValueError("experience_level must be between 0 and 60")

    descriptions = body.get("descriptions") or []
    descriptions = [d for d in (descriptions or []) if _clean_str(d)]

    return {
        "organization_id": str(org_id),
        "title": title,
        "experience_years": ey,
        "experience_level": el,
        "descriptions": descriptions,
        "department_id": str(dept),
    }


def _row_to_role(row) -> Dict[str, Any]:
    (
        id,
        organization_id,
        title,
        experience_years,
        experience_level,
        is_active,
        created_by,
        updated_by,
        created_at,
        updated_at,
        department_id,
        role_code,
        job_type,
        education_qualification,
        job_descriptions,
    ) = row

    return {
        "id": str(id),
        "organization_id": str(organization_id),
        "title": title,
        "experience_years": experience_years,
        "experience_level": experience_level,
        "is_active": is_active,
        "created_at": created_at,
        "updated_at": updated_at,
        "department_id": str(department_id) if department_id is not None else None,
        "role_code": role_code,
        "job_type": job_type,
        "education_qualification": education_qualification,
        "job_descriptions": job_descriptions or [],
        "descriptions": job_descriptions or [],
    }


def _row_to_dict(row) -> Dict[str, Any]:
    cols = [
        "id",
        "organization_id",
        "title",
        "experience_years",
        "experience_level",
        "is_active",
        "created_at",
        "updated_at",
        "department_id",
        "role_code",                 # <--- must be here if SELECT places role_code here
        "job_type",
        "education_qualification",
    ]
    return dict(zip(cols, row))


def _fetch_role_descriptions(org_id: IdType, role_id: IdType) -> List[str]:
    """Return ordered list of job_descriptions for a role."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select description
                from public.role_job_descriptions
                where organization_id = %s
                  and role_id = %s
                  and deleted_at is null
                order by ord asc, created_at asc
                """,
                (str(org_id), str(role_id)),
            )
            rows = cur.fetchall()
    return [r[0] for r in rows]


def _fetch_role_specifications(org_id: IdType, role_id: IdType) -> List[str]:
    """Return ordered list of job_specifications for a role."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select specification
                from public.role_job_specifications
                where organization_id = %s
                  and role_id = %s
                  and deleted_at is null
                order by ord asc, created_at asc
                """,
                (str(org_id), str(role_id)),
            )
            rows = cur.fetchall()
    return [r[0] for r in rows]


def get_role(org_id: UUID, role_id: UUID) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  r.id::text,
                  r.organization_id::text,
                  r.title,
                  r.experience_years,
                  r.experience_level,
                  r.is_active,
                  r.created_at,
                  r.updated_at,
                  r.department_id::text,
                  r.role_code,                -- must be here if _row_to_dict expects it
                  r.job_type,
                  r.education_qualification
                from public.roles r
                where r.id = %s
                  and r.organization_id = %s
                  and r.deleted_at is null
                """,
                (str(role_id), str(org_id)),
            )
            row = cur.fetchone()

    if not row:
        raise ValueError("Role not found")

    # convert row -> dict (make sure _row_to_dict includes role_code)
    role = _row_to_dict(row)

    # fetch and attach descriptions/specs
    role["job_descriptions"] = _fetch_role_descriptions(org_id, role["id"])
    role["job_specifications"] = _fetch_role_specifications(org_id, role["id"])
    role["descriptions"] = role["job_descriptions"]
    role["specifications"] = role["job_specifications"]

    # THIS IS CRITICAL — return the role
    return role


def list_roles(
    org_id: UUID,
    page: int = 1,
    limit: int = 50,
    q: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")
    offset = (page - 1) * limit

    where = ["organization_id = %s", "deleted_at is null"]
    params: List[Any] = [str(org_id)]
    if q:
        where.append("(title ilike %s)")
        params.append(f"%{q}%")
    where_sql = " and ".join(where)

    with get_conn() as conn:
        with conn.cursor() as cur:
            # total
            cur.execute(
                f"select count(*) from public.roles where {where_sql}",
                params,
            )
            total = cur.fetchone()[0]
            cur.execute(
                f"""
                select
                id::text,
                organization_id::text,
                title,
                experience_years,
                experience_level,
                is_active,
                created_at,
                updated_at,
                department_id::text,
                role_code,                  -- <-- here
                job_type,
                education_qualification
                from public.roles
                where {where_sql}
                order by created_at desc
                offset %s limit %s
                """,
                params + [offset, limit],
            )
            rows = cur.fetchall()

    items: List[Dict[str, Any]] = []
    for r in rows:
        d = _row_to_dict(r)
        d["job_descriptions"] = _fetch_role_descriptions(org_id, d["id"])
        d["job_specifications"] = _fetch_role_specifications(org_id, d["id"])
        d["descriptions"] = d["job_descriptions"]
        d["specifications"] = d["job_specifications"]
        items.append(d)

    return items, total


def create_role_for_org(
    org_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    title = (payload.get("title") or "").strip()
    department_id = payload.get("department_id")
    experience_years = payload.get("experience_years")
    experience_level = payload.get("experience_level")
    is_active = bool(payload.get("is_active", False))

    job_type = _clean_str(payload.get("job_type"))
    education_qualification = _clean_str(payload.get("education_qualification"))

    job_descriptions: List[str] = [
        (s or "").strip()
        for s in (payload.get("job_descriptions") or [])
        if (s or "").strip()
    ]
    job_specs: List[str] = [
        (s or "").strip()
        for s in (payload.get("job_specifications") or [])
        if (s or "").strip()
    ]

    org_id_str = str(org_id)
    dept_id_str = str(department_id) if department_id else None
    created_by_str = str(actor_user_id) if actor_user_id else None

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.roles
                  (organization_id, title, department_id,
                   experience_years, experience_level, is_active,
                   created_by, updated_by,
                   job_type, education_qualification)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                  id,
                  organization_id,
                  title,
                  department_id,
                  experience_years,
                  experience_level,
                  is_active,
                  created_at,
                  updated_at,
                  job_type,
                  education_qualification
                """,
                (
                    org_id_str,
                    title,
                    dept_id_str,
                    experience_years,
                    experience_level,
                    is_active,
                    created_by_str,
                    created_by_str,
                    job_type,
                    education_qualification,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Role insert failed")

            role_id = row[0]
            role_id_str = str(role_id)

            if job_descriptions:
                desc_rows = [
                    (org_id_str, role_id_str, idx, text)
                    for idx, text in enumerate(job_descriptions, start=1)
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO public.role_job_descriptions
                      (organization_id, role_id, ord, description)
                    VALUES %s
                    """,
                    desc_rows,
                )

            if job_specs:
                spec_rows = [
                    (org_id_str, role_id_str, idx, text)
                    for idx, text in enumerate(job_specs, start=1)
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO public.role_job_specifications
                      (organization_id, role_id, ord, specification)
                    VALUES %s
                    """,
                    spec_rows,
                )

    (
        db_id,
        db_org_id,
        db_title,
        db_dept_id,
        db_exp_years,
        db_exp_level,
        db_is_active,
        db_created_at,
        db_updated_at,
        db_job_type,
        db_edu_qual,
    ) = row

    return {
        "id": str(db_id),
        "organization_id": str(db_org_id),
        "title": db_title,
        "department_id": str(db_dept_id) if db_dept_id is not None else None,
        "experience_years": float(db_exp_years) if db_exp_years is not None else None,
        "experience_level": db_exp_level,
        "is_active": bool(db_is_active),
        "created_at": db_created_at.isoformat() if db_created_at else None,
        "updated_at": db_updated_at.isoformat() if db_updated_at else None,
        "job_type": db_job_type,
        "education_qualification": db_edu_qual,
        "descriptions": job_descriptions,
        "job_descriptions": job_descriptions,
        "job_specifications": job_specs,
        "specifications": job_specs,
    }


# ---------- UPSERT HELPERS ----------

def upsert_role_descriptions(conn, org_id, role_id, items):
    with conn.cursor() as cur:

        # 1) delete all existing rows first
        cur.execute(
            "delete from public.role_job_descriptions where role_id = %s",
            (str(role_id),),
        )

        # 2) now insert fresh, ordered items
        ord_idx = 0
        for raw in items:
            # allow strings or objects
            text = ""
            if isinstance(raw, str):
                text = raw.strip()
            else:
                text = (raw.get("text") or raw.get("description") or "").strip()

            if not text:
                continue

            cur.execute(
                """
                insert into public.role_job_descriptions
                    (organization_id, role_id, ord, description)
                values (%s, %s, %s, %s)
                """,
                (str(org_id), str(role_id), ord_idx, text),
            )
            ord_idx += 1


def upsert_role_specifications(conn, org_id, role_id, items):
    with conn.cursor() as cur:

        cur.execute(
            "delete from public.role_job_specifications where role_id = %s",
            (str(role_id),),
        )

        ord_idx = 0
        for raw in items:
            if isinstance(raw, str):
                text = raw.strip()
            else:
                text = (raw.get("text") or raw.get("specification") or "").strip()

            if not text:
                continue

            cur.execute(
                """
                insert into public.role_job_specifications
                    (organization_id, role_id, ord, specification)
                values (%s, %s, %s, %s)
                """,
                (str(org_id), str(role_id), ord_idx, text),
            )
            ord_idx += 1


def upsert_role_competencies(
    conn,
    org_id: IdType,
    role_id: IdType,
    items: List[Dict[str, Any]],
):
    """
    Expected shape per item (for a bulk-competencies endpoint):

    {
      "id": "role_skill_expectations.id | null",
      "competency_id": "existing competency id | null",
      "name": "Skill name",
      "category": "technical|functional|behavioral",
      "expected_level": number,
      "weight": number
    }
    """
    with conn.cursor() as cur:
        sent_ids: List[str] = []

        for item in items:
            rec_id = item.get("id")
            name = (item.get("name") or "").strip()
            if not name:
                continue
            category = item["category"]
            expected_level = item["expected_level"]
            weight = item["weight"]
            competency_id = item.get("competency_id")

            if rec_id:
                cur.execute(
                    """
                    update public.role_skill_expectations
                    set expected_level = %s,
                        weight = %s
                    where id = %s
                    """,
                    (expected_level, weight, str(rec_id)),
                )
                sent_ids.append(str(rec_id))
            else:
                if not competency_id:
                    cur.execute(
                        """
                        insert into public.competencys
                            (organization_id, name, category)
                        values (%s, %s, %s)
                        returning id
                        """,
                        (str(org_id), name, category),
                    )
                    competency_id = cur.fetchone()[0]

                cur.execute(
                    """
                    insert into public.role_skill_expectations
                      (role_id, competency_id, expected_level, weight)
                    values (%s, %s, %s, %s)
                    returning id
                    """,
                    (str(role_id), str(competency_id), expected_level, weight),
                )
                new_id = cur.fetchone()[0]
                sent_ids.append(str(new_id))

        if sent_ids:
            cur.execute(
                """
                delete from public.role_skill_expectations
                where role_id = %s
                  and id not in %s
                """,
                (str(role_id), tuple(sent_ids)),
            )
        else:
            cur.execute(
                "delete from public.role_skill_expectations where role_id = %s",
                (str(role_id),),
            )


# ---------- UPDATE ROLE (uses UPSERTS) ----------

def update_role_for_org(
    org_id: UUID,
    role_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    org_id_str = str(org_id)
    role_id_str = str(role_id)

    base_fields: List[str] = []
    base_values: List[Any] = []

    for col in (
        "title",
        "experience_years",
        "is_active",
        "department_id",
        "job_type",
        "education_qualification",
    ):
        if col in payload and payload[col] is not None:
            val = payload[col]
            if col == "department_id":
                val = str(val)
            base_fields.append(f"{col} = %s")
            base_values.append(val)


    job_descs_raw = payload.get("job_descriptions")

    with get_conn() as conn:
        # 1) update base role row if needed
        if base_fields:
            with conn.cursor() as cur:
                base_values.extend(
                    [
                        str(actor_user_id) if actor_user_id else None,
                        role_id_str,
                        org_id_str,
                    ]
                )
                cur.execute(
                    f"""
                    update public.roles
                    set {", ".join(base_fields)}, updated_by = %s
                    where id = %s and organization_id = %s
                    """,
                    base_values,
                )

        # 2) upsert descriptions/specifications if provided
        if job_descs_raw is not None:
            # tolerate both arrays of strings and arrays of objects
            if isinstance(job_descs_raw, list):
                upsert_role_descriptions(conn, org_id_str, role_id_str, job_descs_raw)

        # 3) re-fetch full row with arrays
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  r.id,
                  r.organization_id,
                  r.title,
                  r.experience_years,
                  r.experience_level,
                  r.is_active,
                  r.created_by,
                  r.updated_by,
                  r.created_at,
                  r.updated_at,
                  r.department_id,
                  r.role_code,
                  r.job_type,
                  r.education_qualification,
                  coalesce(
                    (
                      select array_agg(d.description order by d.ord)
                      from public.role_job_descriptions d
                      where d.role_id = r.id and d.deleted_at is null
                    ), '{}'
                  ) as job_descriptions
                from public.roles r
                where r.id = %s and r.organization_id = %s
                """,
                (role_id_str, org_id_str),
            )
            row = cur.fetchone()


    if not row:
        raise ValueError("Role not found after update")

    return _row_to_role(row)


def bulk_delete_roles_for_org(
    org_id: UUID,
    role_ids: Sequence[UUID],
    actor_user_id: Optional[UUID] = None,
    hard: bool = False,
) -> Dict[str, Any]:
    """
    Bulk delete roles by IDs for a given org.

    - role_ids: list/tuple of UUIDs
    - hard = False  -> soft delete (set deleted_at, is_active=false)
    - hard = True   -> hard delete (remove rows)

    Returns:
        {
          "deleted_ids": [...],
          "deleted_count": n,
          "hard": bool
        }
    """
    if not role_ids:
        return {"deleted_ids": [], "deleted_count": 0, "hard": hard}

    org_id_str = str(org_id)
    ids_str = [str(r) for r in role_ids]
    actor_str = str(actor_user_id) if actor_user_id else None

    with get_conn() as conn:
        with conn.cursor() as cur:
            if hard:
                # 1) delete children first
                cur.execute(
                    """
                    delete from public.role_competency_expectations
                    where organization_id = %s
                      and role_id = any(%s)
                    """,
                    (org_id_str, ids_str),
                )
                cur.execute(
                    """
                    delete from public.role_job_descriptions
                    where organization_id = %s
                      and role_id = any(%s)
                    """,
                    (org_id_str, ids_str),
                )
                cur.execute(
                    """
                    delete from public.role_job_specifications
                    where organization_id = %s
                      and role_id = any(%s)
                    """,
                    (org_id_str, ids_str),
                )

                # 2) delete roles
                cur.execute(
                    """
                    delete from public.roles
                    where organization_id = %s
                      and id = any(%s)
                    returning id
                    """,
                    (org_id_str, ids_str),
                )
                rows = cur.fetchall()
                deleted_ids = [str(r[0]) for r in rows]

                return {
                    "deleted_ids": deleted_ids,
                    "deleted_count": len(deleted_ids),
                    "hard": True,
                }

            else:
                # SOFT DELETE

                # 1) soft delete roles
                cur.execute(
                    """
                    update public.roles
                    set deleted_at = now(),
                        is_active = false,
                        updated_by = %s
                    where organization_id = %s
                      and id = any(%s)
                      and deleted_at is null
                    returning id
                    """,
                    (actor_str, org_id_str, ids_str),
                )
                rows = cur.fetchall()
                deleted_ids = [str(r[0]) for r in rows]

                if not deleted_ids:
                    return {
                        "deleted_ids": [],
                        "deleted_count": 0,
                        "hard": False,
                    }

                # 2) soft delete JDs/specs
                cur.execute(
                    """
                    update public.role_job_descriptions
                    set deleted_at = now()
                    where organization_id = %s
                      and role_id = any(%s)
                      and deleted_at is null
                    """,
                    (org_id_str, ids_str),
                )
                cur.execute(
                    """
                    update public.role_job_specifications
                    set deleted_at = now()
                    where organization_id = %s
                      and role_id = any(%s)
                      and deleted_at is null
                    """,
                    (org_id_str, ids_str),
                )

                # 3) soft delete role competencies
                cur.execute(
                    """
                    update public.role_competency_expectations
                    set deleted_at = now(),
                        is_active = false,
                        updated_at = now()
                    where organization_id = %s
                      and role_id = any(%s)
                      and deleted_at is null
                    """,
                    (org_id_str, ids_str),
                )

                return {
                    "deleted_ids": deleted_ids,
                    "deleted_count": len(deleted_ids),
                    "hard": False,
                }

def delete_role_for_org(
    org_id: UUID,
    role_id: UUID,
    actor_user_id: Optional[UUID] = None,
    hard: bool = False,
) -> Dict[str, Any]:
    """
    Delete a single role belonging to org_id.

    - soft delete (default):
        * roles.deleted_at = now(), is_active = false, updated_by = actor_user_id
        * role_job_descriptions.deleted_at = now()
        * role_job_specifications.deleted_at = now()
        * role_competency_expectations.deleted_at = now(), is_active = false

    - hard delete (hard=True):
        * DELETE from role_competency_expectations, role_job_descriptions,
          role_job_specifications, then roles
    """
    org_id_str = str(org_id)
    role_id_str = str(role_id)
    actor_str = str(actor_user_id) if actor_user_id else None

    with get_conn() as conn:
        with conn.cursor() as cur:
            if hard:
                # 1) delete children first
                cur.execute(
                    """
                    delete from public.role_competency_expectations
                    where organization_id = %s
                      and role_id = %s
                    """,
                    (org_id_str, role_id_str),
                )
                cur.execute(
                    """
                    delete from public.role_job_descriptions
                    where organization_id = %s
                      and role_id = %s
                    """,
                    (org_id_str, role_id_str),
                )
                cur.execute(
                    """
                    delete from public.role_job_specifications
                    where organization_id = %s
                      and role_id = %s
                    """,
                    (org_id_str, role_id_str),
                )

                # 2) delete role
                cur.execute(
                    """
                    delete from public.roles
                    where organization_id = %s
                      and id = %s
                    returning id
                    """,
                    (org_id_str, role_id_str),
                )
                row = cur.fetchone()
                if not row:
                    raise ValueError("Role not found")

                deleted_id = str(row[0])
                return {"deleted_id": deleted_id, "hard": True}

            else:
                # SOFT DELETE

                # 1) soft delete role
                cur.execute(
                    """
                    update public.roles
                    set deleted_at = now(),
                        is_active = false,
                        updated_by = %s
                    where organization_id = %s
                      and id = %s
                      and deleted_at is null
                    returning id
                    """,
                    (actor_str, org_id_str, role_id_str),
                )
                row = cur.fetchone()
                if not row:
                    raise ValueError("Role not found or already deleted")

                # 2) soft delete JDs & specs
                cur.execute(
                    """
                    update public.role_job_descriptions
                    set deleted_at = now()
                    where organization_id = %s
                      and role_id = %s
                      and deleted_at is null
                    """,
                    (org_id_str, role_id_str),
                )
                cur.execute(
                    """
                    update public.role_job_specifications
                    set deleted_at = now()
                    where organization_id = %s
                      and role_id = %s
                      and deleted_at is null
                    """,
                    (org_id_str, role_id_str),
                )

                # 3) soft delete role competencies
                cur.execute(
                    """
                    update public.role_competency_expectations
                    set deleted_at = now(),
                        is_active = false,
                        updated_at = now()
                    where organization_id = %s
                      and role_id = %s
                      and deleted_at is null
                    """,
                    (org_id_str, role_id_str),
                )

                deleted_id = str(row[0])
                return {"deleted_id": deleted_id, "hard": False}

def bulk_create_roles_for_org(
    org_id: UUID,
    items: Sequence[Dict[str, Any]],
    actor_user_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    """
    Bulk create roles for an organization.

    items: sequence of dicts shaped like RoleCreate. Each dict may include:
      - title (required), department_id (required), experience_years, experience_level,
      - is_active (optional), job_type, education_qualification,
      - job_descriptions (list of strings or objects), job_specifications (list).
    Returns list of created role dicts (same shape as _row_to_role output).
    """
    if not items:
        return []

    org_id_str = str(org_id)
    actor_str = str(actor_user_id) if actor_user_id else None

    # prepare rows for bulk insert into public.roles
    role_rows = []
    desc_rows = []   # (org_id, role_id, ord, description) to insert after role ids known
    spec_rows = []   # (org_id, role_id, ord, specification)

    created_ids: List[str] = []

    with get_conn() as conn:
        with conn.cursor() as cur:
            # 1) validate & prepare role rows
            for it in items:
                # reuse your normalize helper for required fields and basic cleaning
                # note: _normalize_create returns a map with organization_id, title, experience_years, etc.
                normalized = _normalize_create(org_id, dict(it))
                title = normalized["title"]
                dept_id = normalized["department_id"]
                experience_years = normalized.get("experience_years")
                experience_level = normalized.get("experience_level")
                # if client passes is_active, honor it; otherwise default False
                is_active = bool(it.get("is_active", False))

                job_type = _clean_str(it.get("job_type"))
                education_qualification = _clean_str(it.get("education_qualification"))

                role_rows.append(
                    (
                        org_id_str,
                        title,
                        str(dept_id) if dept_id is not None else None,
                        experience_years,
                        experience_level,
                        is_active,
                        actor_str,
                        actor_str,
                        job_type,
                        education_qualification,
                    )
                )

            if not role_rows:
                return []

            # 2) bulk insert into roles and return generated ids
            execute_values(
                cur,
                """
                INSERT INTO public.roles
                  (organization_id, title, department_id,
                   experience_years, experience_level, is_active,
                   created_by, updated_by,
                   job_type, education_qualification)
                VALUES %s
                RETURNING id
                """,
                role_rows,
            )
            rows = cur.fetchall()
            # rows: list of tuples like [(id1,), (id2,), ...]
            created_ids = [str(r[0]) for r in rows]

            # 3) build description & specification rows to insert (order preserved per item)
            # we must match created_ids order to items order
            for idx, it in enumerate(items):
                role_id_str = created_ids[idx]

                jds = it.get("job_descriptions") or []
                ord_idx = 1
                for raw in jds:
                    if isinstance(raw, str):
                        text = raw.strip()
                    else:
                        text = (raw.get("text") or raw.get("description") or "").strip()
                    if not text:
                        continue
                    desc_rows.append((org_id_str, role_id_str, ord_idx, text))
                    ord_idx += 1

                jss = it.get("job_specifications") or []
                ord_idx = 1
                for raw in jss:
                    if isinstance(raw, str):
                        text = raw.strip()
                    else:
                        text = (raw.get("text") or raw.get("specification") or "").strip()
                    if not text:
                        continue
                    spec_rows.append((org_id_str, role_id_str, ord_idx, text))
                    ord_idx += 1

            # 4) insert descriptions/specifications in bulk (if any)
            if desc_rows:
                execute_values(
                    cur,
                    """
                    INSERT INTO public.role_job_descriptions
                      (organization_id, role_id, ord, description)
                    VALUES %s
                    """,
                    desc_rows,
                )

            if spec_rows:
                execute_values(
                    cur,
                    """
                    INSERT INTO public.role_job_specifications
                      (organization_id, role_id, ord, specification)
                    VALUES %s
                    """,
                    spec_rows,
                )

            # commit happens when exiting get_conn() context

            # 5) fetch and return created role rows with aggregated job_descriptions
            cur.execute(
                f"""
                select
                  r.id,
                  r.organization_id,
                  r.title,
                  r.experience_years,
                  r.experience_level,
                  r.is_active,
                  r.created_by,
                  r.updated_by,
                  r.created_at,
                  r.updated_at,
                  r.department_id,
                  r.role_code,
                  r.job_type,
                  r.education_qualification,
                  coalesce(
                    (
                      select array_agg(d.description order by d.ord)
                      from public.role_job_descriptions d
                      where d.role_id = r.id and d.deleted_at is null
                    ), '{{}}'
                  ) as job_descriptions
                from public.roles r
                where r.id = any(%s)
                order by r.created_at desc
                """,
                (created_ids,),
            )
            final_rows = cur.fetchall()

    # map rows to role dicts and preserve order by created_at desc (or you can reorder by created_ids)
    created_roles: List[Dict[str, Any]] = []
    for r in final_rows:
        created_roles.append(_row_to_role(r))

    # optionally reorder to match created_ids order:
    id_to_role = {r["id"]: r for r in created_roles}
    ordered = [id_to_role[rid] for rid in created_ids if rid in id_to_role]

    return ordered
