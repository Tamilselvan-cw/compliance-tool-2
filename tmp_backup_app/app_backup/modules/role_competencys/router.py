from fastapi import APIRouter, HTTPException, Query, status, Request
from uuid import UUID
from typing import Optional
from .schemas import RolecompetencyCreate, RolecompetencyBulkCreate, RolecompetencyOut, RolecompetencyListOut
from . import service

router = APIRouter(prefix="/organizations", tags=["Role competencys"])

def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)

def _uid(request: Request) -> Optional[UUID]:
    return getattr(request.state, "user_id", None)  # adapt if your auth sets something else

@router.get("/{org_id}/roles/{role_id}/competencys", response_model=RolecompetencyListOut)
def list_role_competencys(org_id: UUID, role_id: UUID, page: int = Query(1, ge=1), limit: int = Query(500, ge=1, le=1000)):
    try:
        items, total = service.list_role_competencys(org_id, role_id, page, limit)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.post("/{org_id}/roles/{role_id}/competencys", response_model=RolecompetencyOut, status_code=status.HTTP_201_CREATED)
def add_role_competency(org_id: UUID, role_id: UUID, payload: RolecompetencyCreate, request: Request):
    try:
        return service.add_role_competency(org_id, role_id, payload.model_dump(), actor_user_id=_uid(request))
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.post(
    "/{org_id}/roles/{role_id}/competencys/bulk",
    status_code=status.HTTP_201_CREATED,
)
def bulk_upsert_role_competencies(
    org_id: UUID,
    role_id: UUID,
    payload: RolecompetencyBulkCreate,
):
    try:
        # actor_user_id=None for now; you can pass the real user later
        return service.bulk_upsert_role_competencies(
            org_id,
            role_id,
            [item.model_dump() for item in payload.items],
            actor_user_id=None,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.delete("/{org_id}/roles/{role_id}/competencys/{expectation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role_competency(org_id: UUID, role_id: UUID, expectation_id: UUID, soft: bool = Query(True)):
    try:
        service.delete_role_competency(org_id, role_id, expectation_id, soft=soft)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))
