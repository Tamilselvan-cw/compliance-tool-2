# app/modules/employees/heirarchy.py
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.db.session import get_conn
from app.modules.auth.service import get_current_user, MeOut  # adjust as needed

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organizations", tags=["hierarchy"])


def _to_float_safe(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def _safe_rows_to_dicts(
    cur_description: Optional[Tuple],
    raw_rows: List[Any],
    context: str = "<rows>",
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    cols: List[str] = []
    if cur_description:
        try:
            cols = [c[0] for c in cur_description]
        except Exception:
            cols = []
    else:
        if raw_rows:
            first = raw_rows[0]
            if isinstance(first, dict):
                cols = list(first.keys())

    for idx, tup in enumerate(raw_rows or []):
        try:
            if isinstance(tup, dict):
                out.append(dict(tup))
                continue

            if cols:
                row: Dict[str, Any] = {}
                for ci, col in enumerate(cols):
                    row[col] = tup[ci] if ci < len(tup) else None
                out.append(row)
            else:
                if hasattr(tup, "__iter__"):
                    row = {f"col_{i}": tup[i] if i < len(tup) else None for i in range(len(tup))}
                    out.append(row)
                else:
                    out.append({"value": tup})
        except IndexError as ie:
            logger.warning("IndexError converting row in %s at index %s: %s — row: %r", context, idx, ie, tup)
            row = {}
            if cur_description:
                for ci, col in enumerate([c[0] for c in cur_description]):
                    row[col] = tup[ci] if ci < len(tup) else None
            else:
                row = {"value": tup}
            out.append(row)
        except Exception as exc:
            logger.exception("Unexpected error while converting row in %s: %s — row: %r", context, exc, tup)
            out.append({"_error": str(exc), "_row": repr(tup)})
    return out


@router.get("/{org_id}/hierarchy")
def get_org_hierarchy(
    org_id: UUID,
    current_user: MeOut = Depends(get_current_user),
):
    """
    Returns hierarchical structure with per-employee competency aggregates.

    Each employee object includes `competency`:
      { current_avg, expected_avg, count, gap_value, gap_pct }
    """
    try:
        org_id_str = str(org_id)
        conn_ctx = get_conn()
        conn_is_ctx = hasattr(conn_ctx, "__enter__")

        if conn_is_ctx:
            conn = conn_ctx.__enter__()
            close_conn = True
        else:
            conn = conn_ctx
            close_conn = False

        cur = None
        try:
            cur = conn.cursor()

            # 1) Fetch employees basic data
            cur.execute(
                """
                SELECT
                  id::text,
                  name,
                  email,
                  job_title,
                  department,
                  role,
                  manager_id::text,
                  primary_role_id::text
                FROM public.employees
                WHERE org_id = %s
                """,
                (org_id_str,),
            )
            emp_rows = cur.fetchall()
            emp_dicts = _safe_rows_to_dicts(cur.description, emp_rows, context="employees")

            # 2) Fetch per-employee competency aggregates.
            # IMPORTANT: keep role_id as UUID when comparing to rse.role_id.
            cur.execute(
                """
                WITH e AS (
                  -- keep original UUIDs for role join; we only cast employee id to text for output mapping
                  SELECT id, primary_role_id
                  FROM public.employees
                  WHERE org_id = %s
                ),
                er_plus AS (
                  SELECT
                    er.employee_id::text AS employee_id,
                    NULLIF(er.current_level, 0)::numeric AS curr_lv,
                    -- expected_level: prefer ER row value; fallback to role expectation (UUID join)
                    COALESCE(er.expected_level, rse.expected_level)::numeric AS expected_lv
                  FROM public.employee_role_competency er
                  LEFT JOIN e ON e.id = er.employee_id
                  LEFT JOIN public.role_competency_expectations rse
                    ON rse.role_id = COALESCE(er.role_id, e.primary_role_id)
                    AND rse.competency_id = er.competency_id
                    AND rse.organization_id = %s
                    AND rse.is_active = TRUE
                    AND rse.deleted_at IS NULL
                  WHERE er.org_id = %s
                )
                SELECT
                  employee_id,
                  AVG(curr_lv)::numeric(10,4)   AS current_avg,
                  AVG(expected_lv)::numeric(10,4) AS expected_avg,
                  COUNT(*)                       AS cnt_rows
                FROM er_plus
                GROUP BY employee_id;
                """,
                # three params -> CTE e org_id, rse.organization_id, er.org_id
                (org_id_str, org_id_str, org_id_str),
            )
            agg_rows = cur.fetchall()
            agg_dicts = _safe_rows_to_dicts(cur.description, agg_rows, context="er_aggregates")

        finally:
            try:
                if cur:
                    cur.close()
            except Exception:
                pass
            if close_conn:
                try:
                    conn_ctx.__exit__(None, None, None)
                except Exception:
                    pass
            else:
                try:
                    conn.close()
                except Exception:
                    pass

        # Build employees map
        emp_by_id: Dict[str, Dict] = {}
        employees: List[Dict] = []
        for r in emp_dicts:
            eid = r.get("id")
            if not eid:
                logger.debug("Skipping malformed employee row: %r", r)
                continue
            r["id"] = str(eid)
            for fk in ("manager_id", "primary_role_id"):
                if r.get(fk) is not None:
                    r[fk] = str(r[fk])
            r.setdefault("reports", [])
            r["competency"] = {
                "current_avg": None,
                "expected_avg": None,
                "count": 0,
                "gap_value": None,
                "gap_pct": None,
            }
            employees.append(r)
            emp_by_id[r["id"]] = r

        # Attach aggregates defensively
        for a in agg_dicts:
            emp_id = a.get("employee_id")
            if emp_id is None:
                continue
            emp_id = str(emp_id)
            if emp_id not in emp_by_id:
                logger.warning("Aggregate for unknown employee_id %s: %r", emp_id, a)
                continue

            cur_avg = _to_float_safe(a.get("current_avg"))
            exp_avg = _to_float_safe(a.get("expected_avg"))
            cnt = int(a.get("cnt_rows") or 0)

            gap_value = None
            gap_pct = None
            if (cur_avg is not None) and (exp_avg is not None):
                gap_value = float(exp_avg - cur_avg)
                try:
                    if float(exp_avg) != 0:
                        gap_pct = float(((exp_avg - cur_avg) / exp_avg) * 100.0)
                    else:
                        gap_pct = None
                except Exception:
                    gap_pct = None

            emp_by_id[emp_id]["competency"] = {
                "current_avg": cur_avg,
                "expected_avg": exp_avg,
                "count": cnt,
                "gap_value": gap_value,
                "gap_pct": gap_pct,
            }

        # Build tree
        top_level_roots: List[Dict] = []
        for e in employees:
            mgr = e.get("manager_id")
            if mgr and mgr in emp_by_id:
                emp_by_id[mgr].setdefault("reports", []).append(e)
            else:
                top_level_roots.append(e)

        def _serialize(e: Dict) -> Dict:
            return {
                "id": e["id"],
                "name": e.get("name"),
                "email": e.get("email"),
                "job_title": e.get("job_title"),
                "department": e.get("department"),
                "role": e.get("role"),
                "manager_id": e.get("manager_id"),
                "primary_role_id": e.get("primary_role_id"),
                "competency": e.get("competency"),
                "reports": [_serialize(r) for r in e.get("reports", [])],
            }

        # Role-based trimming
        try:
            cu_role = getattr(current_user, "role", None)
            cu_employee_id = getattr(current_user, "employee_id", None)
            if cu_employee_id is not None:
                cu_employee_id = str(cu_employee_id)
        except Exception:
            cu_role = None
            cu_employee_id = None

        if cu_role and cu_role in ("org_manager", "hod") and cu_employee_id:
            subtree_root = emp_by_id.get(cu_employee_id)
            if subtree_root:
                return {"root": _serialize(subtree_root)}

        if len(top_level_roots) == 0:
            return {"root": None}
        if len(top_level_roots) == 1:
            return {"root": _serialize(top_level_roots[0])}

        virtual_root = {
            "id": f"virtual-root-{org_id_str}",
            "name": "Organization",
            "email": None,
            "job_title": None,
            "department": None,
            "role": "organization",
            "manager_id": None,
            "primary_role_id": None,
            "competency": None,
            "reports": top_level_roots,
        }
        return {"root": _serialize(virtual_root)}

    except Exception as exc:
        logger.exception("get_org_hierarchy failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
