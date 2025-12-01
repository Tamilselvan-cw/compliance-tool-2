# app/modules/employees/router.py
from __future__ import annotations
from fastapi import APIRouter, Path, HTTPException
from typing import Optional, List, Dict, Any
from cryptography.fernet import Fernet
from urllib.parse import quote
import secrets, time, requests
from app.modules.auth.schemas import MeOut
from app.deps.clients import get_supabase_service
from app.core.supabase_client import get_supabase_admin
from app.config.settings import settings
from app.db.session import get_conn
from app.utils.emailer import render_template, send_email
from fastapi import Depends
from app.modules.auth.service import get_current_user
from math import ceil
from fastapi import Query
from app.db.session import get_conn

fernet = Fernet(settings.FERNET_KEY.encode() if isinstance(settings.FERNET_KEY, str) else settings.FERNET_KEY)
router = APIRouter(prefix="/organizations", tags=["Employees"])

AllowedRoles = ["superadmin", "org_admin", "hr"]

# --------------------------------------------------------------------------
# Utility helpers
# --------------------------------------------------------------------------
def _pg_err_msg(e: Exception) -> str:
    return getattr(e, "message", None) or str(e)

APP_TO_DB = {
    "employee": "org_employee",
    "org_employee": "org_employee",
    "hr": "org_hr",
    "org_hr": "org_hr",
    "org_admin": "org_admin",
    "orgadmin": "org_admin",
    "admin": "org_admin",
    "hod": "org_manager",
    "manager": "org_manager",
    "org_manager": "org_manager",
}
DB_TO_APP = {
    "org_employee": "employee",
    "org_hr": "hr",
    "org_admin": "org_admin",
    "org_manager": "hod",
}

def _normalize_email(v: str) -> str:
    return (v or "").strip().lower()

def _normalize_role_incoming(v: str | None) -> str | None:
    if not v:
        return None
    key = v.strip().lower().replace("-", "_")
    return APP_TO_DB.get(key)

def _map_row_db_to_app(row: dict | None) -> dict | None:
    if not row:
        return row
    out = dict(row)
    db_role = out.get("role")
    if db_role in DB_TO_APP:
        out["role"] = DB_TO_APP[db_role]
    return out

def _map_list_db_to_app(items: List[dict]) -> List[dict]:
    return [_map_row_db_to_app(it) for it in (items or [])]

def _ensure_org_exists(sb, org_id: str):
    try:
        res = sb.table("organizations").select("id").eq("id", org_id).single().execute()
        if not getattr(res, "data", None):
            raise HTTPException(status_code=404, detail="Organization not found")
    except Exception:
        raise HTTPException(status_code=404, detail="Organization not found")

def _gen_password() -> str:
    pwd = secrets.token_urlsafe(12)
    if len(pwd) < 12:
        pwd += secrets.token_urlsafe(2)
    return pwd

# --------------------------------------------------------------------------
# Auth lookups
# --------------------------------------------------------------------------
def _lookup_auth_user_id_by_email(sb_admin, email: str) -> str | None:
    """Fallback: iterate Supabase Admin list_users pages"""
    for _ in range(5):
        try:
            page = 1
            while True:
                res = sb_admin.auth.admin.list_users({"page": page, "per_page": 200})
                users = []
                if hasattr(res, "data") and res.data:
                    users = res.data.get("users") if isinstance(res.data, dict) else res.data
                elif hasattr(res, "users"):
                    users = res.users
                for u in users or []:
                    if (u.get("email") or "").lower() == email:
                        return u.get("id")
                if not users or len(users) < 200:
                    break
                page += 1
        except Exception:
            pass
        time.sleep(0.3)
    return None

def _lookup_auth_user_id_via_rest(email: str) -> str | None:
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }
    try:
        r = requests.get(url, headers=headers, params={"email": email}, timeout=10)
        if r.ok:
            data = r.json()
            users = data.get("users") if isinstance(data, dict) else None
            if isinstance(users, list):
                for u in users:
                    if (u.get("email") or "").lower() == email:
                        return u.get("id")
            elif isinstance(data, dict) and (data.get("email") or "").lower() == email:
                return data.get("id")
    except Exception:
        pass
    return None

# --------------------------------------------------------------------------
# SELECT with joins
# --------------------------------------------------------------------------
EMP_SELECT_WITH_JOINS = (
    "*,"
    "department:departments(id,name),"
    "primary_role:roles!employees_primary_role_id_fkey(id,title),"
    "secondary_role:roles!employees_secondary_role_id_fkey(id,title)"
)

# --------------------------------------------------------------------------
# CREATE
# --------------------------------------------------------------------------
@router.post("/{org_id}/employees", status_code=201)
def create_employee(org_id: str = Path(...), payload: Dict[str, Any] = ...):
    sb = get_supabase_service()
    _ensure_org_exists(sb, org_id)

    name = (payload.get("name") or "").strip()
    email = _normalize_email(payload.get("email") or "")
    if not name or not email:
        raise HTTPException(status_code=400, detail="name and email are required")

    incoming_role = payload.get("role")
    db_role = _normalize_role_incoming(incoming_role)
    if not db_role:
        raise HTTPException(status_code=400, detail="Invalid role")

    department_id     = payload.get("department_id") or None
    primary_role_id   = payload.get("primary_role_id") or None
    secondary_role_id = payload.get("secondary_role_id") or None
    department        = payload.get("department") or None
    job_title         = payload.get("job_title") or None
    phone_number      = payload.get("phone_number") or None
    manager_id        = payload.get("manager_id") or None

    # 1) Create Supabase Auth user
    try:
        sb_admin = get_supabase_admin()
        password = _gen_password()
        redirect_to = f"{settings.APP_BASE_URL}/auth/confirm?email={quote(email)}"

        auth_user_id = None
        try:
            created = sb_admin.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": False,
            })
            if hasattr(created, "user") and getattr(created, "user"):
                auth_user_id = getattr(created.user, "id", None) or created.user.get("id")
        except Exception:
            pass

        link_res = sb_admin.auth.admin.generate_link({
            "type": "signup",
            "email": email,
            "options": {"redirect_to": redirect_to},
        })

        if not auth_user_id:
            if hasattr(link_res, "user") and getattr(link_res, "user"):
                auth_user_id = getattr(link_res.user, "id", None) or link_res.user.get("id")

        action_link = None
        if hasattr(link_res, "action_link"):
            action_link = link_res.action_link
        elif hasattr(link_res, "properties"):
            action_link = getattr(link_res.properties, "action_link", None)
        elif isinstance(link_res, dict):
            action_link = link_res.get("action_link")

        if not action_link:
            raise ValueError("Failed to extract signup link")

        with get_conn() as conn:
            with conn.cursor() as cur:
                enc = fernet.encrypt(password.encode()).decode()
                cur.execute(
                    """insert into verification.verification_pending_credentials(email, enc_password, created_at, expires_at)
                    values (%s,%s,now(),now()+interval '2 days')
                    on conflict (email) do update
                    set enc_password=excluded.enc_password, created_at=now(), expires_at=now()+interval '2 days'""",
                    (email, enc),
                )

        html = render_template("verification_link_sent.html", full_name=name or "there")
        html = html.replace("</body>", f'<p><a href="{action_link}">Verify your email</a></p></body>')
        send_email(email, "Verify your email to activate your account", html)

        if not auth_user_id:
            auth_user_id = _lookup_auth_user_id_by_email(sb_admin, email) or _lookup_auth_user_id_via_rest(email)
            if not auth_user_id:
                raise ValueError(f"Auth user lookup failed for {email}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EMP_CREATE_ERR: auth create/send failed: {_pg_err_msg(e)}")

    # 2) Insert org-level user row
    try:
        ures = sb.table("users").insert({
            "auth_user_id": auth_user_id,
            "email": email,
            "full_name": name,
            "role": db_role,
            "status": "pending",
            "organization_id": org_id,
        }).execute()
        udata = (ures.data[0] if isinstance(ures.data, list) and ures.data else None)
        if not udata:
            f = sb.table("users").select("*").eq("auth_user_id", auth_user_id).single().execute()
            udata = getattr(f, "data", None)
        if not udata:
            raise HTTPException(status_code=500, detail="EMP_CREATE_ERR: users insert returned no data")
    except Exception as e:
        msg = _pg_err_msg(e)
        if "duplicate key" in msg or "uq_" in msg or "23505" in msg:
            raise HTTPException(status_code=409, detail="User already exists")
        raise HTTPException(status_code=500, detail=f"EMP_CREATE_ERR: users insert failed: {msg}")

    # 3) Insert employee record
    body = {
        "org_id": org_id,
        "user_id": udata.get("id"),
        "auth_user_id": auth_user_id,
        "name": name,
        "email": email,
        "role": db_role,
        "phone_number": phone_number,
        "manager_id": manager_id,
        "department_id": department_id,
        "primary_role_id": primary_role_id,
        "secondary_role_id": secondary_role_id,
        "department": department,
        "job_title": job_title,
        "employee_number": payload.get("employee_number") or None,   # <--- new
    }

    try:
        ins = sb.table("employees").insert(body).execute()
        row = (ins.data[0] if isinstance(ins.data, list) and ins.data else None)
        if not row:
            got = sb.table("employees").select(EMP_SELECT_WITH_JOINS).eq("org_id", org_id).ilike("email", email).single().execute()
            row = getattr(got, "data", None)
        else:
            got = sb.table("employees").select(EMP_SELECT_WITH_JOINS).eq("org_id", org_id).eq("id", row["id"]).single().execute()
            row = getattr(got, "data", None) or row
        return {"employee": _map_row_db_to_app(row)}
    except Exception as e:
        msg = _pg_err_msg(e)
        if "uq_employees_org_email_lower" in msg or "duplicate key" in msg or "23505" in msg:
            raise HTTPException(status_code=409, detail="Email already exists for this organization")
        if "employees_role_check" in msg:
            raise HTTPException(status_code=400, detail="Invalid role")
        raise HTTPException(status_code=500, detail=f"EMP_CREATE_ERR: {msg}")

# --------------------------------------------------------------------------
# LIST
# --------------------------------------------------------------------------
@router.get("/{org_id}/employees")
def list_employees(
    org_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),  # cap to prevent huge pages
) -> Dict[str, Any]:
    # 1) Total count
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM public.employees e WHERE e.org_id = %s",
                (org_id,),
            )
            total: int = cur.fetchone()[0] or 0

            # 2) Page slice
            offset = (page - 1) * page_size
            cur.execute(
                """
                SELECT
                  e.id,
                  e.org_id,
                  e.user_id,
                  e.auth_user_id,
                  e.name,
                  e.email,
                  e.phone_number,
                  e.manager_id,
                  e.job_title,
                  e.role,
                  e.department,
                  e.department_id,
                  e.primary_role_id,
                  e.secondary_role_id,
                  e.employee_number,
                  d.name AS department_name,
                  pr.title AS primary_role_title,
                  sr.title AS secondary_role_title,

                  -- manager (employee) mini-profile
                  me.id        AS mgr_emp_id,
                  me.name      AS mgr_emp_name,
                  me.email     AS mgr_emp_email,
                  me.job_title AS mgr_emp_job_title,

                  e.status,
                  e.created_at,
                  e.updated_at
                FROM public.employees e
                LEFT JOIN public.departments d ON d.id = e.department_id
                LEFT JOIN public.roles pr       ON pr.id = e.primary_role_id
                LEFT JOIN public.roles sr       ON sr.id = e.secondary_role_id
                LEFT JOIN public.employees me   ON me.id = e.manager_id
                WHERE e.org_id = %s
                ORDER BY e.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (org_id, page_size, offset),
            )
            rows = cur.fetchall()

    cols = [
        "id","org_id","user_id","auth_user_id",
        "name","email", "phone_number","manager_id",
        "job_title","role","department",
        "department_id","primary_role_id","secondary_role_id", "employee_number",
        "department_name","primary_role_title","secondary_role_title",
        "mgr_emp_id","mgr_emp_name","mgr_emp_email","mgr_emp_job_title",
        "status","created_at","updated_at"
    ]
    items: List[Dict[str, Any]] = [dict(zip(cols, r)) for r in rows]

    # shape manager mini object
    for o in items:
        if o.get("mgr_emp_id"):
            o["manager_emp"] = {
                "id": o.pop("mgr_emp_id"),
                "name": o.pop("mgr_emp_name"),
                "email": o.pop("mgr_emp_email"),
                "job_title": o.pop("mgr_emp_job_title"),
            }
        else:
            o["manager_emp"] = None
            for k in ("mgr_emp_id","mgr_emp_name","mgr_emp_email","mgr_emp_job_title"):
                o.pop(k, None)

    # pagination meta
    total_pages = max(1, ceil(total / page_size)) if total else 1
    resp: Dict[str, Any] = {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
    return resp

# --------------------------------------------------------------------------
# GET ONE
# --------------------------------------------------------------------------
@router.get("/{org_id}/employees/{emp_id}")
def get_employee(org_id: str, emp_id: str):
    sb = get_supabase_service()
    try:
        res = sb.table("employees").select(EMP_SELECT_WITH_JOINS).eq("org_id", org_id).eq("id", emp_id).single().execute()
        data = getattr(res, "data", None)
        if not data:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {"employee": _map_row_db_to_app(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EMP_GET_ERR: {_pg_err_msg(e)}")

# --------------------------------------------------------------------------
# UPDATE
# --------------------------------------------------------------------------
@router.patch("/{org_id}/employees/{emp_id}")
def update_employee(org_id: str, emp_id: str, patch: Dict[str, Any]):
    sb = get_supabase_service()
    body: Dict[str, Any] = {}
    for k in [
        "name","email","phone_number","manager_id",
        "department","job_title","department_id","primary_role_id","secondary_role_id","role",
        "employee_number",
    ]:
        if k in patch and patch[k] is not None:
            body[k] = patch[k]

    if "email" in body:
        body["email"] = _normalize_email(body["email"])

    if "role" in body:
        mapped = _normalize_role_incoming(body["role"])
        if not mapped:
            raise HTTPException(status_code=400, detail="Invalid role")
        body["role"] = mapped

    try:
        sb.table("employees").update(body).eq("org_id", org_id).eq("id", emp_id).execute()
        got = sb.table("employees").select(EMP_SELECT_WITH_JOINS).eq("org_id", org_id).eq("id", emp_id).single().execute()
        data = getattr(got, "data", None)
        if not data:
            raise HTTPException(status_code=404, detail="Employee not found or not updated")
        return {"employee": _map_row_db_to_app(data)}
    except Exception as e:
        msg = _pg_err_msg(e)
        if "uq_employees_org_email_lower" in msg or "duplicate key" in msg or "23505" in msg:
            raise HTTPException(status_code=409, detail="Email already exists for this organization")
        if "employees_role_check" in msg:
            raise HTTPException(status_code=400, detail="Invalid role")
        raise HTTPException(status_code=500, detail=f"EMP_UPDATE_ERR: {msg}")

# --------------------------------------------------------------------------
# DELETE
# --------------------------------------------------------------------------

@router.delete("/{org_id}/employees/{emp_id}", status_code=204)
def delete_employee(
    org_id: str = Path(..., description="Organization ID"),
    emp_id: str = Path(..., description="Employee ID"),
):
    sb = get_supabase_service()

    try:
        # 1) Fetch employee row so we know user_id + auth_user_id
        res = (
            sb.table("employees")
            .select("id, org_id, user_id, auth_user_id, email")
            .eq("org_id", org_id)
            .eq("id", emp_id)
            .single()
            .execute()
        )
        emp = getattr(res, "data", None)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        user_id = emp.get("user_id")
        auth_user_id = emp.get("auth_user_id")

        # 2) Delete from employees + users in a DB transaction
        with get_conn() as conn:
            with conn.cursor() as cur:
                # delete employee row
                cur.execute(
                    "delete from public.employees where org_id = %s and id = %s",
                    (org_id, emp_id),
                )
                # delete linked org-level user row (if any)
                if user_id:
                    cur.execute(
                        "delete from public.users where id = %s",
                        (user_id,),
                    )

        # 3) Delete Supabase Auth user (best effort – don't fail whole request)
        if auth_user_id:
            try:
                sb_admin = get_supabase_admin()
                sb_admin.auth.admin.delete_user(auth_user_id)
            except Exception:
                # You can log this instead of failing the whole request
                # logger.warning("AUTH_DELETE_ERR: %s", _pg_err_msg(e_auth))
                pass

        return  # 204 No Content

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"EMP_DELETE_ERR: {_pg_err_msg(e)}",
        )
