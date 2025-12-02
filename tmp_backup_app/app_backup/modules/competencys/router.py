from fastapi import APIRouter, Query, HTTPException, status
from uuid import UUID
from typing import Optional
from . import service
from .schemas import (
    competencyCreate,
    competencyUpdate,
    competencyOut,
    competencyListOut,
    SkillCategory,
    competencyBulkCreate,
)

router = APIRouter(prefix="/competencys", tags=["competencys"])


def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)


# CREATE (single). org_id optional via query OR via payload.organization_id.
@router.post("/competencys", response_model=competencyOut, status_code=status.HTTP_201_CREATED)
def create_competency(payload: competencyCreate, org_id: Optional[UUID] = Query(None)):
    try:
        scope = (payload.scope or "").strip()
        if scope != "core" and org_id is None and not getattr(payload, "organization_id", None):
            raise HTTPException(status_code=400, detail="org_id is required when scope != 'core'")

        return service.create_competency_for_org(org_id, payload.model_dump(), actor_user_id=None)
    except HTTPException:
        raise
    except Exception as e:
        msg = _err(e)
        code = 409 if any(k in msg.lower() for k in ("duplicate", "unique", "exists", "conflict")) else 400
        raise HTTPException(status_code=code, detail=msg)


# BULK CREATE — accepts optional org_id query; individual items may contain organization_id.
# We also keep a convenience path that accepts explicit org_id in path for org-targeted bulk, but it's not required.
@router.post("/competencys/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_competencys(payload: competencyBulkCreate, org_id: Optional[UUID] = Query(None)):
    try:
        return service.bulk_create_compencys(org_id, payload.items, actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.post("/{org_id}/competencys/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_competencys_for_org(org_id: UUID, payload: competencyBulkCreate):
    try:
        return service.bulk_create_compencys(org_id, payload.items, actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# LIST — optional org_id (query). If org_id omitted this returns only core (scope='core').
@router.get("/competencys", response_model=competencyListOut)
def list_compencys_optional(
    org_id: Optional[UUID] = Query(None, description="Optional org id — omit for superadmin/core-only view"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    category: Optional[SkillCategory] = Query(None, description="technical / functional / behavioral"),
    scope: Optional[str] = Query(None, description="Optional scope filter (e.g. core)"),
):
    try:
        items, total = service.list_compencys(org_id, page, limit, q, category, scope=scope)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


# GET single — optional org context in query.
@router.get("/competencys/{competency_id}", response_model=competencyOut)
def get_competency_optional_org(competency_id: UUID, org_id: Optional[UUID] = Query(None)):
    try:
        return service.get_competency(org_id, competency_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))


# PATCH single — optional org context in query or in the payload
@router.patch("/competencys/{competency_id}", response_model=competencyOut)
def update_competency_optional_org(competency_id: UUID, payload: competencyUpdate, org_id: Optional[UUID] = Query(None)):
    try:
        return service.update_competency(org_id, competency_id, payload.model_dump(exclude_unset=True), actor_user_id=None)
    except Exception as e:
        msg = _err(e)
        code = 409 if any(k in msg.lower() for k in ("duplicate", "unique", "exists", "conflict")) else 400
        raise HTTPException(status_code=code, detail=msg)


# DELETE single — optional org context in query
@router.delete("/competencys/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_competency_optional_org(competency_id: UUID, org_id: Optional[UUID] = Query(None), soft: bool = Query(True)):
    try:
        service.delete_competency(org_id, competency_id, soft=soft)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))
