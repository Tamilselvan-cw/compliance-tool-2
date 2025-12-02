from fastapi import APIRouter, Path, Query, HTTPException, status
from uuid import UUID
from typing import Optional, List
from .schemas import RoleCreate, RoleUpdate, RoleOut, RoleListOut
from . import service

router = APIRouter(prefix="/organizations", tags=["Roles"])

def _err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)

@router.post("/{org_id}/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(org_id: UUID, payload: RoleCreate):
    try:
        return service.create_role_for_org(org_id, payload.model_dump(), actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.patch("/{org_id}/roles/{role_id}", response_model=RoleOut)
def update_role(org_id: UUID, role_id: UUID, payload: RoleUpdate):
    try:
        return service.update_role_for_org(
            org_id,
            role_id,
            payload.model_dump(exclude_unset=True),
            actor_user_id=None,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))


@router.get("/{org_id}/roles", response_model=RoleListOut)
def list_roles(org_id: UUID, page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), q: Optional[str] = None):
    try:
        items, total = service.list_roles(org_id, page, limit, q)
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))

@router.get("/{org_id}/roles/{role_id}", response_model=RoleOut)
def get_role(org_id: UUID, role_id: UUID):
    try:
        role = service.get_role(org_id, role_id)
        return role
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # log full exception
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{org_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(org_id: UUID, role_id: UUID, soft: bool = Query(True)):
    try:
        service.delete_role_for_org(org_id, role_id, hard=False)
        return None
    except Exception as e:
        raise HTTPException(status_code=404, detail=_err(e))

@router.post("/{org_id}/roles/bulk", response_model=List[RoleOut], status_code=status.HTTP_201_CREATED)
def bulk_create_roles(org_id: UUID, payload: List[RoleCreate]):
    """
    Bulk create roles for an organization.
    Each item must include required fields (title, department_id, etc).
    Returns list of created role objects.
    """
    try:
        items = [p.model_dump(exclude_unset=True) for p in payload]
        return service.bulk_create_roles_for_org(org_id, items, actor_user_id=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_err(e))
