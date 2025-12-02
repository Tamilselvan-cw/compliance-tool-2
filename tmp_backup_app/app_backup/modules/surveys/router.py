from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, status, Request
from typing import Optional
from uuid import UUID

from .schemas import SurveyCreate, SurveyUpdate, SurveyOut, SurveyListOut
from . import service

router = APIRouter(prefix="/organizations", tags=["Surveys"])


def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)


def _uid(request: Request) -> Optional[UUID]:
    # adapt to your auth middleware (e.g., request.state.user_id)
    return getattr(request.state, "user_id", None)


# Create
@router.post(
    "/{org_id}/surveys",
    response_model=SurveyOut,
    status_code=status.HTTP_201_CREATED,
)
def create_survey(
    org_id: UUID,
    payload: SurveyCreate,
    request: Request,
):
    try:
        return service.create_survey(org_id, payload.model_dump(), actor_user_id=_uid(request))
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# List
@router.get(
    "/{org_id}/surveys",
    response_model=SurveyListOut,
)
def list_surveys(
    org_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    status: Optional[str] = Query(None, pattern="^(draft|active|closed)$"),
    search: Optional[str] = Query(None, min_length=1, max_length=200),
):
    try:
        items, total = service.list_surveys(org_id, page, limit, status, search)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# Get by id (your UI calls this: must return { id, ... })
@router.get(
    "/{org_id}/surveys/{survey_id}",
    response_model=SurveyOut,
)
def get_survey(org_id: UUID, survey_id: UUID):
    try:
        return service.get_survey(org_id, survey_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))


# Update
@router.patch(
    "/{org_id}/surveys/{survey_id}",
    response_model=SurveyOut,
)
def update_survey(
    org_id: UUID,
    survey_id: UUID,
    payload: SurveyUpdate,
    request: Request,
):
    try:
        return service.update_survey(org_id, survey_id, payload.model_dump(exclude_unset=True), actor_user_id=_uid(request))
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# Delete
@router.delete(
    "/{org_id}/surveys/{survey_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_survey(org_id: UUID, survey_id: UUID):
    try:
        service.delete_survey(org_id, survey_id)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))
