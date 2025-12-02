# # service.py
# from __future__ import annotations
# from typing import Any, Dict, List, Optional, Tuple
# from uuid import UUID
# from app.db.session import get_conn

# def _clean(s: Optional[str]) -> Optional[str]:
#     if s is None:
#         return None
#     v = s.strip()
#     return v or None

# def _competency_get_or_create(org_id: UUID, name: str, category: str, description: Optional[str], actor_user_id: Optional[UUID]) -> str:
#     with get_conn() as conn:
#         with conn.cursor() as cur:
#             cur.execute(
#                 """
#                 select id::text
#                 from public.competencys
#                 where organization_id=%s and is_active=true
#                   and lower(name)=lower(%s) and category=%s
#                 limit 1
#                 """,
#                 (str(org_id), name, category),
#             )
#             r = cur.fetchone()
#             if r:
#                 return r[0]

#             cur.execute(
#                 """
#                 insert into public.competencys
#                   (organization_id, name, category, description, is_active, created_by, updated_by)
#                 values (%s, %s, %s, %s, true, %s, %s)
#                 returning id::text
#                 """,
#                 (
#                     str(org_id),
#                     name,
#                     category,
#                     _clean(description),
#                     str(actor_user_id) if actor_user_id else None,
#                     str(actor_user_id) if actor_user_id else None,
#                 ),
#             )
#             return cur.fetchone()[0]

# def _row_to_item(row) -> Dict[str, Any]:
#     cols = [
#         "id","org_id","employee_id","role_id","competency_matrix_id","competency_id",
#         "current_level","expected_level","source","remarks","updated_by","updated_at",
#         "s_id","s_name","s_category","s_description",
#     ]
#     d = dict(zip(cols, row))
#     out = {
#         "id": d["id"],
#         "org_id": d["org_id"],
#         "employee_id": d["employee_id"],
#         "role_id": d["role_id"],
#         "competency_matrix_id": d["competency_matrix_id"],
#         "competency_id": d["competency_id"],
#         "current_level": d["current_level"],
#         "expected_level": d["expected_level"],
#         "source": d["source"],
#         "remarks": d["remarks"],
#         "updated_by": d["updated_by"],
#         "updated_at": d["updated_at"],
#     }
#     if d["s_id"]:
#         out["competency"] = {
#             "id": d["s_id"],
#             "name": d["s_name"],
#             "category": d["s_category"],
#             "description": d["s_description"],
#         }
#     else:
#         out["competency"] = None
#     return out

# def list_employee_role_competencys(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     page: int = 1,
#     limit: int = 100,
#     category: Optional[str] = None,
#     search: Optional[str] = None,
# ) -> Tuple[List[Dict[str, Any]], int]:

#     offset = (page - 1) * limit

#     filters = []
#     params = [str(role_id), str(employee_id), str(org_id), str(cm_id), str(role_id), str(org_id)]

#     if category:
#         filters.append("s.category = %s")
#         params.append(category)

#     if search:
#         filters.append("s.name ILIKE %s")
#         params.append(f"%{search}%")

#     where_tail = ""
#     if filters:
#         where_tail = " AND " + " AND ".join(filters)

#     with get_conn() as conn:
#         with conn.cursor() as cur:

#             # Count total competencies for the role
#             cur.execute(
#                 f"""
#                 SELECT COUNT(*)
#                 FROM public.role_competency_expectations rse
#                 JOIN public.competencys s ON s.id = rse.competency_id
#                 WHERE rse.role_id = %s
#                   AND rse.organization_id = %s
#                   AND rse.is_active = TRUE
#                   AND s.deleted_at IS NULL
#                   {where_tail}
#                 """,
#                 params[-2:],   # (role_id, org_id) + filter params already appended
#             )
#             total = cur.fetchone()[0]

#             # Select full dataset
#             cur.execute(
#                 f"""
#                 SELECT
#                     s.id::text                AS competency_id,
#                     s.name                    AS competency_name,
#                     s.category                AS category,
#                     s.description             AS competency_description,

#                     rse.expected_level        AS expected_level,
#                     rse.weight                AS weight,

#                     ers.id::text              AS ers_id,
#                     ers.current_level         AS current_level,
#                     ers.remarks               AS remarks,
#                     ers.updated_at            AS updated_at
#                 FROM public.role_competency_expectations rse
#                 JOIN public.competencys s
#                     ON rse.competency_id = s.id
#                 LEFT JOIN public.employee_role_competency ers
#                     ON ers.competency_id = rse.competency_id
#                     AND ers.role_id = %s
#                     AND ers.employee_id = %s
#                     AND ers.org_id = %s
#                     AND ers.competency_matrix_id = %s
#                 WHERE
#                     rse.role_id = %s
#                     AND rse.organization_id = %s
#                     AND rse.is_active = TRUE
#                     AND s.deleted_at IS NULL
#                     {where_tail}
#                 ORDER BY
#                     s.category ASC,
#                     s.name ASC
#                 OFFSET %s LIMIT %s
#                 """,
#                 params + [offset, limit],
#             )

#             rows = cur.fetchall()

#     items = [_row_to_item(r) for r in rows]  # you already have _row_to_item
#     return items, total

# def upsert_by_name(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     payload: Dict[str, Any],
#     actor_user_id: Optional[UUID] = None,
# ) -> Dict[str, Any]:
#     name = _clean(payload.get("competency_name"))
#     category = _clean(payload.get("category"))
#     description = _clean(payload.get("description"))
#     current_level = int(payload.get("current_level") or 0)
#     expected_level = payload.get("expected_level")
#     expected_level = int(expected_level) if expected_level is not None else None
#     source = _clean(payload.get("source") or "manual")
#     remarks = _clean(payload.get("remarks"))

#     if not name or not category:
#         raise ValueError("competency_name and category are required")
#     if not (1 <= current_level <= 10):
#         raise ValueError("current_level must be between 1 and 10")
#     if expected_level is not None and not (1 <= expected_level <= 60):
#         raise ValueError("expected_level must be between 1 and 60")

#     competency_id = _competency_get_or_create(org_id, name, category, description, actor_user_id)
#     return upsert_by_id(
#         org_id, employee_id, role_id, cm_id,
#         {
#             "competency_id": competency_id,
#             "current_level": current_level,
#             "expected_level": expected_level,
#             "source": source,
#             "remarks": remarks,
#         },
#         actor_user_id,
#     )

# def upsert_by_id(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     payload: Dict[str, Any],
#     actor_user_id: Optional[UUID] = None,
# ) -> Dict[str, Any]:
#     competency_id = str(payload.get("competency_id"))
#     current_level = int(payload.get("current_level") or 0)
#     expected_level = payload.get("expected_level")
#     expected_level = int(expected_level) if expected_level is not None else None
#     source = _clean(payload.get("source") or "manual")
#     remarks = _clean(payload.get("remarks"))

#     if not competency_id:
#         raise ValueError("competency_id is required")
#     if not (1 <= current_level <= 10):
#         raise ValueError("current_level must be between 1 and 10")
#     if expected_level is not None and not (1 <= expected_level <= 60):
#         raise ValueError("expected_level must be between 1 and 60")

#     with get_conn() as conn:
#         with conn.cursor() as cur:
#             # Write both: competency_matrix_id (canonical) + survey_id (legacy) for compatibility
#             cur.execute(
#                 """
#                 insert into public.employee_role_competency
#                   (org_id, employee_id, role_id, competency_matrix_id, survey_id, competency_id,
#                    current_level, expected_level, source, remarks, updated_by)
#                 values (%s, %s, %s, %s, %s, %s,
#                         %s, %s, %s, %s, %s)
#                 on conflict (org_id, employee_id, role_id, competency_matrix_id, competency_id)
#                 do update set
#                   current_level   = EXCLUDED.current_level,
#                   expected_level  = coalesce(EXCLUDED.expected_level, public.employee_role_competency.expected_level),
#                   source          = EXCLUDED.source,
#                   remarks         = EXCLUDED.remarks,
#                   updated_by      = EXCLUDED.updated_by,
#                   updated_at      = now()
#                 returning id::text, org_id::text, employee_id::text, role_id::text, competency_matrix_id::text, competency_id::text,
#                           current_level, expected_level, source, remarks, updated_by::text, updated_at
#                 """,
#                 (
#                     str(org_id), str(employee_id), str(role_id), str(cm_id), str(cm_id), competency_id,
#                     current_level, expected_level, source, remarks,
#                     str(actor_user_id) if actor_user_id else None,
#                 ),
#             )
#             base = cur.fetchone()

#             cur.execute(
#                 """
#                 select
#                   %s::text as id, %s::text as org_id, %s::text as employee_id, %s::text as role_id, %s::text as competency_matrix_id, %s::text as competency_id,
#                   %s::int as current_level, %s::int as expected_level, %s::text as source, %s::text as remarks, %s::text as updated_by, %s::timestamptz as updated_at,
#                   s.id::text as s_id, s.name as s_name, s.category as s_category, s.description as s_description
#                 from public.competencys s
#                 where s.id = %s::uuid
#                 """,
#                 (base[0], base[1], base[2], base[3], base[4], base[5],
#                  base[6], base[7], base[8], base[9], base[10], base[11],
#                  base[5]),
#             )
#             joined = cur.fetchone()

#     return _row_to_item(joined)

# def bulk_upsert_by_name(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     items: List[Dict[str, Any]],
#     actor_user_id: Optional[UUID] = None,
# ) -> List[Dict[str, Any]]:
#     out: List[Dict[str, Any]] = []
#     with get_conn() as conn:
#         with conn.cursor() as cur:
#             for p in items:
#                 name = _clean(p.get("competency_name"))
#                 category = _clean(p.get("category"))
#                 description = _clean(p.get("description"))
#                 current_level = int(p.get("current_level") or 0)
#                 expected_level = p.get("expected_level")
#                 expected_level = int(expected_level) if expected_level is not None else None
#                 source = _clean(p.get("source") or "manual")
#                 remarks = _clean(p.get("remarks"))

#                 if not name or not category or not (1 <= current_level <= 10):
#                     continue
#                 if expected_level is not None and not (1 <= expected_level <= 60):
#                     continue

#                 # Ensure/insert competency
#                 cur.execute(
#                     """
#                     with existing as (
#                       select id from public.competencys
#                       where organization_id=%s and is_active=true and lower(name)=lower(%s) and category=%s
#                       limit 1
#                     ), ins as (
#                       insert into public.competencys (organization_id, name, category, description, is_active, created_by, updated_by)
#                       select %s, %s, %s, %s, true, %s, %s
#                       where not exists (select 1 from existing)
#                       returning id
#                     )
#                     select coalesce((select id from existing), (select id from ins))::text
#                     """,
#                     (
#                         str(org_id), name, category,
#                         str(org_id), name, category, description,
#                         str(actor_user_id) if actor_user_id else None,
#                         str(actor_user_id) if actor_user_id else None,
#                     ),
#                 )
#                 competency_id = cur.fetchone()[0]

#                 # Upsert ERS (matrix-scoped) — write survey_id too for legacy code paths
#                 cur.execute(
#                     """
#                     insert into public.employee_role_competency
#                       (org_id, employee_id, role_id, competency_matrix_id, survey_id, competency_id,
#                        current_level, expected_level, source, remarks, updated_by)
#                     values (%s, %s, %s, %s, %s, %s,
#                             %s, %s, %s, %s, %s)
#                     on conflict (org_id, employee_id, role_id, competency_matrix_id, competency_id)
#                     do update set
#                       current_level   = EXCLUDED.current_level,
#                       expected_level  = coalesce(EXCLUDED.expected_level, public.employee_role_competency.expected_level),
#                       source          = EXCLUDED.source,
#                       remarks         = EXCLUDED.remarks,
#                       updated_by      = EXCLUDED.updated_by,
#                       updated_at      = now()
#                     returning id::text, org_id::text, employee_id::text, role_id::text, competency_matrix_id::text, competency_id::text,
#                               current_level, expected_level, source, remarks, updated_by::text, updated_at
#                     """,
#                     (
#                         str(org_id), str(employee_id), str(role_id), str(cm_id), str(cm_id), competency_id,
#                         current_level, expected_level, source, remarks,
#                         str(actor_user_id) if actor_user_id else None,
#                     ),
#                 )
#                 base = cur.fetchone()

#                 # Join competency mini
#                 cur.execute(
#                     """
#                     select
#                       %s::text as id, %s::text as org_id, %s::text as employee_id, %s::text as role_id, %s::text as competency_matrix_id, %s::text as competency_id,
#                       %s::int as current_level, %s::int as expected_level, %s::text as source, %s::text as remarks, %s::text as updated_by, %s::timestamptz as updated_at,
#                       s.id::text as s_id, s.name as s_name, s.category as s_category, s.description as s_description
#                     from public.competencys s
#                     where s.id = %s::uuid
#                     """,
#                     (base[0], base[1], base[2], base[3], base[4], base[5],
#                      base[6], base[7], base[8], base[9], base[10], base[11],
#                      base[5]),
#                 )
#                 joined = cur.fetchone()
#                 out.append(_row_to_item(joined))
#     return out

# def delete_employee_role_competency(org_id: UUID, employee_id: UUID, role_id: UUID, cm_id: UUID, ers_id: UUID) -> None:
#     with get_conn() as conn:
#         with conn.cursor() as cur:
#             cur.execute(
#                 """
#                 delete from public.employee_role_competency
#                 where id=%s and org_id=%s and employee_id=%s and role_id=%s and competency_matrix_id=%s
#                 returning id
#                 """,
#                 (str(ers_id), str(org_id), str(employee_id), str(role_id), str(cm_id)),
#             )
#             r = cur.fetchone()
#     if not r:
#         raise ValueError("Employee role competency not found")

# app/modules/employee_role_competency/service.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Union
from uuid import UUID

from app.db.session import get_conn


UUIDLike = Union[str, UUID]


def _to_str(u: UUIDLike) -> str:
    """Normalize UUID / string to plain string for the DB driver."""
    return str(u)


def _get(item: Any, key: str, default: Any = None) -> Any:
    """
    Safely get a field from either a dict or a Pydantic/BaseModel-like object.
    First tries dict-style, then attribute-style.
    """
    if isinstance(item, dict):
        return item.get(key, default)
    # pydantic model / object
    return getattr(item, key, default)


def list_for_employee(org_id: UUIDLike, employee_id: UUIDLike) -> List[Dict[str, Any]]:
    """
    Return all competency mappings for a given employee (no survey dimension).

    DB column is `current_level`, but API exposes it as `level`.
    Table columns assumed:
      id, org_id, employee_id, role_id, competency_id, current_level, remarks
    """
    sql = """
        select
            id,
            org_id,
            employee_id,
            role_id,
            competency_id,
            current_level as level,
            remarks
        from public.employee_role_competency
        where org_id = %(org_id)s
          and employee_id = %(employee_id)s
        order by role_id, competency_id
    """
    params = {
        "org_id": _to_str(org_id),
        "employee_id": _to_str(employee_id),
    }

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [c.name for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    return rows


def bulk_upsert_for_employee(
    org_id: UUIDLike,
    employee_id: UUIDLike,
    items: List[Any],
) -> Tuple[int, int]:
    """
    Bulk save competency mappings for an employee.

    Strategy:
      - Hard delete all existing rows for (org_id, employee_id)
      - Insert the new list as the current state

    DB column name: current_level
    API field name: level
    Table columns assumed:
      id (defaulted by DB), org_id, employee_id,
      role_id, competency_id, current_level, remarks
    """
    org_id_str = _to_str(org_id)
    emp_id_str = _to_str(employee_id)

    # If empty list passed, we just clear any existing mappings
    if not items:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                delete from public.employee_role_competency
                where org_id = %(org_id)s
                  and employee_id = %(employee_id)s
                """,
                {"org_id": org_id_str, "employee_id": emp_id_str},
            )
            conn.commit()
        return 0, 0

    insert_sql = """
        insert into public.employee_role_competency
            (org_id, employee_id, role_id, competency_id, current_level, remarks)
        values
            (%(org_id)s, %(employee_id)s, %(role_id)s, %(competency_id)s, %(current_level)s, %(remarks)s)
    """

    inserted = 0

    with get_conn() as conn, conn.cursor() as cur:
        # 1) Clear existing mappings for this employee in this org
        cur.execute(
            """
            delete from public.employee_role_competency
            where org_id = %(org_id)s
              and employee_id = %(employee_id)s
            """,
            {"org_id": org_id_str, "employee_id": emp_id_str},
        )

        # 2) Insert new mappings
        for raw_item in items:
            role_id = _get(raw_item, "role_id")
            competency_id = _get(raw_item, "competency_id")
            level = _get(raw_item, "level")          # API field
            remarks = _get(raw_item, "remarks")

            if role_id is None or competency_id is None or level is None:
                # skip malformed rows instead of raising KeyError
                continue

            params = {
                "org_id": org_id_str,
                "employee_id": emp_id_str,
                "role_id": _to_str(role_id),
                "competency_id": _to_str(competency_id),
                "current_level": level,   # <-- mapped to DB column
                "remarks": remarks,
            }
            cur.execute(insert_sql, params)
            inserted += 1

        conn.commit()

    # inserted count, updated count (not used here)
    return inserted, 0
