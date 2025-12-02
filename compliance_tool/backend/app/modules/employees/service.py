# app/modules/employees/service.py
from __future__ import annotations
from typing import Any, Dict, Optional, Tuple, List
import logging
from psycopg2 import errors
from supabase import Client
from app.db.session import get_conn
from app.deps.clients import get_supabase_service
from app.modules.auth.service import register_user, _find_user_id_by_email

logger = logging.getLogger(__name__)

ALLOWED_CREATOR_ROLES = {"superadmin", "org_admin", "hr", "hod"}

def _ensure_creator_allowed(payload_jwt: Dict[str, Any]) -> None:
    role = (
        (payload_jwt.get("app_metadata") or {}).get("role")
        or (payload_jwt.get("user_metadata") or {}).get("app_role")
        or payload_jwt.get("role")
        or ""
    )
    if role not in ALLOWED_CREATOR_ROLES:
        raise PermissionError("Not allowed to create employees")

# -----------------------------------------------------------------------------
# CORE EMPLOYEE CREATION FLOW
# -----------------------------------------------------------------------------
def create_employee_with_auth(
    org_id: str,
    data: Dict[str, Any],
    creator_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Creates an employee while also provisioning an Auth user if needed.
    Supports both legacy (department, job_title) and new relational fields:
      department_id, primary_role_id, secondary_role_id
    """

    if creator_payload is not None:
        _ensure_creator_allowed(creator_payload)

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role  = (data.get("role")  or "").strip().lower()
    phone = (data.get("phone_number") or "").strip() or None
    dept  = (data.get("department") or "").strip() or None
    title = (data.get("job_title") or "").strip() or None
    manager_id = (data.get("manager_id") or "").strip() or None

    # new FK fields
    department_id     = (data.get("department_id") or None)
    primary_role_id   = (data.get("primary_role_id") or None)
    secondary_role_id = (data.get("secondary_role_id") or None)

    if not name or not email:
        raise ValueError("name and email are required")
    if role not in {"employee", "hr", "org_admin", "hod"}:
        raise ValueError("Invalid role")

    logger.info("EMP_CREATE org=%s email=%s role=%s", org_id, email, role)

    # 1) Register user (creates auth user if needed)
    try:
        register_user(email=email, full_name=name, role=role)
    except Exception as e:
        logger.warning("register_user warning: %s", e)

    sb: Client = get_supabase_service()

    # 2) Upsert into public.users
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.users(email, full_name, role, status, organization_id)
                VALUES (%s, %s, %s,
                        coalesce((SELECT status FROM public.users WHERE lower(email)=lower(%s) LIMIT 1), 'pending'),
                        %s)
                ON CONFLICT (email) DO UPDATE
                    SET full_name=excluded.full_name,
                        role=excluded.role,
                        organization_id=excluded.organization_id
                RETURNING id
                """,
                (email, name, role, email, org_id),
            )
            user_row = cur.fetchone()
            user_id = user_row[0] if user_row else None

    # Resolve auth user id if exists
    auth_user_id: Optional[str] = None
    try:
        auth_user_id = _find_user_id_by_email(sb, email)
        if auth_user_id:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.users SET auth_user_id=%s WHERE id=%s",
                        (auth_user_id, user_id),
                    )
    except Exception as e:
        logger.debug("auth_user_id resolution failed: %s", e)

    # 3) Insert employee (support both new *_id fields + legacy text)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.employees(
                    org_id, user_id, auth_user_id,
                    name, email, phone_number, manager_id,
                    job_title, role, department,
                    department_id, primary_role_id, secondary_role_id
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id, created_at, updated_at
                """,
                (
                    org_id, user_id, auth_user_id,
                    name, email, phone, manager_id,
                    title, role, dept,
                    department_id, primary_role_id, secondary_role_id
                ),
            )
            emp_row = cur.fetchone()

    return {
        "employee": {
            "id": emp_row[0],
            "org_id": org_id,
            "user_id": user_id,
            "auth_user_id": auth_user_id,
            "name": name,
            "email": email,
            "phone_number": phone,
            "manager_id": manager_id,
            "job_title": title,
            "role": role,
            "department": dept,
            "department_id": department_id,
            "primary_role_id": primary_role_id,
            "secondary_role_id": secondary_role_id,
            "status": "active",
            "created_at": emp_row[1],
            "updated_at": emp_row[2],
        }
    }

# -----------------------------------------------------------------------------
# LIST EMPLOYEES (with new joins)
# -----------------------------------------------------------------------------
def list_employees(org_id: str) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  e.id, e.org_id, e.user_id, e.auth_user_id,
                  e.name, e.email, e.phone_number, e.manager_id,
                  e.job_title, e.role, e.department,
                  e.department_id, e.primary_role_id, e.secondary_role_id,
                  d.name AS department_name,
                  pr.title AS primary_role_title,
                  sr.title AS secondary_role_title,
                  e.status, e.created_at, e.updated_at
                FROM public.employees e
                LEFT JOIN public.departments d ON d.id = e.department_id
                LEFT JOIN public.roles pr ON pr.id = e.primary_role_id
                LEFT JOIN public.roles sr ON sr.id = e.secondary_role_id
                WHERE e.org_id = %s
                ORDER BY e.created_at DESC
                """,
                (org_id,),
            )
            rows = cur.fetchall()

    cols = [
        "id","org_id","user_id","auth_user_id",
        "name","email","phone_number","manager_id",
        "job_title","role","department",
        "department_id","primary_role_id","secondary_role_id",
        "department_name","primary_role_title","secondary_role_title",
        "status","created_at","updated_at"
    ]
    return [dict(zip(cols, r)) for r in rows]

# -----------------------------------------------------------------------------
# SUPPORT FUNCTIONS FOR REUSABLE EMPLOYEE CREATION
# -----------------------------------------------------------------------------
ALLOWED_EMP_ROLES = {"employee", "hr", "hod", "org_admin"}

def _normalize_payload(org_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    role = (payload.get("role") or "").strip().lower()

    department = (payload.get("department") or None)
    job_title = (payload.get("job_title") or None)
    phone_number = (payload.get("phone_number") or None)
    manager_id = (payload.get("manager_id") or None)

    # new relational IDs
    department_id     = payload.get("department_id") or None
    primary_role_id   = payload.get("primary_role_id") or None
    secondary_role_id = payload.get("secondary_role_id") or None
    employee_number = payload.get("employee_number") or None

    if not name:
        raise ValueError("name is required")
    if not email:
        raise ValueError("email is required")
    if role not in ALLOWED_EMP_ROLES:
        raise ValueError(f"Invalid role '{role}'. Allowed: {sorted(ALLOWED_EMP_ROLES)}")

    def _clean(s: Optional[str]) -> Optional[str]:
        if s is None:
            return None
        s2 = str(s).strip()
        return s2 or None

    return {
        "org_id": str(org_id),
        "name": name,
        "email": email,
        "role": role,
        "department": _clean(department),
        "job_title": _clean(job_title),
        "phone_number": _clean(phone_number),
        "manager_id": _clean(manager_id),
        "department_id": department_id,
        "primary_role_id": primary_role_id,
        "secondary_role_id": secondary_role_id,
        "employee_number": _clean(employee_number),
    }

def _ensure_auth_and_queue_credentials(email: str, full_name: str, role: str) -> Optional[str]:
    register_user(email=email, full_name=full_name, role=role)
    try:
        supa_admin = get_supabase_service().auth.admin
        return _find_user_id_by_email(supa_admin, email)
    except Exception as e:
        logger.debug("Could not resolve auth user id for %s: %s", email, e)
        return None

def _upsert_user(email: str, full_name: str, role: str, org_id: str, auth_user_id: Optional[str]) -> Tuple[str, str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.users (email, full_name, role, status, organization_id, auth_user_id)
                VALUES (%s, %s, %s, 'pending', %s, %s)
                ON CONFLICT (email) DO UPDATE
                   SET full_name       = EXCLUDED.full_name,
                       role            = EXCLUDED.role,
                       organization_id = EXCLUDED.organization_id,
                       auth_user_id    = COALESCE(EXCLUDED.auth_user_id, public.users.auth_user_id),
                       status          = CASE
                                           WHEN public.users.status = 'active' THEN 'active'
                                           ELSE 'pending'
                                         END
                RETURNING id::text, status
                """,
                (email, full_name, role, org_id, auth_user_id)
            )
            uid, status = cur.fetchone()
            return uid, status

def _insert_employee_row(clean: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.employees
                    (org_id, user_id, name, email, phone_number, manager_id,
                    job_title, role, department,
                    department_id, primary_role_id, secondary_role_id, employee_number)
                VALUES
                    (%s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s)
                RETURNING
                    id::text, org_id::text, user_id::text, name, email, phone_number, manager_id::text,
                    job_title, role, department,
                    department_id::text, primary_role_id::text, secondary_role_id::text,
                    created_at
                """,
                (
                    clean["org_id"], user_id, clean["name"], clean["email"],
                    clean["phone_number"], clean["manager_id"],
                    clean["job_title"], clean["role"], clean["department"],
                    clean["department_id"], clean["primary_role_id"], clean["secondary_role_id"],
                    clean.get("employee_number"),
                ),
            )
            row = cur.fetchone()
            return {
                "id": row[0],
                "org_id": row[1],
                "user_id": row[2],
                "name": row[3],
                "email": row[4],
                "phone_number": row[5],
                "manager_id": row[6],
                "job_title": row[7],
                "role": row[8],
                "department": row[9],
                "department_id": row[10],
                "primary_role_id": row[11],
                "secondary_role_id": row[12],
                "created_at": row[13],
            }

def create_employee_for_org(org_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    clean = _normalize_payload(org_id, payload)
    email, name, role = clean["email"], clean["name"], clean["role"]

    logger.info("EMP_CREATE start org=%s email=%s role=%s", org_id, email, role)

    auth_user_id = _ensure_auth_and_queue_credentials(email=email, full_name=name, role=role)

    try:
        user_id, user_status = _upsert_user(email=email, full_name=name, role=role, org_id=clean["org_id"], auth_user_id=auth_user_id)
    except Exception as e:
        logger.error("EMP_CREATE users upsert failed: %s", e)
        raise

    try:
        emp_row = _insert_employee_row(clean, user_id)
    except errors.UniqueViolation as ue:
        raise ValueError("Employee already exists for this organization") from ue
    except Exception as e:
        logger.error("EMP_CREATE employees insert failed: %s", e)
        raise

    logger.info("EMP_CREATE done org=%s email=%s id=%s", org_id, email, emp_row["id"])

    return {
        "employee": emp_row,
        "user": {
            "id": user_id,
            "email": email,
            "full_name": name,
            "role": role,
            "status": user_status,
            "auth_user_id": auth_user_id,
        },
        "note": "Verification email sent to the employee via Supabase.",
    }
