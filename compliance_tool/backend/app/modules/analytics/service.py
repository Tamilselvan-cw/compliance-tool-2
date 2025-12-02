# services/analytics_service.py
from typing import List, Optional, Any
from app.db.session import get_conn   # adjust to your helper
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except Exception:
        return None

def _acquire_conn():
    ctx = get_conn()
    if hasattr(ctx, "__enter__"):
        return ctx, True
    return ctx, False


# Implement list_skill_trends and list_department_averages with same defensive pattern:
# - use outer aliases for ORDER BY (key/current_avg)
# - always set rows = [] if fetch returns empty
# - return list (possibly empty)
# - catch exceptions, log, re-raise

def list_skill_trends(
    org_id: str,
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "key",
    min_count: Optional[int] = None,
) -> List[dict]:
    """
    Returns skill-wise aggregates: competency_id, key (name), current_avg, expected_avg, count.
    expected_avg is computed as AVG(COALESCE(er.expected_level, rse.expected_level))
    where rse is the role_competency_expectations for the employee's role (if any).
    """
    try:
        params = {"org_id": org_id, "limit": limit, "offset": offset}
        where_clauses = ["er.org_id = %(org_id)s"]

        if q:
            params["q"] = f"%{q}%"
            where_clauses.append("c.name ILIKE %(q)s")

        where_sql = " AND ".join(where_clauses)

        # choose ordering; you can expand options if needed
        order_sql = "key ASC"
        if sort == "current_desc":
            order_sql = "current_avg DESC"
        elif sort == "current_asc":
            order_sql = "current_avg ASC"
        elif sort == "gap_desc":
            order_sql = "(expected_avg - current_avg) DESC"
        elif sort == "gap_asc":
            order_sql = "(expected_avg - current_avg) ASC"

        having_sql = ""
        if min_count is not None:
            params["min_count"] = int(min_count)
            having_sql = "HAVING COUNT(*) >= %(min_count)s"

        sql = f"""
        WITH filtered AS (
          SELECT
            er.competency_id,
            c.name AS competency_name,
            er.current_level,
            -- prefer per-employee expected_level, otherwise fallback to role expectation (rse.expected_level)
            COALESCE(er.expected_level, rse.expected_level) AS expected_level
          FROM employee_role_competency er
          JOIN competencys c ON c.id = er.competency_id
          LEFT JOIN role_competency_expectations rse
            ON rse.role_id = er.role_id
            AND rse.competency_id = er.competency_id
            AND rse.organization_id = er.org_id
            AND rse.is_active = TRUE
            AND rse.deleted_at IS NULL
          WHERE {where_sql}
        )
        SELECT
          f.competency_id,
          f.competency_name AS key,
          AVG(NULLIF(f.current_level, 0))::numeric(10,4) AS current_avg,
          AVG(f.expected_level)::numeric(10,4) AS expected_avg,
          COUNT(*) AS count
        FROM filtered f
        GROUP BY f.competency_id, f.competency_name
        {having_sql}
        ORDER BY {order_sql}
        LIMIT %(limit)s OFFSET %(offset)s;
        """

        conn_ctx, is_ctx = _acquire_conn()
        rows = []
        if is_ctx:
            with conn_ctx as conn:
                cur = conn.cursor()
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
        else:
            conn = conn_ctx
            cur = conn.cursor()
            try:
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass

        if not rows:
            return []

        out = []
        for r in rows:
            out.append(
                {
                    "competency_id": r.get("competency_id"),
                    "key": r.get("key"),
                    "current_avg": _to_float(r.get("current_avg")),
                    "expected_avg": _to_float(r.get("expected_avg")),
                    "count": int(r.get("count") or 0),
                }
            )
        return out
    except Exception:
        logger.exception("list_skill_trends failed")
        raise


def list_role_averages(
    org_id: str,
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "role",
    min_count: Optional[int] = None,
) -> List[dict]:
    """
    Role-anchored aggregates:
      - current_avg: avg of employee_role_competency.current_level for employees assigned to the role
      - expected_avg: avg of role_competency_expectations.expected_level for that role
    Returns list of { role_id, key, current_avg, expected_avg, count }.
    """
    try:
        params = {"org_id": org_id, "limit": limit, "offset": offset}
        role_filter = "r.organization_id = %(org_id)s"

        if q:
            params["q"] = f"%{q}%"
            role_filter += " AND r.title ILIKE %(q)s"

        # choose order by
        order_sql = "key ASC"
        if sort == "current_desc":
            order_sql = "current_avg DESC NULLS LAST"
        elif sort == "current_asc":
            order_sql = "current_avg ASC NULLS LAST"
        elif sort == "expected_desc":
            order_sql = "expected_avg DESC NULLS LAST"
        elif sort == "expected_asc":
            order_sql = "expected_avg ASC NULLS LAST"
        elif sort == "gap_desc":
            order_sql = "(COALESCE(expected_avg,0) - COALESCE(current_avg,0)) DESC"
        elif sort == "gap_asc":
            order_sql = "(COALESCE(expected_avg,0) - COALESCE(current_avg,0)) ASC"

        having_sql = ""
        if min_count is not None:
            params["min_count"] = int(min_count)
            having_sql = "HAVING COUNT(er_rows.emp_id) >= %(min_count)s"

        sql = f"""
        /*
          role_agg:
            - expected_avg computed from role_competency_expectations (rse)
            - current_avg computed from employee_role_competency rows for employees whose primary_role_id = r.id
        */
        WITH
        -- canonical expected values per role (may be empty for some roles)
        rse_agg AS (
          SELECT
            rse.role_id,
            AVG(rse.expected_level)::numeric(10,4) AS expected_avg,
            COUNT(*) AS expected_count
          FROM public.role_competency_expectations rse
          WHERE rse.organization_id = %(org_id)s
            AND rse.is_active = TRUE
            AND rse.deleted_at IS NULL
          GROUP BY rse.role_id
        ),

        -- current values from employee_role_competency via employees.primary_role_id
        er_rows AS (
          SELECT
            e.primary_role_id AS role_id,
            er.employee_id AS emp_id,
            er.current_level
          FROM public.employee_role_competency er
          JOIN public.employees e ON e.id = er.employee_id
          WHERE er.org_id = %(org_id)s
            AND e.org_id = %(org_id)s
        ),

        er_agg AS (
          SELECT
            role_id,
            AVG(NULLIF(current_level,0))::numeric(10,4) AS current_avg,
            COUNT(emp_id) AS current_count
          FROM er_rows
          GROUP BY role_id
        )

        SELECT
          r.id AS role_id,
          r.title AS key,
          er_agg.current_avg,
          rse_agg.expected_avg,
          COALESCE(er_agg.current_count, 0) AS count
        FROM public.roles r
        LEFT JOIN er_agg ON er_agg.role_id = r.id
        LEFT JOIN rse_agg ON rse_agg.role_id = r.id
        WHERE {role_filter}
        GROUP BY r.id, r.title, er_agg.current_avg, rse_agg.expected_avg, er_agg.current_count
        {having_sql}
        ORDER BY {order_sql}
        LIMIT %(limit)s OFFSET %(offset)s;
        """

        conn_ctx, is_ctx = _acquire_conn()
        rows = []
        if is_ctx:
            with conn_ctx as conn:
                cur = conn.cursor()
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
        else:
            conn = conn_ctx
            cur = conn.cursor()
            try:
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass

        if not rows:
            return []

        out = []
        for r in rows:
            out.append(
                {
                    "role_id": r.get("role_id"),
                    "key": r.get("key"),
                    "current_avg": _to_float(r.get("current_avg")),
                    "expected_avg": _to_float(r.get("expected_avg")),
                    "count": int(r.get("count") or 0),
                }
            )
        return out
    except Exception:
        logger.exception("list_role_averages failed")
        raise

def list_department_averages(
    org_id: str,
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "dept",
    min_count: Optional[int] = None,
) -> List[dict]:
    """
    Department-anchored aggregates:
      - current_avg: avg current_level for employees in that department (via employee_role_competency)
      - expected_avg: avg expected_level for role_competency_expectations for roles in that department
    """
    try:
        params = {"org_id": org_id, "limit": limit, "offset": offset}
        dept_filter = "d.organization_id = %(org_id)s"

        if q:
            params["q"] = f"%{q}%"
            dept_filter += " AND d.name ILIKE %(q)s"

        order_sql = "key ASC"
        if sort == "current_desc":
            order_sql = "current_avg DESC NULLS LAST"
        elif sort == "current_asc":
            order_sql = "current_avg ASC NULLS LAST"
        elif sort == "expected_desc":
            order_sql = "expected_avg DESC NULLS LAST"
        elif sort == "expected_asc":
            order_sql = "expected_avg ASC NULLS LAST"
        elif sort == "gap_desc":
            order_sql = "(COALESCE(expected_avg,0) - COALESCE(current_avg,0)) DESC"
        elif sort == "gap_asc":
            order_sql = "(COALESCE(expected_avg,0) - COALESCE(current_avg,0)) ASC"

        having_sql = ""
        if min_count is not None:
            params["min_count"] = int(min_count)
            having_sql = "HAVING COUNT(er_rows.emp_id) >= %(min_count)s"

        sql = f"""
        WITH
        -- expected values aggregated per role, then rolled up by department
        rse_per_role AS (
          SELECT rse.role_id, AVG(rse.expected_level)::numeric(10,4) AS expected_avg_role
          FROM public.role_competency_expectations rse
          WHERE rse.organization_id = %(org_id)s
            AND rse.is_active = TRUE
            AND rse.deleted_at IS NULL
          GROUP BY rse.role_id
        ),

        expected_by_dept AS (
          SELECT
            r.department_id,
            AVG(rse_per_role.expected_avg_role)::numeric(10,4) AS expected_avg
          FROM public.roles r
          LEFT JOIN rse_per_role ON rse_per_role.role_id = r.id
          WHERE r.organization_id = %(org_id)s
          GROUP BY r.department_id
        ),

        -- current rows per employee (using employee_role_competency)
        er_rows AS (
          SELECT
            e.department_id,
            er.employee_id AS emp_id,
            er.current_level
          FROM public.employee_role_competency er
          JOIN public.employees e ON e.id = er.employee_id
          WHERE er.org_id = %(org_id)s
            AND e.org_id = %(org_id)s
        ),

        current_by_dept AS (
          SELECT
            department_id,
            AVG(NULLIF(current_level,0))::numeric(10,4) AS current_avg,
            COUNT(emp_id) AS current_count
          FROM er_rows
          GROUP BY department_id
        )

        SELECT
          d.id AS department_id,
          COALESCE(d.name, 'Unassigned') AS key,
          current_by_dept.current_avg,
          expected_by_dept.expected_avg,
          COALESCE(current_by_dept.current_count, 0) AS count
        FROM public.departments d
        LEFT JOIN current_by_dept ON current_by_dept.department_id = d.id
        LEFT JOIN expected_by_dept ON expected_by_dept.department_id = d.id
        WHERE {dept_filter}
        GROUP BY d.id, d.name, current_by_dept.current_avg, expected_by_dept.expected_avg, current_by_dept.current_count
        {having_sql}
        ORDER BY {order_sql}
        LIMIT %(limit)s OFFSET %(offset)s;
        """

        conn_ctx, is_ctx = _acquire_conn()
        rows = []
        if is_ctx:
            with conn_ctx as conn:
                cur = conn.cursor()
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
        else:
            conn = conn_ctx
            cur = conn.cursor()
            try:
                cur.execute(sql, params)
                raw = cur.fetchall()
                cols = [c[0] for c in cur.description] if cur.description else []
                rows = [dict(zip(cols, tup)) for tup in raw] if raw else []
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass

        if not rows:
            return []

        out = []
        for r in rows:
            out.append(
                {
                    "department_id": (r.get("department_id") if r.get("department_id") is not None else None),
                    "key": r.get("key"),
                    "current_avg": _to_float(r.get("current_avg")),
                    "expected_avg": _to_float(r.get("expected_avg")),
                    "count": int(r.get("count") or 0),
                }
            )
        return out
    except Exception:
        logger.exception("list_department_averages failed")
        raise

def get_matrix_summary(org_id: str) -> dict:
    try:
        sql = """
        SELECT
          (SELECT COUNT(*) FROM competencys c WHERE c.organization_id = %(org_id)s AND c.is_active) AS total_competencies,
          (SELECT COUNT(*) FROM employees e WHERE e.org_id = %(org_id)s AND e.status='active') AS total_employees,
          (SELECT COUNT(*) FROM employee_role_competency er WHERE er.org_id = %(org_id)s AND er.current_level IS NOT NULL AND er.current_level > 0) AS filled_cells,
          (
            SELECT ROUND(100.0 * (COUNT(*) FILTER (WHERE er.current_level IS NOT NULL AND er.current_level > 0)::numeric) /
            GREATEST(1, (SELECT COUNT(*) FROM employees e WHERE e.org_id = %(org_id)s) * (SELECT COUNT(*) FROM competencys c WHERE c.organization_id = %(org_id)s)), 2)
            FROM employee_role_competency er
            WHERE er.org_id = %(org_id)s
          ) AS coverage_pct;
        """
        params = {"org_id": org_id}
        conn_ctx, is_ctx = _acquire_conn()
        r = None
        if is_ctx:
            with conn_ctx as conn:
                cur = conn.cursor()
                cur.execute(sql, params)
                r = cur.fetchone()
        else:
            conn = conn_ctx
            cur = conn.cursor()
            try:
                cur.execute(sql, params)
                r = cur.fetchone()
            finally:
                cur.close()
                try:
                    conn.close()
                except Exception:
                    pass

        if not r:
            # return a sensible default summary
            return {"total_competencies": 0, "total_employees": 0, "filled_cells": 0, "coverage_pct": 0.0}

        if isinstance(r, dict):
            return {
                "total_competencies": int(r.get("total_competencies") or 0),
                "total_employees": int(r.get("total_employees") or 0),
                "filled_cells": int(r.get("filled_cells") or 0),
                "coverage_pct": float(r.get("coverage_pct")) if r.get("coverage_pct") is not None else 0.0,
            }
        else:
            # tuple
            return {
                "total_competencies": int(r[0] or 0),
                "total_employees": int(r[1] or 0),
                "filled_cells": int(r[2] or 0),
                "coverage_pct": float(r[3]) if r[3] is not None else 0.0,
            }
    except Exception:
        logger.exception("get_matrix_summary failed")
        raise
