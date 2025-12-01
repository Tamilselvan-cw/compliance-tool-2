# app/modules/core_competencys/router.py
from fastapi import APIRouter, HTTPException, Query, status
from uuid import UUID

from .schemas import (
    CoreCompetencyCreate,
    CoreCompetencyUpdate,
    CoreCompetencyOut,
    CoreCompetencyListOut,
)
from . import service

router = APIRouter(prefix="/core-competencys", tags=["core_competencys"])


def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)


@router.post(
    "",
    response_model=CoreCompetencyOut,
    status_code=status.HTTP_201_CREATED,
)
def create_core_competency(payload: CoreCompetencyCreate):
    try:
        return service.create_core_competency(payload.model_dump(), actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.get(
    "",
    response_model=CoreCompetencyListOut,
)
def list_core_competencys(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    try:
        items, total = service.list_core_competencys(page, limit)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.patch(
    "/{core_id}",
    response_model=CoreCompetencyOut,
)
def update_core_competency(core_id: UUID, payload: CoreCompetencyUpdate):
    try:
        return service.update_core_competency(core_id, payload.model_dump(exclude_unset=True), actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.delete(
    "/{core_competency_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_core_competency(
    core_competency_id: UUID,
    soft: bool = Query(True),
):
    try:
        service.delete_core_competency(core_competency_id, soft=soft)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))
