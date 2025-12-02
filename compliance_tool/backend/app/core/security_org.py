# app/core/security_org.py
from __future__ import annotations
from typing import Sequence, Dict, Any
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config.settings import settings
from app.modules.auth.service import get_me  # validates token via Supabase + reads DB
import psycopg2
import os

bearer = HTTPBearer(auto_error=True)

ALLOWED_EMP_CREATOR_ROLES = {"org_admin"}   # add "hr", "hod" if you want them to create too

def _fetch_user_org_role(email: str) -> tuple[str | None, str | None, str | None]:
    """
    Returns (user_id, organization_id, role) from public.users for the given email.
    """
    dsn = settings.PG_DSN
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, organization_id, role FROM public.users WHERE lower(email)=lower(%s) LIMIT 1",
                (email,)
            )
            row = cur.fetchone()
            if not row:
                return (None, None, None)
            return (str(row[0]) if row[0] else None,
                    str(row[1]) if row[1] else None,
                    str(row[2]) if row[2] else None)

def require_org_scope(org_id_param_name: str, allowed_roles: Sequence[str] = ("org_admin",)):
    """
    Factory: ensures the caller is superadmin OR matches the given org and role.
    Usage in routes:
        @_router.post("/organizations/{org_id}/employees")
        def create(..., ctx = Depends(require_org_scope("org_id", ["org_admin","hr"]))):
            ...
    """
    def _dep(creds: HTTPAuthorizationCredentials = Depends(bearer), **path_params) -> Dict[str, Any]:
        access_token = creds.credentials
        # Validate token and read (user_id, email, role, perms, status)
        supa_user_id, email, full_name, role, perms, status = get_me(access_token)
        if status != "active":
            raise HTTPException(status_code=403, detail="Account is not active")

        # Superadmin can do anything
        if role == "superadmin":
            return {"email": email, "role": role, "org_id": path_params.get(org_id_param_name)}

        # Check org membership
        user_id, user_org_id, user_role = _fetch_user_org_role(email)
        target_org_id = path_params.get(org_id_param_name)
        if not target_org_id:
            raise HTTPException(status_code=400, detail="Missing org id in path")

        if not user_org_id or user_org_id != str(target_org_id):
            raise HTTPException(status_code=403, detail="Not allowed (cross-organization)")

        if user_role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not allowed to create employees")

        return {"email": email, "role": user_role, "org_id": str(target_org_id)}
    return _dep
