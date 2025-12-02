from fastapi import APIRouter, Query, HTTPException
from uuid import UUID
from typing import Optional
from . import service   # adjust relative import to your project layout
from .schemas import CompetencyDictListOut

router = APIRouter(prefix="/organizations", tags=["competency-dictionary"])

@router.get("/{org_id}/competency-dictionary", response_model=CompetencyDictListOut)
def get_competency_dictionary(
    org_id: UUID,
    page: int = Query(1, ge=1, description="1-indexed page"),
    limit: int = Query(25, ge=1, le=200, description="page size"),
    q: Optional[str] = Query(None, description="search in competency/role/department/name/code"),
    category: Optional[str] = Query(None, description="filter by competency category (technical/functional/behavioral)"),
    expected_level: Optional[int] = Query(None, ge=1, le=5),
    role_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
    scope: Optional[str] = Query(None, description="filter by competency scope (e.g. core, role_based, organization)"),
):
    try:
        items, total = service.list_competency_dictionary(
            org_id=org_id,
            page=page,
            limit=limit,
            q=q,
            category=category,
            expected_level=expected_level,
            role_id=role_id,
            department_id=department_id,
            scope=scope,    # <-- forward scope
        )
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
