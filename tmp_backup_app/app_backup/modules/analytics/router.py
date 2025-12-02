# routers/analytics.py
from __future__ import annotations
from uuid import UUID
from . import service   # adjust to your project layout
from .schemas import (
    SkillTrendItem,
    RoleAverageItem,
    DepartmentAverageItem,
    MatrixSummary,
)
import logging

from fastapi import APIRouter, HTTPException, Query, Request
from app.deps.clients import get_supabase_service 
from typing import Dict, Any, List, Optional
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["analytics"])


@router.get("/{org_id}/analytics/skill-trends", response_model=List[SkillTrendItem])
def get_skill_trends(
    org_id: UUID,
    q: Optional[str] = Query(None, description="search competency name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort: str = Query("key", description="key|current_desc|current_asc|gap_desc|gap_asc"),
    min_count: Optional[int] = Query(None, ge=1, description="minimum number of records per skill"),
):
    try:
        rows = service.list_skill_trends(
            org_id=str(org_id),
            q=q,
            limit=limit,
            offset=offset,
            sort=sort,
            min_count=min_count,
        )
        # Defensive: ensure a list is returned
        if rows is None:
            logger.warning("service.list_skill_trends returned None, returning empty list")
            return []
        if not isinstance(rows, list):
            raise HTTPException(status_code=500, detail="analytics service returned unexpected type for skill-trends")
        return rows
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch skill trends")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{org_id}/analytics/role-averages", response_model=List[RoleAverageItem])
def get_role_averages(
    org_id: UUID,
    q: Optional[str] = Query(None, description="search role title"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort: str = Query("role", description="role|current_desc|current_asc|gap_desc|gap_asc"),
    min_count: Optional[int] = Query(None, ge=1),
):
    try:
        rows = service.list_role_averages(
            org_id=str(org_id),
            q=q,
            limit=limit,
            offset=offset,
            sort=sort,
            min_count=min_count,
        )
        if rows is None:
            logger.warning("service.list_role_averages returned None, returning empty list")
            return []
        if not isinstance(rows, list):
            raise HTTPException(status_code=500, detail="analytics service returned unexpected type for role-averages")
        return rows
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch role averages")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{org_id}/analytics/department-averages", response_model=List[DepartmentAverageItem])
def get_department_averages(
    org_id: UUID,
    q: Optional[str] = Query(None, description="search department name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort: str = Query("dept", description="dept|current_desc|current_asc|gap_desc|gap_asc"),
    min_count: Optional[int] = Query(None, ge=1),
):
    try:
        rows = service.list_department_averages(
            org_id=str(org_id),
            q=q,
            limit=limit,
            offset=offset,
            sort=sort,
            min_count=min_count,
        )
        if rows is None:
            logger.warning("service.list_department_averages returned None, returning empty list")
            return []
        if not isinstance(rows, list):
            raise HTTPException(status_code=500, detail="analytics service returned unexpected type for department-averages")
        return rows
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch department averages")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{org_id}/analytics/matrix-summary", response_model=MatrixSummary)
def get_matrix_summary(org_id: UUID):
    try:
        summary = service.get_matrix_summary(org_id=str(org_id))
        if summary is None:
            logger.warning("service.get_matrix_summary returned None, returning zeroed summary")
            # return a safe empty summary shape
            return {
                "total_competencies": 0,
                "total_employees": 0,
                "filled_cells": 0,
                "coverage_pct": 0.0,
            }
        if not isinstance(summary, dict):
            raise HTTPException(status_code=500, detail="analytics service returned unexpected type for matrix-summary")
        return summary
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch matrix summary")
        raise HTTPException(status_code=500, detail=str(e))



# app/modules/competency/router.py



# ---------- helpers ----------
def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)

def _uid(request: Request) -> Optional[UUID]:
    return getattr(request.state, "user_id", None)

def _rpc(name: str, params: dict):
    try:
        sb = get_supabase_service()  # lazy get per call (safe singleton)
        res = sb.rpc(name, params).execute()
        data = res.data
        # supabase-py can wrap scalar/row in a list
        if isinstance(data, list):
            return data[0] if data else None
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{name.upper()}_ERR: {_err(e)}")

def _latest_cm_id(org_id: UUID, status: Optional[str] = None) -> str:
    cm_id = _rpc("fn_cm_latest_id", {"p_org": str(org_id), "p_status": status})
    if not cm_id:
        raise HTTPException(status_code=404, detail="No competency matrix found for org")
    return cm_id


# =========================
# Analytics Endpoints
# =========================

# 1) Organization's latest competency_matrix analysis
@router.get("/{org_id}/competency-analytics/latest")
def org_latest_analysis(
    org_id: UUID,
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter latest by status (e.g. 'active')"),
    only_with_expectations: bool = Query(False, description="Ignore rows without expected_level when true"),
    role_id: Optional[UUID] = Query(None),
    competency_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
):
    try:
        _ = _uid(request)  # available if you later need actor info
        cm_id = _latest_cm_id(org_id, status_filter)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": cm_id,
            "p_role": str(role_id) if role_id else None,
            "p_competency": str(competency_id) if competency_id else None,
            "p_employee": None,
            "p_department_id": str(department_id) if department_id else None,
            "p_only_with_expectations": only_with_expectations,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 2) Organization's competency gap across all competency_matrices (trend)
@router.get("/{org_id}/competency-analytics/trend/competencys")
def org_competency_trend(
    org_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
    role_id: Optional[UUID] = Query(None, description="Optional role filter"),
):
    try:
        _ = _uid(request)
        return _rpc("fn_cm_trend", {
            "p_org": str(org_id),
            "p_group": "competency",
            "p_role": str(role_id) if role_id else None,
            "p_competency": None,
            "p_employee": None,
            "p_department_id": None,
            "p_only_with_expectations": only_with_expectations,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 3) Survey-wise analytics
@router.get("/{org_id}/competency-analytics/surveys/{cm_id}")
def survey_analysis(
    org_id: UUID,
    cm_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
    role_id: Optional[UUID] = Query(None),
    competency_id: Optional[UUID] = Query(None),
    employee_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
):
    try:
        _ = _uid(request)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": str(cm_id),
            "p_role": str(role_id) if role_id else None,
            "p_competency": str(competency_id) if competency_id else None,
            "p_employee": str(employee_id) if employee_id else None,
            "p_department_id": str(department_id) if department_id else None,
            "p_only_with_expectations": only_with_expectations,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 4) Role-wise analytics (defaults to latest survey if cm_id omitted)
@router.get("/{org_id}/competency-analytics/roles/{role_id}")
def role_analysis(
    org_id: UUID,
    role_id: UUID,
    request: Request,
    cm_id: Optional[UUID] = Query(None),
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        cm = str(cm_id) if cm_id else _latest_cm_id(org_id)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": cm,
            "p_role": str(role_id),
            "p_competency": None,
            "p_employee": None,
            "p_department_id": None,
            "p_only_with_expectations": only_with_expectations,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 5) competency-wise analytics (defaults to latest survey if cm_id omitted)
@router.get("/{org_id}/competency-analytics/competencys/{competency_id}")
def competency_analysis(
    org_id: UUID,
    competency_id: UUID,
    request: Request,
    cm_id: Optional[UUID] = Query(None),
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        cm = str(cm_id) if cm_id else _latest_cm_id(org_id)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": cm,
            "p_role": None,
            "p_competency": str(competency_id),
            "p_employee": None,
            "p_department_id": None,
            "p_only_with_expectations": only_with_expectations,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 6) Individual-wise latest survey's analytics
@router.get("/{org_id}/competency-analytics/employees/{employee_id}/latest")
def employee_latest_analysis(
    org_id: UUID,
    employee_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        cm = _latest_cm_id(org_id)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": cm,
            "p_role": None,
            "p_competency": None,
            "p_employee": str(employee_id),
            "p_department_id": None,
            "p_only_with_expectations": only_with_expectations,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 7) Individual-wise competency gap trend across all surveys
@router.get("/{org_id}/competency-analytics/employees/{employee_id}/trend/competencys")
def employee_competency_trend(
    org_id: UUID,
    employee_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        return _rpc("fn_cm_trend", {
            "p_org": str(org_id),
            "p_group": "competency",
            "p_role": None,
            "p_competency": None,
            "p_employee": str(employee_id),
            "p_department_id": None,
            "p_only_with_expectations": only_with_expectations,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 8) Department's latest competency_matrix analytics
@router.get("/{org_id}/competency-analytics/departments/{department_id}/latest")
def department_latest_analysis(
    org_id: UUID,
    department_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        cm = _latest_cm_id(org_id)
        return _rpc("fn_cm_analysis", {
            "p_org": str(org_id),
            "p_cm": cm,
            "p_role": None,
            "p_competency": None,
            "p_employee": None,
            "p_department_id": str(department_id),
            "p_only_with_expectations": only_with_expectations,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# 9) Department's trend across all surveys
@router.get("/{org_id}/competency-analytics/departments/{department_id}/trend")
def department_trend(
    org_id: UUID,
    department_id: UUID,
    request: Request,
    only_with_expectations: bool = Query(False),
):
    try:
        _ = _uid(request)
        return _rpc("fn_cm_trend", {
            "p_org": str(org_id),
            "p_group": "department",
            "p_role": None,
            "p_competency": None,
            "p_employee": None,
            "p_department_id": str(department_id),
            "p_only_with_expectations": only_with_expectations,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

from app.db.session import get_conn

def _row(cur):
    return cur.fetchone()


def _rows(cur):
    return cur.fetchall()

@router.get("/{org_id}/surveys/{survey_id}/skill-matrix")
def get_skill_matrix(org_id: UUID, survey_id: UUID) -> Dict[str, Any]:
    """
    Skill matrix for an org + survey (competency_matrix_id = survey_id).
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Levels
            cur.execute(
                """
                select id, name, score, description
                from levels
                where organization_id = %s
                  and is_active = true
                order by score
                """,
                [str(org_id)],
            )
            levels = _rows(cur)

            # Departments
            cur.execute(
                """
                select d.id, d.name
                from departments d
                where d.organization_id = %s
                order by d.name
                """,
                [str(org_id)],
            )
            departments = _rows(cur)

            # Employees
            cur.execute(
                """
                select
                    e.id,
                    e.name,
                    e.email,
                    e.department_id,
                    d.name as department_name,
                    e.primary_role_id,
                    r.title as primary_role_title
                from employees e
                left join departments d on d.id = e.department_id
                left join roles r on r.id = e.primary_role_id
                where e.org_id = %s
                order by e.name
                """,
                [str(org_id)],
            )
            employees = _rows(cur)

            # Competencies (org-specific + CORE/global)
            #  -> also attach roles (from role_competency_expectations) per competency
            cur.execute(
                """
                select
                    c.id,
                    c.name as competency_name,
                    c.category,
                    coalesce(
                        (
                            select jsonb_agg(
                                       jsonb_build_object(
                                           'role_id', rce.role_id,
                                           'expected_level', rce.expected_level
                                       )
                                   )
                            from role_competency_expectations rce
                            where rce.organization_id = %s
                              and rce.competency_id = c.id
                              and rce.deleted_at is null
                        ),
                        '[]'::jsonb
                    ) as roles
                from competencys c
                where (c.organization_id = %s or c.organization_id is null)
                  and coalesce(c.is_active, true) = true
                order by c.name
                """,
                [str(org_id), str(org_id)],
            )
            competencys = _rows(cur)

            # Matrix cells – current + expected + role_id
            cur.execute(
                """
                select
                    erc.employee_id,
                    erc.competency_id,
                    erc.role_id,
                    erc.current_level,
                    coalesce(erc.expected_level, rce.expected_level) as expected_level,
                    erc.remarks
                from employee_role_competency erc
                left join role_competency_expectations rce
                    on rce.organization_id = erc.org_id
                   and rce.role_id = erc.role_id
                   and rce.competency_id = erc.competency_id
                   and rce.deleted_at is null
                where erc.org_id = %s
                """,
                [str(org_id)],
            )
            cells = _rows(cur)

            # Flat role_expectations list (for frontend roleExpectationMap)
            cur.execute(
                """
                select
                    rce.role_id,
                    rce.competency_id,
                    rce.expected_level
                from role_competency_expectations rce
                where rce.organization_id = %s
                  and rce.deleted_at is null
                """,
                [str(org_id)],
            )
            role_expectations = _rows(cur)

            return {
                "org_id": str(org_id),
                "survey_id": str(survey_id),
                # "title": title,  # if you add survey name later
                "levels": levels,
                "departments": departments,
                "employees": employees,
                "competencys": competencys,
                "cells": cells,
                "role_expectations": role_expectations,
            }


from pydantic import BaseModel, Field, conint

class SkillMatrixCellUpdate(BaseModel):
    employee_id: UUID
    competency_id: UUID
    role_id: UUID | None = None
    current_level: conint(ge=1, le=10)
    remarks: str | None = None


@router.post("/{org_id}/surveys/{survey_id}/skill-matrix/cell")
def upsert_skill_matrix_cell(
    org_id: UUID,
    survey_id: UUID,
    payload: SkillMatrixCellUpdate,
    # current_user: User = Depends(get_current_user)  # if you have auth
):
    with get_conn() as conn:
        # try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # If role_id is not provided, fall back to employee.primary_role_id
                role_id = payload.role_id
                if role_id is None:
                    cur.execute(
                        "select primary_role_id from employees where id = %s and org_id = %s",
                        [str(payload.employee_id), str(org_id)],
                    )
                    row = cur.fetchone()
                    if not row or not row["primary_role_id"]:
                        raise HTTPException(
                            status_code=400,
                            detail="No role_id provided and employee has no primary_role_id",
                        )
                    role_id = row["primary_role_id"]

                cur.execute(
                    """
                    insert into employee_role_competency (
                    org_id,
                    employee_id,
                    role_id,
                    competency_id,
                    competency_matrix_id,
                    current_level,
                    remarks,
                    updated_by
                    ) values (
                    %(org_id)s,
                    %(employee_id)s,
                    %(role_id)s,
                    %(competency_id)s,
                    %(cm_id)s,
                    %(current_level)s,
                    %(remarks)s,
                    %(updated_by)s
                    )
                    on conflict (org_id, employee_id, role_id, competency_matrix_id, competency_id)
                    do update set
                    current_level = excluded.current_level,
                    remarks = excluded.remarks,
                    updated_by = excluded.updated_by,
                    updated_at = now()
                    returning *
                    """,
                    {
                        "org_id": str(org_id),
                        "employee_id": str(payload.employee_id),
                        "role_id": str(role_id),
                        "competency_id": str(payload.competency_id),
                        "cm_id": str(survey_id),
                        "current_level": payload.current_level,
                        "remarks": payload.remarks,
                        # "updated_by": str(current_user.id),
                        "updated_by": None,
                    },
                )
                row = cur.fetchone()
                conn.commit()
                return row
        # finally:
        #     conn.close()
