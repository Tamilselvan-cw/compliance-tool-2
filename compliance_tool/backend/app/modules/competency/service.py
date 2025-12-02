# services/competency_dictionary_service.py
from typing import Optional, Tuple, List, Dict, Any
from uuid import UUID
import json
from .schemas import CompetencyDictItem
from app.db.session import get_conn

def _acquire_conn():
    ctx = get_conn()
    if hasattr(ctx, "__enter__"):
        return ctx, True
    return ctx, False

def _normalize_role_ids(raw: Any) -> List[str]:
    """
    Normalize Postgres array / json / list representations into a list of UUID strings.
    Accepts: list/tuple of UUID/str, a Postgres array textual representation like '{uuid,uuid}',
    a JSON string '["uuid","uuid"]' or None.
    """
    if raw is None:
        return []
    # driver may already return Python list/tuple
    if isinstance(raw, (list, tuple)):
        return [str(x) for x in raw if x is not None]
    # driver may return bytes
    if isinstance(raw, bytes):
        try:
            raw = raw.decode()
        except Exception:
            raw = str(raw)
    # try parse as JSON first
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        # JSON array?
        if s.startswith("[") and s.endswith("]"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, (list, tuple)):
                    return [str(x) for x in parsed if x is not None]
            except Exception:
                pass
        # Postgres array textual form: {uuid,uuid}
        if s.startswith("{") and s.endswith("}"):
            inner = s[1:-1].strip()
            if not inner:
                return []
            # split on commas not inside quotes (simple split is fine for UUIDs)
            parts = [p.strip().strip('"').strip("'") for p in inner.split(",") if p.strip()]
            return [p for p in parts if p]
        # fallback: single token
        return [s]
    # anything else: coerce to string
    return [str(raw)]

def _normalize_roles_json(raw: Any) -> List[Dict[str, Any]]:
    """
    Normalize roles JSON coming from DB lateral query into Python list of dicts.
    Accepts jsonb (driver returns dict/list), a JSON string, or None.
    """
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        # typically list of dicts
        return [dict(x) if not isinstance(x, dict) else x for x in raw]
    if isinstance(raw, bytes):
        try:
            raw = raw.decode()
        except Exception:
            raw = str(raw)
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return parsed
            # sometimes driver returns single object
            if isinstance(parsed, dict):
                return [parsed]
        except Exception:
            # can't parse - return empty
            return []
    # fallback: try to coerce to list
    try:
        return list(raw)
    except Exception:
        return []

def list_competency_dictionary(
    org_id: UUID,
    page: int = 1,
    limit: int = 25,
    q: Optional[str] = None,
    category: Optional[str] = None,
    expected_level: Optional[int] = None,
    role_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,
    scope: Optional[str] = None,
) -> Tuple[List[CompetencyDictItem], int]:
    """
    Returns (items, total) with these rules (adapted to include core alongside org rows
    when the client requests 'organization' scope or passes no scope):
      - no scope: return core OR any competency with organization_id = org_id
      - scope=core: only core (organization_id IS NULL)
      - scope=organization: return core OR any competency with organization_id = org_id
      - scope=role_based: if role_id provided -> competencies that have RCE for that role (and org_id),
                         else -> competencies where scope is role-based and organization_id = org_id
    """
    from psycopg2.extras import RealDictCursor

    offset = (page - 1) * limit
    params: dict = {"org_id": str(org_id)}

    # --- build comp filters ---
    comp_filters: List[str] = ["c.is_active = true"]

    if category:
        params["category"] = category
        comp_filters.append("c.category::text = %(category)s")

    # existing code context...
    if scope:
        s = str(scope).strip().lower()

        if s == "core":
            # only core (global)
            comp_filters = ["c.is_active = true", "c.scope::text = 'core'"]

        elif s in ("organization", "org"):
            # NOTE: this is the "organization" behavior that returns core + org rows
            # (used when UI sends scope=organization, i.e. dropdown 'all' per your mapping)
            comp_filters = ["c.is_active = true", "(c.scope::text = 'core' OR c.organization_id = %(org_id)s)"]

        elif s == "organization_only":
            # NEW: only rows that are organization-scoped for this org (no core)
            comp_filters = [
                "c.is_active = true",
                "c.organization_id = %(org_id)s",
                "c.scope::text = 'organization'"
            ]

        elif s in ("role_based", "role", "role-based"):
            comp_filters = [
                "c.is_active = true",
                "c.organization_id = %(org_id)s",
                "c.scope::text IN ('role', 'role_based')"
            ]
            if role_id:
                params["role_id"] = str(role_id)

        else:
            # fallback: strict equality against c.scope
            params["scope"] = s
            comp_filters.append("c.scope::text = %(scope)s")
    else:
        # no scope param: default = core OR any competency belonging to this org_id
        comp_filters.append("(c.scope::text = 'core' OR c.organization_id = %(org_id)s)")

    # q search
    if q:
        params["q"] = f"%{q.lower()}%"
        comp_filters.append("(lower(c.name) LIKE %(q)s OR lower(c.competency_code) LIKE %(q)s)")

    comp_where_sql = " AND ".join(comp_filters) if comp_filters else "TRUE"

    # optional exists filters (role/department) to further restrict results
    exists_clause_parts: List[str] = []
    exists_filters = False
    if role_id:
        params["role_id"] = str(role_id)
        exists_clause_parts.append("r.id = %(role_id)s")
        exists_filters = True
    if department_id:
        params["department_id"] = str(department_id)
        exists_clause_parts.append("d.id = %(department_id)s")
        exists_filters = True

    exists_filters_block = ""
    if exists_clause_parts:
        exists_filters_block = " AND " + " AND ".join(exists_clause_parts)

    # q-based OR EXISTS for matching role/department text when q is present
    q_exists_block_for_select = ""
    if q:
        q_exists_block_for_select = (
            " OR EXISTS ("
            " SELECT 1 FROM public.role_competency_expectations rse3 "
            " JOIN public.roles r ON r.id = rse3.role_id "
            " JOIN public.departments d ON d.id = r.department_id "
            " WHERE rse3.competency_id = c.id "
            "   AND rse3.organization_id = %(org_id)s "
            "   AND rse3.is_active = true "
            "   AND rse3.deleted_at IS NULL "
            "   AND (lower(r.title) LIKE %(q)s OR lower(r.role_code) LIKE %(q)s OR lower(d.name) LIKE %(q)s OR lower(d.department_code) LIKE %(q)s)"
            ")"
        )

    # --- main SELECT ---
    select_sql = f"""
WITH agg_rse AS (
  SELECT
    rse.competency_id,
    MAX(rse.expected_level) AS expected_level_max,
    COUNT(DISTINCT rse.role_id) AS roles_count,
    ARRAY_AGG(DISTINCT rse.role_id) FILTER (WHERE rse.role_id IS NOT NULL) AS role_ids
  FROM public.role_competency_expectations rse
  WHERE rse.organization_id = %(org_id)s
    AND rse.is_active = true
    AND rse.deleted_at IS NULL
  GROUP BY rse.competency_id
)
SELECT
  c.id AS competency_id,
  c.name AS competency_name,
  c.competency_code,
  c.description AS competency_description,
  c.category AS competency_category,
  c.scope AS competency_scope,
  COALESCE(ar.expected_level_max, NULL) AS expected_level,
  lv.name AS level_name,
  COALESCE(ar.roles_count, 0) AS roles_count,
  COALESCE(ar.role_ids, ARRAY[]::uuid[]) AS role_ids,
  roles_l.roles AS roles_json
FROM public.competencys c
LEFT JOIN agg_rse ar ON ar.competency_id = c.id
LEFT JOIN public.levels lv
  ON lv.organization_id = c.organization_id
  AND lv.score = ar.expected_level_max
  AND lv.is_active = TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
      'role_id', r.id,
      'role_code', r.role_code,
      'role_title', r.title,
      'department_id', d.id,
      'department_code', d.department_code,
      'department_name', d.name
  ) ORDER BY d.name, r.role_code) AS roles
  FROM public.role_competency_expectations rse2
  JOIN public.roles r ON r.id = rse2.role_id
  JOIN public.departments d ON d.id = r.department_id
  WHERE rse2.competency_id = c.id
    AND rse2.organization_id = %(org_id)s
    AND rse2.is_active = true
    AND rse2.deleted_at IS NULL
) roles_l ON true
WHERE (
  ({comp_where_sql})
  {"AND EXISTS (SELECT 1 FROM public.role_competency_expectations rseX JOIN public.roles r ON r.id = rseX.role_id JOIN public.departments d ON d.id = r.department_id WHERE rseX.competency_id = c.id AND rseX.organization_id = %(org_id)s AND rseX.is_active = true AND rseX.deleted_at IS NULL " + exists_filters_block + ")"
   if exists_filters else ""}
  {q_exists_block_for_select}
)
{"AND ar.expected_level_max = %(expected_level)s" if expected_level is not None else ""}
ORDER BY c.competency_code NULLS FIRST, c.name
LIMIT %(limit)s OFFSET %(offset)s;
"""

    # --- COUNT SQL ---
    count_sql = f"""
WITH agg_rse AS (
  SELECT rse.competency_id, MAX(rse.expected_level) AS expected_level_max
  FROM public.role_competency_expectations rse
  WHERE rse.organization_id = %(org_id)s
    AND rse.is_active = true
    AND rse.deleted_at IS NULL
  GROUP BY rse.competency_id
)
SELECT COUNT(DISTINCT c.id) AS total
FROM public.competencys c
LEFT JOIN agg_rse ar ON ar.competency_id = c.id
LEFT JOIN public.levels lv
  ON lv.organization_id = c.organization_id
  AND lv.score = ar.expected_level_max
  AND lv.is_active = TRUE
LEFT JOIN public.role_competency_expectations rse2 ON rse2.competency_id = c.id AND rse2.organization_id = %(org_id)s AND rse2.is_active = true AND rse2.deleted_at IS NULL
LEFT JOIN public.roles r ON r.id = rse2.role_id
LEFT JOIN public.departments d ON d.id = r.department_id
WHERE (
  ({comp_where_sql})
  {"AND (rse2.competency_id IS NOT NULL " + exists_filters_block + ")" if exists_filters else ""}
  {q_exists_block_for_select}
)
{"AND ar.expected_level_max = %(expected_level)s" if expected_level is not None else ""};
"""

    params.update({"limit": limit, "offset": offset})

    rows: List[Dict[str, Any]] = []
    total = 0
    conn_ctx, ctx_is_manager = _acquire_conn()
    try:
        if ctx_is_manager:
            conn = conn_ctx.__enter__()
        else:
            conn = conn_ctx

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(select_sql, params)
            rows = cur.fetchall()
            cur.execute(count_sql, params)
            total_row = cur.fetchone()
            total = int(total_row["total"]) if total_row and "total" in total_row else 0
            cur.close()
        except Exception:
            cur = conn.cursor()
            cur.execute(select_sql, params)
            result_rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description] if cur.description else []
            rows = [dict(zip(cols, r)) for r in result_rows]
            cur.execute(count_sql, params)
            cr = cur.fetchone()
            if cr:
                total = int(cr[0])
            cur.close()
    finally:
        if ctx_is_manager:
            try:
                conn_ctx.__exit__(None, None, None)
            except Exception:
                pass

    items: List[CompetencyDictItem] = []
    for r in rows:
        role_ids_raw = r.get("role_ids")
        normalized_role_ids = _normalize_role_ids(role_ids_raw)

        roles_raw = r.get("roles_json") or r.get("roles") or None
        roles_list = _normalize_roles_json(roles_raw)

        roles_by_department: Dict[str, List[Dict[str, Any]]] = {}
        for role_obj in roles_list:
            dept_name = (role_obj.get("department_name") or "—")
            entry = {
                "role_id": role_obj.get("role_id"),
                "role_code": role_obj.get("role_code"),
                "role_title": role_obj.get("role_title"),
                "department_id": role_obj.get("department_id"),
                "department_code": role_obj.get("department_code"),
            }
            roles_by_department.setdefault(dept_name, []).append(entry)

        items.append(
            CompetencyDictItem(
                competency_id=r.get("competency_id"),
                competency_name=r.get("competency_name"),
                competency_code=r.get("competency_code"),
                competency_description=r.get("competency_description"),
                competency_category=r.get("competency_category"),
                competency_scope=r.get("competency_scope"),
                expected_level=r.get("expected_level"),
                level_name=r.get("level_name"),
                role_id=None,
                role_code=None,
                role_name=None,
                department_id=None,
                department_code=None,
                department_name=None,
                roles_count=int(r.get("roles_count") or 0),
                role_ids=normalized_role_ids,
                roles=roles_list,
                roles_by_department=roles_by_department,
            )
        )

    return items, int(total)
