# app/modules/levels/router.py
from fastapi import APIRouter, Query, Path, HTTPException, status
from typing import Optional
from uuid import UUID

from .schemas import LevelCreate, LevelUpdate, LevelOut, LevelListOut
from . import service

router = APIRouter(prefix="/organizations", tags=["Levels"])

@router.get("/{org_id}/levels", response_model=LevelListOut)
def list_levels(
    org_id: UUID = Path(..., description="Organization ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    q: Optional[str] = Query(None),
    only_active: bool = Query(True),
    order_by: str = Query("score"),
    ascending: bool = Query(True),
):
    # service expects str IDs internally
    items, total = service.list_levels(
        org_id=str(org_id),
        page=page,
        limit=limit,
        q=q,
        only_active=only_active,
        order_by=order_by,
        ascending=ascending,
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/{org_id}/levels/{level_id}", response_model=LevelOut)
def get_level(
    org_id: UUID = Path(..., description="Organization ID"),
    level_id: UUID = Path(..., description="Level ID"),
):
    return service.get_level(level_id=str(level_id), org_id=str(org_id))


@router.post("/{org_id}/levels", response_model=LevelOut, status_code=status.HTTP_201_CREATED)
def create_level(
    org_id: UUID = Path(..., description="Organization ID"),
    payload: LevelCreate = ...,
):
    # Only name/description/score come from body; org_id comes from path
    return service.create_level_for_org(org_id=str(org_id), data=payload.model_dump(), actor_payload=None)


@router.patch("/{org_id}/levels/{level_id}", response_model=LevelOut)
def update_level(
    org_id: UUID = Path(..., description="Organization ID"),
    level_id: UUID = Path(..., description="Level ID"),
    payload: LevelUpdate = ...,
):
    return service.update_level_for_org(
        org_id=str(org_id),
        level_id=str(level_id),
        payload=payload.model_dump(exclude_unset=True),
        actor_payload=None,
    )


@router.delete("/{org_id}/levels/{level_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_level(
    org_id: UUID = Path(..., description="Organization ID"),
    level_id: UUID = Path(..., description="Level ID"),
    soft: bool = Query(True),
):
    service.delete_level_for_org(
        org_id=str(org_id),
        level_id=str(level_id),
        soft=soft,
        actor_payload=None,
    )
    return None
