from fastapi import APIRouter, HTTPException, Path, Query, Response, Body
from typing import Dict, Any, Optional, List
from app.deps.clients import get_supabase_service
from app.modules.department.schemas import (
    DepartmentCreate, DepartmentUpdate, DepartmentOut, BulkDelete
)

router = APIRouter(prefix="/organizations", tags=["Departments"])

def _pg_err(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)

def _ensure_org(sb, org_id: str):
    try:
        r = sb.table("organizations").select("id").eq("id", org_id).single().execute()
        if not getattr(r, "data", None):
            raise HTTPException(status_code=404, detail="Organization not found")
    except Exception:
        raise HTTPException(status_code=404, detail="Organization not found")

@router.post("/{org_id}/departments", response_model=Dict[str, DepartmentOut], status_code=201)
def create_department(
    org_id: str = Path(..., description="Organization ID"),
    payload: DepartmentCreate = ...
):
    sb = get_supabase_service()
    _ensure_org(sb, org_id)

    body = {
        "organization_id": org_id,
        "name": payload.name.strip(),
        "description": (payload.description or "").strip() or None,
    }

    try:
        res = sb.table("departments").insert(body).execute()
        data = getattr(res, "data", None)
        if isinstance(data, list): data = data[0] if data else None
        if not data:
            # fetch back (not unique by name, so use latest created)
            f = (sb.table("departments")
                  .select("*")
                  .eq("organization_id", org_id)
                  .eq("name", body["name"])
                  .order("created_at", desc=True)
                  .limit(1)
                  .single()
                  .execute())
            data = getattr(f, "data", None)
        if not data:
            raise HTTPException(status_code=500, detail="DEPT_CREATE_ERR: insert returned no data")
        return {"department": data}
    except Exception as e:
        msg = _pg_err(e)
        raise HTTPException(status_code=500, detail=f"DEPT_CREATE_ERR: {msg}")

@router.get("/{org_id}/departments", response_model=Dict[str, Any])
def list_departments(
    org_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=200),
    search: Optional[str] = None
):
    sb = get_supabase_service()
    start = (page - 1) * page_size
    end = start + page_size - 1

    try:
        q = sb.table("departments").select("*", count="exact").eq("organization_id", org_id)
        if search:
            like = f"%{search}%"
            q = q.or_(f"name.ilike.{like},description.ilike.{like}")
        q = q.order("created_at", desc=True).range(start, end)
        r = q.execute()

        items = getattr(r, "data", None) or []
        total = getattr(r, "count", None) or len(items)
        total_pages = (total + page_size - 1) // page_size if total else 1

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DEPT_LIST_ERR: {_pg_err(e)}")

@router.get("/{org_id}/departments/{dept_id}", response_model=Dict[str, DepartmentOut])
def get_department(org_id: str, dept_id: str):
    sb = get_supabase_service()
    try:
        r = (sb.table("departments")
               .select("*")
               .eq("organization_id", org_id)
               .eq("id", dept_id)
               .single()
               .execute())
        data = getattr(r, "data", None)
        if not data:
            raise HTTPException(status_code=404, detail="Department not found")
        return {"department": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DEPT_GET_ERR: {_pg_err(e)}")

@router.patch("/{org_id}/departments/{dept_id}", response_model=Dict[str, DepartmentOut])
def update_department(org_id: str, dept_id: str, patch: DepartmentUpdate):
    sb = get_supabase_service()
    body = patch.model_dump(exclude_unset=True)
    if "name" in body and body["name"]:
        body["name"] = body["name"].strip()
    if "description" in body:
        body["description"] = (body["description"] or "").strip() or None

    try:
        res = (sb.table("departments")
                 .update(body)
                 .eq("organization_id", org_id)
                 .eq("id", dept_id)
                 .execute())
        data = getattr(res, "data", None)
        if not data:
            res2 = (sb.table("departments")
                      .select("*")
                      .eq("organization_id", org_id)
                      .eq("id", dept_id)
                      .single()
                      .execute())
            data = getattr(res2, "data", None)
        if isinstance(data, list): data = data[0]
        if not data:
            raise HTTPException(status_code=404, detail="Department not found or not updated")
        return {"department": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DEPT_UPDATE_ERR: {_pg_err(e)}")

@router.delete("/{org_id}/departments/{dept_id}", status_code=204)
def delete_department(
    org_id: str = Path(...),
    dept_id: str = Path(...),
):
    sb = get_supabase_service()
    _ensure_org(sb, org_id)

    try:
        q = sb.table("departments").select("id").eq("id", dept_id).eq("organization_id", org_id).single().execute()
        if not getattr(q, "data", None):
            raise HTTPException(status_code=404, detail="Department not found")

        sb.table("departments").delete().eq("id", dept_id).eq("organization_id", org_id).execute()
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DEPT_DELETE_ERR: {_pg_err(e)}")

@router.post("/{org_id}/departments/bulk", status_code=204)
def bulk_delete(org_id: str, payload: BulkDelete):
    sb = get_supabase_service()
    _ensure_org(sb, org_id)

    ids = payload.ids
    if not ids:
        raise HTTPException(status_code=400, detail="No ids provided")

    try:
        sb.table("departments").delete().in_("id", ids).eq("organization_id", org_id).execute()
        return Response(status_code=204)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DEPT_BULK_DELETE_ERR: {_pg_err(e)}")
    
