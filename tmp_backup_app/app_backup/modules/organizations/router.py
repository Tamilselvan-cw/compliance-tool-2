from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Optional, Dict, Any
from math import ceil
from app.modules.employees.router import create_employee
from app.core.security import require_superadmin
from app.deps.clients import get_supabase_service
from uuid import UUID
router = APIRouter(prefix="/organizations", tags=["Organizations"])


# =========================================================
# ✅ Create Organization
# =========================================================
@router.post("", status_code=201)
def create_organization(payload: Dict[str, Any]):
    """
    Create an organization and 1–3 admin employees.

    Expected payload from frontend:

    {
        "name": "Gold",
        "admins": [
            { "name": "Admin1", "email": "a1@x.com" },
            { "name": "Admin2", "email": "a2@x.com" }
        ]
    }

    NOTE:
    - Only `name` is inserted into organizations.
    - Every admin is created via /organizations/{org_id}/employees
      with role = "org_admin".
    """
    # ------------- basic fields -------------
    name = (payload.get("name") or "").strip()

    # support both keys: `admins` (new) and `adminUsers` (old)
    admins_raw = payload.get("admins")
    if admins_raw is None:
        admins_raw = payload.get("adminUsers") or []

    if not name:
        raise HTTPException(status_code=400, detail="Organization name required")

    if not isinstance(admins_raw, list):
        raise HTTPException(status_code=400, detail="admins must be a list")

    # ------------- normalize & validate admins -------------
    final_admins = []
    for item in admins_raw:
        if not isinstance(item, dict):
            continue
        email = (item.get("email") or "").strip()
        if not email:
            continue
        # very simple email sanity check; deeper checks happen in create_employee
        if "@" not in email or "." not in email:
            raise HTTPException(status_code=400, detail="Valid email required for all admins")

        final_admins.append({
            "name": (item.get("name") or email.split("@")[0]).strip(),
            "email": email,
        })

    if len(final_admins) < 1 or len(final_admins) > 3:
        raise HTTPException(
            status_code=400,
            detail="Admins must be between 1 and 3",
        )

    # ------------- create org + admins -------------
    try:
        supabase = get_supabase_service()

        # ✅ ONLY name is stored in organizations
        org_res = (
            supabase.table("organizations")
            .insert({"name": name})
            .execute()
        )
        rows = getattr(org_res, "data", None) or []
        if not rows:
            raise ValueError("Failed to create organization")

        org = rows[0]
        org_id = org["id"]

        # create each admin as employee with role=org_admin
        created_admins = []
        for adm in final_admins:
            body = {
                "name": adm["name"],
                "email": adm["email"],
                "role": "org_admin",
            }
            # reuse your existing employee creation logic
            emp_res = create_employee(org_id, body)
            created_admins.append(emp_res["employee"])

        return {
            "organization": org,
            "admins": created_admins,
        }

    except HTTPException:
        # bubble up clean HTTP errors from create_employee
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_CREATE_ERR: {e}")

# =========================================================
# ✅ List Organizations (Superadmin only)
# =========================================================
@router.get("", status_code=200)
def list_organizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    order_by: str = "created_at",
    order: str = "desc",
    # uncomment this when you want to enforce auth:
    # user = Depends(require_superadmin),
):
    supabase = get_supabase_service()
    start = (page - 1) * page_size
    end = start + page_size - 1
    descending = order.lower() != "asc"

    try:
        query = supabase.table("organizations").select("*", count="exact")
        if search:
            query = query.ilike("name", f"%{search}%")
        query = query.order(order_by, desc=descending).range(start, end)
        response = query.execute()

        items = getattr(response, "data", None) or []
        total = getattr(response, "count", None) or len(items)
        total_pages = (total + page_size - 1) // page_size if total else 1

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
            "order_by": order_by,
            "order": "desc" if descending else "asc",
            "search": search,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_LIST_ERR: {e}")

# =========================================================
# ---------- Get one (basic) ----------
# =========================================================
@router.get("/{org_id}", status_code=200)
def get_organization(org_id: str = Path(...)):
    supabase = get_supabase_service()
    try:
        resp = (
            supabase.table("organizations")
            .select("*")
            .eq("id", org_id)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Organization not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_GET_ERR: {e}")

# =========================================================
# ---------- Get details (with counts) ----------
# =========================================================
@router.get("/{org_id}/details", status_code=200)
def get_organization_details(org_id: str = Path(...)):
    supabase = get_supabase_service()

    # Map logical keys -> actual table + fk column
    TABLES = {
        "departments": {"table": "departments",       "fk": "organization_id"},
        "roles":       {"table": "roles",             "fk": "organization_id"},
        "employees":   {"table": "employees",         "fk": "org_id"},            # employees uses org_id
        "levels":      {"table": "levels",            "fk": "organization_id"},
        "competencys":      {"table": "competencys",            "fk": "organization_id"},
        "surveys":     {"table": "competency_matrix", "fk": "org_id"},
    }

    def _safe_count(key: str) -> int:
        meta = TABLES[key]
        try:
            r = (
                supabase
                .table(meta["table"])
                .select("id", count="exact")
                .eq(meta["fk"], org_id)
                .range(0, 0)   # no rows, just the count header
                .execute()
            )
            return getattr(r, "count", None) or 0
        except Exception:
            # If a table isn’t present yet, don’t crash the details endpoint.
            return 0

    try:
        # fetch org row
        org_res = (
            supabase.table("organizations")
            .select("id,name,status,created_at,updated_at,description,number")
            .eq("id", org_id)
            .limit(1)
            .execute()
        )
        org_rows = getattr(org_res, "data", None) or []
        if not org_rows:
            raise HTTPException(status_code=404, detail="Organization not found")
        org = org_rows[0]

        counts = {k: _safe_count(k) for k in TABLES.keys()}

        return {**org, "counts": counts}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_DETAILS_ERR: {e}")

# =========================================================
# 🔄 Update Organization (Superadmin only)
# =========================================================
@router.patch("/{org_id}", status_code=200)
def update_organization(
    org_id: str = Path(..., description="Organization ID (uuid)"),
    payload: Dict[str, Any] = {},
):
    supabase = get_supabase_service()

    allowed = {"name", "description", "status"}
    patch = {k: v for k, v in (payload or {}).items() if k in allowed and v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    try:
        # v2: update -> execute(); updated rows are in res.data
        res = supabase.table("organizations").update(patch).eq("id", org_id).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            # no row matched the filter
            raise HTTPException(status_code=404, detail="Organization not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_UPDATE_ERR: {e}")

# =========================================================
# 🗑️ Delete Organization (Superadmin only)
# =========================================================
@router.delete("/{org_id}", status_code=204)
def delete_organization(
    org_id: str = Path(..., description="Organization ID (uuid)"),
):
    supabase = get_supabase_service()
    try:
        # v2: delete -> execute(); deleted rows are in res.data
        res = supabase.table("organizations").delete().eq("id", org_id).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            # nothing deleted -> treat as 404
            raise HTTPException(status_code=404, detail="Organization not found")
        return  # 204 No Content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_DELETE_ERR: {e}")

# =========================================================
# ---------- Get admins of an organization ----------
# =========================================================
@router.get("/{org_id}/admins", status_code=200)
def list_org_admins(org_id: str = Path(...)):
    """
    Return admin users for the org.
    Relies on public.users(organization_id) and role='org_admin'.
    """
    sb = get_supabase_service()
    try:
        res = (
            sb.table("users")
            .select("id,email,full_name,status,role,organization_id")
            .eq("organization_id", org_id)
            .eq("role", "org_admin")
            .order("email", desc=False)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return [
            {
                "id": r.get("id"),
                "email": r.get("email"),
                "full_name": r.get("full_name"),
                "status": r.get("status"),
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_ADMIN_LIST_ERR: {e}")

# =========================================================
# ---------- Invite / add an admin (send verification if needed) ----------
# =========================================================
@router.post("/{org_id}/admins", status_code=201)
def add_org_admin(org_id: str = Path(...), payload: dict = {}):
    """
    Invite an admin by email.
    - Sends Supabase verification using register_user()
    - Ensures/updates public.users row with role='org_admin' and organization_id set.
    """
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    try:
        # 1) trigger register (sends verification link)
        from app.modules.auth.service import register_user
        register_user(email, full_name=None, role="org_admin")

        # 2) link to org & role in users table
        with get_conn() as conn:
            with conn.cursor() as cur:
                # upsert-like behavior: update if exists; otherwise insert
                cur.execute(
                    """
                    update public.users
                       set organization_id = %s,
                           role = 'org_admin',
                           updated_at = now()
                     where lower(email) = %s
                    """,
                    (org_id, email),
                )
                if cur.rowcount == 0:
                    # If a row doesn't exist yet (rare, depending on your register_user flow),
                    # create one in 'pending' state.
                    cur.execute(
                        """
                        insert into public.users (email, full_name, status, role, organization_id)
                        values (%s, %s, 'pending', 'org_admin', %s)
                        on conflict (email) do update
                          set organization_id = excluded.organization_id,
                              role = excluded.role,
                              status = case when public.users.status = 'disabled' then 'disabled' else public.users.status end,
                              updated_at = now()
                        """,
                        (email, None, org_id),
                    )

        return {"message": "Admin invited"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ORG_ADMIN_INVITE_ERR: {e}")

@router.post("/{org_id}/admins", status_code=201)
def invite_admins(
    org_id: UUID = Path(..., description="Organization ID"),
    payload: Dict[str, Any] = ...,
):
    """
    Invite one or more admin users to an organization.

    Body can be either:
      { "email": "one@user.com" }
    or:
      { "admins": [ { "name": "...", "email": "..." }, ... ] }
    Every created user will have role = 'org_admin' and will be inserted
    into both public.users and public.employees via create_employee().
    """
    admins_payload: List[Dict[str, Any]] = []

    # allow simple single-email payload for backward compatibility
    if "email" in payload and payload["email"]:
        admins_payload.append({
            "name": payload.get("name") or payload["email"].split("@")[0],
            "email": payload["email"],
        })

    # new multi-admin shape
    if "admins" in payload and isinstance(payload["admins"], list):
        for item in payload["admins"]:
            email = (item.get("email") or "").strip()
            if not email:
                continue
            admins_payload.append({
                "name": item.get("name") or email.split("@")[0],
                "email": email,
            })

    if not admins_payload:
        raise HTTPException(status_code=400, detail="No admin users provided")

    created = []
    for adm in admins_payload:
        body = {
            "name": adm["name"],
            "email": adm["email"],
            "role": "org_admin",   # <–– important
        }
        # reuse the existing employee creation logic (this also creates Auth user)
        res = create_employee(str(org_id), body)
        created.append(res["employee"])

    return {"admins": created}

