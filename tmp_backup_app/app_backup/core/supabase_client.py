from supabase import create_client, Client
from app.config.settings import settings

_sb: Client | None = None

def get_supabase() -> Client:
    global _sb
    if _sb is None:
        _sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _sb


import base64, json, logging
logger = logging.getLogger(__name__)

def _jwt_role(jwt: str) -> str | None:
    try:
        parts = jwt.split(".")
        payload_b64 = parts[1] + "=="
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()))
        return payload.get("role")
    except Exception:
        return None

def assert_service_key(name: str, key: str) -> None:
    role = _jwt_role(key or "")
    if role != "service_role":
        raise RuntimeError(f"{name} is not a service_role key (decoded role={role!r}, len={len(key or '')})")


_sb_admin: Client | None = None
_sb_anon: Client | None = None

def get_supabase_admin() -> Client:
    global _sb_admin
    if _sb_admin is None:
        assert_service_key("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_SERVICE_ROLE_KEY)
        _sb_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _sb_admin

def get_supabase_anon() -> Client:
    global _sb_anon
    if _sb_anon is None:
        _sb_anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _sb_anon
