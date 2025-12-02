"""
Centralized Supabase client management.

Provides:
- get_supabase_anon()       → anon key (RLS enforced)
- get_supabase_for_token()  → user-authenticated session (RLS as that user)
- get_supabase_service()    → service-role (RLS bypassed, backend-only)
"""

from __future__ import annotations
from typing import Optional
import os
from supabase import create_client, Client
from app.config.settings import settings


# ------------------------------------------------------------------
# --- Anon (default) client — for public or RLS-aware queries
# ------------------------------------------------------------------
_supabase_anon: Optional[Client] = None


def get_supabase_anon() -> Client:
    """
    Returns a shared Supabase client using the ANON key.

    ✅ Use this for:
        - Reading public data
        - RLS-aware queries where you attach a user token later

    ❌ Avoid using this for privileged operations (use service role instead).
    """
    global _supabase_anon
    if _supabase_anon is None:
        if not settings.SUPABASE_ANON_KEY:
            raise RuntimeError("SUPABASE_ANON_KEY missing in environment")
        _supabase_anon = create_client(str(settings.SUPABASE_URL), settings.SUPABASE_ANON_KEY)
    return _supabase_anon


class _SupabaseAnonProxy:
    """Backward-compatible proxy (so `supabase.table(...)` still works)."""

    def __getattr__(self, item):
        return getattr(get_supabase_anon(), item)


# Alias for compatibility with your earlier imports:
supabase = _SupabaseAnonProxy()


# ------------------------------------------------------------------
# --- User-level client (attaches access token for RLS)
# ------------------------------------------------------------------
def get_supabase_for_token(access_token: str) -> Client:
    """
    Returns a Supabase client configured to execute queries *as the given user*.

    The supplied token will be attached to PostgREST so that:
    - Row-Level Security (RLS) policies recognize the user
    - `auth.uid()` inside Postgres will map to this token’s subject

    Typical use:
        client = get_supabase_for_token(user_access_token)
        res = client.table("projects").select("*").execute()
    """
    client = get_supabase_anon()
    client.postgrest.auth(access_token)
    return client


# ------------------------------------------------------------------
# --- Service-role client (bypasses RLS)
# ------------------------------------------------------------------
_supabase_service: Optional[Client] = None


def get_supabase_service() -> Client:
    """
    Returns a Supabase client authenticated with the SERVICE ROLE key.

    ✅ Use this for:
        - Admin-only queries
        - Background jobs, migrations, or role verification
        - API endpoints protected with require_superadmin()

    ⚠️  WARNING: This key bypasses RLS — never expose it client-side.
    """
    global _supabase_service
    if _supabase_service is None:
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not service_key:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set in the environment")

        _supabase_service = create_client(str(settings.SUPABASE_URL), service_key)
    return _supabase_service
