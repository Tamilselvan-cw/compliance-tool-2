# # router.py
# from __future__ import annotations
# from fastapi import APIRouter, HTTPException, Query, status, Request
# from typing import Optional
# from uuid import UUID
# from .schemas import (
#     ERSCreateByName, ERSCreateById, ERSBulkUpsertByName, ERSBulkUpsertById,
#     ERSListOut, EmployeeRolecompetencyOut,
# )
# from . import service

# router = APIRouter(prefix="/organizations", tags=["Employee Role competencys"])

# def _err(e: Exception) -> str:
#     return getattr(e, "message", None) or str(e)

# def _uid(request: Request) -> Optional[UUID]:
#     return getattr(request.state, "user_id", None)

# # List (matrix-scoped)
# @router.get(
#     "/{org_id}/employees/{employee_id}/roles/{role_id}/matrices/{cm_id}/competencys",
#     response_model=ERSListOut,
# )
# def list_employee_role_competencys(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     page: int = Query(1, ge=1),
#     limit: int = Query(100, ge=1, le=1000),
#     category: Optional[str] = Query(None, pattern="^(technical|functional|behavioral)$"),
#     search: Optional[str] = Query(None, min_length=1, max_length=200),
# ):
#     try:
#         items, total = service.list_employee_role_competencys(
#             org_id, employee_id, role_id, cm_id, page, limit, category, search
#         )
#         return {"items": items, "total": total, "page": page, "limit": limit}
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=_err(e))

# # Upsert (by name) — matrix-scoped
# @router.post(
#     "/{org_id}/employees/{employee_id}/roles/{role_id}/matrices/{cm_id}/competencys",
#     response_model=EmployeeRolecompetencyOut,
#     status_code=status.HTTP_201_CREATED,
# )
# def upsert_employee_competency_by_name(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     payload: ERSCreateByName,
#     request: Request,
# ):
#     try:
#         return service.upsert_by_name(
#             org_id, employee_id, role_id, cm_id, payload.model_dump(), actor_user_id=_uid(request)
#         )
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=_err(e))

# # Upsert (by id) — matrix-scoped
# @router.post(
#     "/{org_id}/employees/{employee_id}/roles/{role_id}/matrices/{cm_id}/competencys/by-id",
#     response_model=EmployeeRolecompetencyOut,
#     status_code=status.HTTP_201_CREATED,
# )
# def upsert_employee_competency_by_id(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     payload: ERSCreateById,
#     request: Request,
# ):
#     try:
#         return service.upsert_by_id(
#             org_id, employee_id, role_id, cm_id, payload.model_dump(), actor_user_id=_uid(request)
#         )
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=_err(e))

# # Bulk upsert (by name) — matrix-scoped
# @router.post(
#     "/{org_id}/employees/{employee_id}/roles/{role_id}/matrices/{cm_id}/competencys/bulk",
#     status_code=status.HTTP_201_CREATED,
# )
# def bulk_upsert_employee_competencys_by_name(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     payload: ERSBulkUpsertByName,
#     request: Request,
# ):
#     try:
#         inserted = service.bulk_upsert_by_name(
#             org_id, employee_id, role_id, cm_id,
#             [it.model_dump() for it in payload.items],
#             actor_user_id=_uid(request),
#         )
#         return {"inserted": inserted, "count": len(inserted)}
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=_err(e))

# # Delete — matrix-scoped
# @router.delete(
#     "/{org_id}/employees/{employee_id}/roles/{role_id}/matrices/{cm_id}/competencys/{ers_id}",
#     status_code=status.HTTP_204_NO_CONTENT,
# )
# def delete_employee_role_competency(
#     org_id: UUID,
#     employee_id: UUID,
#     role_id: UUID,
#     cm_id: UUID,
#     ers_id: UUID,
# ):
#     try:
#         service.delete_employee_role_competency(org_id, employee_id, role_id, cm_id, ers_id)
#         return None
#     except Exception as e:
#         raise HTTPException(status_code=404, detail=_err(e))



# app/modules/employee_role_skill/router.py

# app/modules/employee_role_competency/router.py
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, status
from pydantic import BaseModel, Field

from . import service


router = APIRouter(prefix="/organizations", tags=["Employee Role Competency"])


def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)


class EmployeeRoleCompetencyItemIn(BaseModel):
    role_id: UUID
    competency_id: UUID
    level: int = Field(..., ge=0)   # API field
    remarks: str | None = None


class EmployeeRoleCompetencyBulkIn(BaseModel):
    employee_id: UUID
    items: List[EmployeeRoleCompetencyItemIn]


class EmployeeRoleCompetencyOut(BaseModel):
    id: UUID
    employee_id: UUID
    role_id: UUID
    competency_id: UUID
    level: int                       # exposed as `level`
    remarks: str | None = None


class EmployeeRoleCompetencyListOut(BaseModel):
    items: List[EmployeeRoleCompetencyOut]


@router.get(
    "/{org_id}/employees/{employee_id}/role-competency",
    response_model=EmployeeRoleCompetencyListOut,
)
def get_employee_role_competency(
    org_id: UUID = Path(..., description="Organization ID"),
    employee_id: UUID = Path(..., description="Employee ID"),
):
    """
    Returns all competency mappings for a specific employee.
    Used by EmployeeDetailPage to pre-fill `existingSkills`.
    """
    try:
        rows = service.list_for_employee(org_id, employee_id)
        return {"items": rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.post(
    "/{org_id}/employee-role-competency/bulk",
    status_code=status.HTTP_204_NO_CONTENT,
)
def bulk_upsert_employee_role_competency(
    org_id: UUID,
    payload: EmployeeRoleCompetencyBulkIn,
):
    """
    Bulk save competency mappings for an employee (no survey_id).
    Called from EmployeeDetailPage after saving employee.
    """
    try:
        service.bulk_upsert_for_employee(
            org_id,
            payload.employee_id,
            payload.items,  # now accepted directly by the service
        )
        return
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))
