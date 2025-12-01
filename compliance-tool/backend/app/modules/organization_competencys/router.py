from fastapi import APIRouter, Query, HTTPException, status
from uuid import UUID

from . import service
from .schemas import (
    OrgCompetencyCreate,
    OrgCompetencyUpdate,
    OrgCompetencyOut,
    OrgCompetencyListOut,
)

router = APIRouter(prefix="/organizations", tags=["org_competencys"])


def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)


@router.post(
    "/{org_id}/organization-competencys",
    response_model=OrgCompetencyOut,
    status_code=status.HTTP_201_CREATED,
)
def create_org_competency(org_id: UUID, payload: OrgCompetencyCreate):
    try:
        return service.create_org_competency_for_org(org_id, payload.model_dump(), actor_user_id=None)
    except Exception as e:
        msg = _err(e)
        code = 409 if any(k in msg.lower() for k in ("duplicate", "unique", "exists", "conflict")) else 400
        raise HTTPException(status_code=code, detail=msg)


@router.get(
    "/{org_id}/organization-competencys",
    response_model=OrgCompetencyListOut,
)
def list_org_competencys(org_id: UUID, page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200)):
    try:
        items, total = service.list_org_competencys(org_id, page, limit)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.patch(
    "/{org_id}/organization-competencys/{org_competency_id}",
    response_model=OrgCompetencyOut,
)
def update_org_competency(org_id: UUID, org_competency_id: UUID, payload: OrgCompetencyUpdate):
    try:
        return service.update_org_competency(
            org_id,
            org_competency_id,
            payload.model_dump(exclude_unset=True),
            actor_user_id=None,
        )
    except Exception as e:
        msg = _err(e)
        code = 409 if any(k in msg.lower() for k in ("duplicate", "unique", "exists", "conflict")) else 400
        raise HTTPException(status_code=code, detail=msg)


@router.delete(
    "/{org_id}/organization-competencys/{org_competency_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_org_competency(org_id: UUID, org_competency_id: UUID, soft: bool = Query(True)):
    try:
        service.delete_org_competency(org_id, org_competency_id, soft=soft)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))
