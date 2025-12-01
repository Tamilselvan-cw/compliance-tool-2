import secrets
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from supabase import Client
from app.core.supabase_client import get_supabase, get_supabase_admin
from app.config.settings import settings
from app.db.session import get_conn
from app.utils.emailer import render_template, send_email
from typing import Optional, Tuple, List
from urllib.parse import quote
import math
import logging
from app.modules.auth.schemas import RegistrationError
from typing import Optional, Callable, Iterable
from fastapi import Header, HTTPException, status, Depends
from app.modules.auth.schemas import MeOut

logger = logging.getLogger("app.auth")
fernet = Fernet(settings.FERNET_KEY.encode() if isinstance(settings.FERNET_KEY, str) else settings.FERNET_KEY)

USERS_TABLE = "users"
PENDING_TABLE = "verification_pending_credentials"
ALLOWED_ROLES = {"superadmin","org_admin","manager","staff","user"}

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "superadmin": ["*"],
    "org_admin": ["org:read","org:write","user:read","user:invite","report:read"],
    "manager":   ["team:read","team:write","report:read","user:read"],
    "staff":     ["task:read","task:write","report:read"],
    "user":      ["self:read","self:write"]
}

def _finalize_activation_and_send_creds(email: str, user_id: str | None) -> None:
    dec_password: str | None = None
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select enc_password from verification.verification_pending_credentials where email=%s", (email,))
            row = cur.fetchone()
            if row and row[0]:
                dec_password = fernet.decrypt(row[0].encode()).decode()

            cur.execute(
                """update public.users
                   set auth_user_id=coalesce(%s, auth_user_id),
                       status='active',
                       verified_at=now()
                   where email=%s
                """,
                (user_id, email)
            )
            cur.execute("delete from verification.verification_pending_credentials where email=%s", (email,))

    # fetch metadata if possible (non-fatal)
    full_name = None
    try:
        if user_id:
            sb = get_supabase()
            u = sb.auth.admin.get_user_by_id(user_id)
            if isinstance(u, dict):
                md = (u.get("user", {}) or {}).get("user_metadata") or {}
                full_name = md.get("full_name")
            else:
                md = getattr(getattr(u, "user", None), "user_metadata", {}) or {}
                full_name = md.get("full_name")
    except Exception:
        pass

    html = render_template(
        "credentials_email.html",
        email=email,
        password=dec_password or "Set via Forgot Password",
        full_name=full_name,
    )
    send_email(email, "Your account is ready – login credentials", html)

def _find_user_id_by_email(client, email: str) -> str | None:
    email_l = (email or "").strip().lower()
    if not email_l:
        return None

    try:
        admin = client.auth.admin
        page, per_page = 1, 200

        while True:
            res = admin.list_users(page=page, per_page=per_page)

            # Normalize to a list called `users`
            users = None
            if hasattr(res, "users"):
                users = res.users                                  # pydantic-style
            elif isinstance(res, dict):
                users = res.get("users", [])                        # dict style
            elif isinstance(res, list):
                users = res                                         # already a list
            else:
                users = []                                          # unknown shape

            for u in users:
                u_email = None
                u_id = None

                if isinstance(u, dict):
                    u_email = (u.get("email") or "").lower()
                    u_id = u.get("id")
                else:
                    # object-ish
                    u_email = (getattr(u, "email", "") or "").lower()
                    u_id = getattr(u, "id", None)

                if u_email == email_l:
                    return u_id

            # pagination end: when fewer than per_page or nothing returned
            if not users or len(users) < per_page:
                break

            page += 1

    except Exception as e:
        # don’t break org creation because of a lookup
        import logging
        logging.getLogger(__name__).warning("AUTH LOOKUP WARN: %s", e)

    return None

def confirm_from_redirect(email: str | None, token_hash: str | None, typ: str | None) -> str:
    sb: Client = get_supabase()

    if token_hash and email:
        # Normal path: verify OTP (may return a session with user)
        resp = sb.auth.verify_otp({"email": email, "token": token_hash, "type": typ or "signup"})
        user_id = None
        # try to extract user id from response (if present)
        try:
            user_id = str(getattr(resp, "user", None).id)  # object shape
        except Exception:
            try:
                user_id = str((resp or {}).get("user", {}).get("id"))  # dict shape
            except Exception:
                pass
        if not user_id:
            user_id = _find_user_id_by_email(sb, email)

        _finalize_activation_and_send_creds(email.lower(), user_id)
        return email.lower()

    # Fallback: no token, but maybe Supabase already verified the email
    if email and not token_hash:
        user_id = _find_user_id_by_email(sb, email)
        # if we found a user, just finalize; we don’t strictly need email_confirmed_at
        _finalize_activation_and_send_creds(email.lower(), user_id)
        return email.lower()

    raise ValueError("Missing token_hash or email for confirmation")

def _gen_password() -> str:
    """
    Generate a 12–16 char random password (url-safe). 
    Supabase accepts this fine and the user can change it later.
    """
    pwd = secrets.token_urlsafe(12)  # ~16 chars
    # ensure basic complexity (optional)
    if len(pwd) < 12:
        pwd += secrets.token_urlsafe(2)
    return pwd

def _permissions_for(role: str) -> list[str]:
    return ROLE_PERMISSIONS.get(role, [])

def register_user(email: str, full_name: str | None, role: str = "user") -> None:
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role '{role}'")

    sb = get_supabase_admin()
    password = _gen_password()
    # redirect_to = f"{settings.APP_BASE_URL}/auth/confirm?email={quote(email.lower())}"
    # sb.auth.sign_up({
    #     "email": email,
    #     "password": password,
    #     "options": {"email_redirect_to": redirect_to}
    # })

    # BEFORE (remove this)
    # AFTER (use admin.create_user + admin.generate_link)
    redirect_to = f"{settings.APP_BASE_URL}/auth/confirm?email={quote(email.lower())}"

    # 1) ensure auth user exists (not confirmed)
    try:
        sb.auth.admin.create_user({
            "email": email.lower(),
            "password": password,
            "email_confirm": False
        })
    except Exception:
        pass  # ignore "already exists"

    # 2) generate one-time verify link
    link_res = sb.auth.admin.generate_link({
        "type": "signup",
        "email": email.lower(),
        "options": {"redirect_to": redirect_to}
    })

    # 3) extract action_link safely across SDK shapes
    action_link = None
    # attribute forms
    if hasattr(link_res, "action_link") and link_res.action_link:
        action_link = link_res.action_link
    elif hasattr(link_res, "properties") and getattr(link_res, "properties"):
        props = link_res.properties
        if hasattr(props, "action_link") and props.action_link:
            action_link = props.action_link
    # dict forms
    elif isinstance(link_res, dict):
        action_link = link_res.get("action_link") or (
            (link_res.get("properties") or {}).get("action_link")
        )

    if not action_link:
        raise ValueError(f"Failed to extract action_link from generate_link response: {link_res!r}")

    # 4) persist pending creds + user row (NEEDED for later credentials email)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """insert into public.users(email, full_name, status, role)
                values (%s,%s,'pending',%s)
                on conflict (email) do update
                set full_name=excluded.full_name, status='pending', role=excluded.role
                """,
                (email.lower(), full_name, role)
            )
            enc = fernet.encrypt(password.encode()).decode()
            cur.execute(
                """insert into verification.verification_pending_credentials(email, enc_password, created_at, expires_at)
                values (%s,%s,now(),now()+interval '2 days')
                on conflict (email) do update
                set enc_password=excluded.enc_password, created_at=now(), expires_at=now()+interval '2 days'
                """,
                (email.lower(), enc)
            )

    # 5) send our own verification email with the actual link
    html = render_template("verification_link_sent.html", full_name=full_name or "there")
    html = html.replace("</body>", f'<p><a href="{action_link}">Verify your email</a></p></body>')
    send_email(email.lower(), "Verify your email to activate your account", html)

def confirm_and_send_credentials(access_token: str) -> str:
    sb: Client = get_supabase()
    user = sb.auth.get_user(access_token).user
    if not user:
        raise ValueError("Invalid or expired access token")

    email = (user.email or "").lower()

    # fetch pending password + the role from users
    dec_password: str | None = None
    role: str = "user"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select enc_password from verification.verification_pending_credentials where email=%s", (email,))
            row = cur.fetchone()
            if row and row[0]:
                dec_password = Fernet(settings.FERNET_KEY.encode()).decrypt(row[0].encode()).decode()

            cur.execute("select role from public.users where email=%s", (email,))
            r2 = cur.fetchone()
            if r2 and r2[0]:
                role = r2[0]

            # mark active + link auth id
            cur.execute(
                """update public.users
                   set auth_user_id=%s, status='active', verified_at=now()
                   where email=%s
                """,
                (str(user.id), email)
            )
            cur.execute("delete from verification.verification_pending_credentials where email=%s", (email,))

    # keep role in Supabase user metadata (handy for RLS / logs)
    try:
        sb.auth.admin.update_user_by_id(str(user.id), attributes={"user_metadata": {"app_role": role}})
    except Exception:
        # non-fatal if admin API not available
        pass

    html = render_template("credentials_email.html",
                           email=email,
                           password=dec_password or "Set via Forgot Password",
                           full_name=user.user_metadata.get("full_name") if user.user_metadata else None)
    send_email(email, "Your account is ready – login credentials", html)
    return email

def login(email: str, password: str, as_role: Optional[str] = None) -> Tuple[str,str,str,str,list[str]]:
    sb: Client = get_supabase()
    sess = sb.auth.sign_in_with_password({"email": email, "password": password})
    if not sess or not sess.session or not sess.session.access_token:
        raise ValueError("Invalid email or password")

    access = sess.session.access_token
    refresh = getattr(sess.session, "refresh_token", None)

    # check user status and role
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select id, status, role from public.users where email=%s", (email.lower(),))
            row = cur.fetchone()
            if not row:
                raise PermissionError("User record not found")
            _user_id, status, role = row
            if status != "active":
                raise PermissionError("User is not active")

    # if caller requested a specific role, enforce it
    effective_role = as_role or role
    if effective_role != role:
        # simple guard: only allow “elevation” rules you want
        # example: superadmin can log in as any role; lower roles cannot elevate
        if role != "superadmin":
            raise PermissionError("Not allowed to assume this role")

    perms = _permissions_for(effective_role)
    return (access, str(sess.user.id), email.lower(), effective_role, perms, refresh)

def resend_verification(email: str) -> str:
    sb: Client = get_supabase()
    redirect_to = f"{settings.APP_BASE_URL}/auth/confirm?email={quote(email.lower())}"
    link_res = sb.auth.admin.generate_link({
        "type": "signup",
        "email": email.lower(),
        "options": {"redirect_to": redirect_to}
    })
    props = link_res.get("properties") if isinstance(link_res, dict) else getattr(link_res, "properties", {})
    action_link = (props or {}).get("action_link") or link_res.get("action_link")
    if not action_link:
        raise ValueError("Failed to generate verification link")

    html = render_template("verification_link_sent.html", full_name="there")
    html = html.replace("</body>", f'<p><a href="{action_link}">Verify your email</a></p></body>')
    send_email(email.lower(), "Verify your email to activate your account", html)
    return action_link

def get_me(access_token: str) -> Tuple[str, str, Optional[str], str, list[str], str]:
    """
    Returns: (user_id, email, full_name, role, permissions, status)
    """
    if not access_token:
        raise ValueError("Missing access token")

    sb: Client = get_supabase()
    # Validate token with Supabase
    user_resp = sb.auth.get_user(access_token)
    user = getattr(user_resp, "user", None) if user_resp else None
    if not user:
        raise ValueError("Invalid or expired access token")

    supa_user_id = str(getattr(user, "id"))
    email = (getattr(user, "email", "") or "").lower()
    full_name = None
    try:
        md = getattr(user, "user_metadata", {}) or {}
        full_name = md.get("full_name")
    except Exception:
        pass

    role, status, org_id = "user", "pending", None
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select role, status, organization_id, coalesce(full_name,'') "
                "from public.users where email=%s",
                (email,),
            )
            row = cur.fetchone()
            if row:
                role, status, org_id, db_full_name = row
                full_name = full_name or (db_full_name or None)

    perms = _permissions_for(role)
    return supa_user_id, email, full_name, role, perms, status, str(org_id) if org_id else None

def refresh_access_token(refresh_token: str) -> tuple[str, str | None]:
    """
    Returns (new_access_token, new_refresh_token_or_none)
    """
    if not refresh_token:
        raise ValueError("Missing refresh token")

    sb: Client = get_supabase()

    # supabase-py v2 expects a string; older variants sometimes allowed dicts.
    try:
        new_sess = sb.auth.refresh_session(refresh_token)   # ✅ pass string
    except TypeError:
        # fallback for older/other shapes (rare)
        new_sess = sb.auth.refresh_session({"refresh_token": refresh_token})

    # normalize shapes (object or dict)
    sess = getattr(new_sess, "session", None) or (new_sess.get("session") if isinstance(new_sess, dict) else None)
    if not sess:
        raise ValueError("Failed to refresh session (no session in response)")

    access = getattr(sess, "access_token", None) or (sess.get("access_token") if isinstance(sess, dict) else None)
    new_refresh = getattr(sess, "refresh_token", None) or (sess.get("refresh_token") if isinstance(sess, dict) else None)

    if not access:
        raise ValueError("Failed to refresh session (no access token)")

    return access, new_refresh

def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header (expected: Bearer <token>)",
        )
    return parts[1]

def _meout_from_tuple(tup: tuple) -> MeOut:
    """
    get_me currently returns:
        (user_id, email, full_name, role, permissions, status, organization_id_or_None)
    """
    try:
        user_id, email, full_name, role, permissions, status, org_id = tup
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth service contract changed"
        )
    return MeOut(
        user_id=user_id,
        email=email,
        full_name=full_name,
        role=role,
        permissions=list(permissions or []),
        status=status,
        organization_id=org_id,
    )

async def get_current_user(authorization: Optional[str] = Header(None)) -> MeOut:
    """
    Strict auth dependency: requires a valid Bearer token.
    """
    token = _extract_bearer_token(authorization)
    try:
        me_tuple = get_me(token)  # <-- your existing function above
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}"
        )
    return _meout_from_tuple(me_tuple)

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[MeOut]:
    """
    Lenient auth: returns None if unauthenticated.
    """
    if not authorization:
        return None
    try:
        token = _extract_bearer_token(authorization)
        me_tuple = get_me(token)
        return _meout_from_tuple(me_tuple)
    except Exception:
        return None

def require_roles(*allowed_roles: str) -> Callable[[MeOut], MeOut]:
    """
    Usage:
        @router.get("/secure")
        def endpoint(current=Depends(require_roles("superadmin","org_admin"))):
            ...
    """
    allowed: set[str] = {r.lower() for r in allowed_roles}
    async def _dep(current: MeOut = Depends(get_current_user)) -> MeOut:
        if current.role.lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role"
            )
        return current
    return _dep

