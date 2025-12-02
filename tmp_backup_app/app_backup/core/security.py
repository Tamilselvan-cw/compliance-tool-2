from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
import os, time, requests
from app.config.settings import settings

# ------------------------------------------------------------------
# Basic constants
# ------------------------------------------------------------------
bearer = HTTPBearer(auto_error=True)
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-env")
SUPERADMINS = {
    e.strip().lower() for e in os.getenv("SUPERADMIN_EMAILS", "").split(",") if e.strip()
}

# Cache for JWKS to avoid repeated network calls
_cached_jwks: Dict[str, Any] | None = None
_cached_at: float = 0.0
_CACHE_TTL = 3600

# ------------------------------------------------------------------
# --- JWKS (Supabase public key) handling ---
# ------------------------------------------------------------------
def _get_jwks() -> Dict[str, Any]:
    """Fetch and cache Supabase JWKS keys."""
    global _cached_jwks, _cached_at
    now = time.time()
    if _cached_jwks and (now - _cached_at) < _CACHE_TTL:
        return _cached_jwks

    resp = requests.get(f"{settings.SUPABASE_URL}/auth/v1/keys", timeout=10)
    resp.raise_for_status()
    _cached_jwks, _cached_at = resp.json(), now
    return _cached_jwks


def _decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """Decode Supabase JWT token using JWKS."""
    jwks = _get_jwks()
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Invalid token (kid mismatch).")

    return jwt.decode(
        token,
        key,
        algorithms=[key.get("alg", "RS256")],
        audience=None,
        options={"verify_aud": False},
    )

# ------------------------------------------------------------------
# --- Supabase API validation ---
# ------------------------------------------------------------------
def _supabase_get_user(token: str) -> Dict[str, Any]:
    """Ask Supabase if this token is valid. Returns user JSON on 200."""
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {"Authorization": f"Bearer {token}", "apikey": settings.SUPABASE_ANON_KEY}
    r = requests.get(url, headers=headers, timeout=10)
    if r.status_code == 200:
        return r.json()
    raise HTTPException(status_code=401, detail="Invalid or expired token")

def _is_superadmin_by_table(auth_uid: str) -> bool:
    """Check public.superadmin table using service role key."""
    from app.config.settings import settings  # ensure import is always available

    srk = settings.SUPABASE_SERVICE_ROLE_KEY
    if not srk:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY missing in settings")

    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/superadmin"
    headers = {
        "Authorization": f"Bearer {srk}",
        "apikey": settings.SUPABASE_ANON_KEY,
        "Accept": "application/json",
        "Prefer": "count=exact",
    }
    params = {"select": "role", "auth_user_id": f"eq.{auth_uid}", "limit": "1"}
    r = requests.get(url, headers=headers, params=params, timeout=10)
    if r.status_code not in (200, 206):
        return False
    rows = r.json() if r.text else []
    return bool(rows)

# ------------------------------------------------------------------
# --- FastAPI dependencies ---
# ------------------------------------------------------------------
def require_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
    """
    Accept any valid Supabase access token.
    Returns the decoded JWT payload.
    """
    token = creds.credentials
    try:
        payload = _decode_supabase_jwt(token)
    except Exception:
        # fallback: ask Supabase directly
        payload = _supabase_get_user(token)

    if not payload or not payload.get("sub") and not payload.get("id"):
        raise HTTPException(status_code=401, detail="Invalid token")

    return payload

def require_role(required_role: str):
    """
    Dependency factory to enforce a specific role in app_metadata.role.
    Usage:
        @app.get("/admin")
        def admin_view(_=Depends(require_role("admin"))): ...
    """
    def _dep(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
        payload = _decode_supabase_jwt(creds.credentials)
        role = payload.get("app_metadata", {}).get("role")
        if role != required_role:
            raise HTTPException(status_code=403, detail=f"{required_role} role required.")
        return payload
    return _dep

def require_superadmin(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
    """
    Validate Supabase token + confirm user is listed in public.superadmin table.
    """
    token = creds.credentials
    user = _supabase_get_user(token)
    auth_uid = user.get("id")
    if not auth_uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not _is_superadmin_by_table(auth_uid):
        raise HTTPException(status_code=403, detail="Superadmin role required.")

    return {"id": auth_uid, "email": user.get("email"), "source": "supabase"}
 