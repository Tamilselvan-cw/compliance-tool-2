from __future__ import annotations
from typing import Any, Dict
from supabase import Client
from app.config.settings import settings
from app.deps.clients import get_supabase_service
from app.db.session import get_conn
from app.utils.emailer import render_template, send_email
from app.modules.auth.service import _find_user_id_by_email, _finalize_activation_and_send_creds, register_user
import logging
from fastapi import Depends, HTTPException

logger = logging.getLogger(__name__)

def create_org_with_owner(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new organization and its owner.

    Flow:
      1) Validate inputs
      2) Register owner (sends Supabase verification link)
      3) Insert organization into DB (public.organizations)
      4) Insert owner into public.users + public.employees as org_admin
      5) Send org-created email
    """

    owner_email = (payload.get("email") or "").strip().lower()
    owner_name = payload.get("owner_name") or payload.get("name") or "Owner"
    role = payload.get("role") or "org_admin"
    org_name = payload.get("org_name") or payload.get("organization_name") or payload.get("name")

    if not owner_email:
        raise ValueError("Missing 'email' for owner account.")
    if not org_name:
        raise ValueError("Organization name missing. Provide 'org_name' or 'name'.")

    logger.info("ORG_CREATE start for org=%s owner=%s", org_name, owner_email)

    # 1️⃣ Step: create Supabase Auth user (pending) – sends verification link
    try:
        register_user(owner_email, owner_name, role)
        logger.debug("ORG_CREATE[1] register_user triggered verification link")
    except Exception as e:
        logger.error("ORG_CREATE[1] register_user failed: %s", e)
        raise

    # 2️⃣ Step: insert organization row
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.organizations(name, email, status, created_at)
                   VALUES (%s, %s, 'pending', now())
                   RETURNING id, name, status, created_at""",
                (org_name, owner_email),
            )
            org_row = cur.fetchone()
            if not org_row:
                raise RuntimeError("Failed to insert organization")

    org_id, org_name, status, created_at = org_row

    # 3️⃣ Step: link any existing user row to this organization (legacy safety)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE public.users
                   SET organization_id = %s
                   WHERE lower(email) = %s""",
                (org_id, owner_email),
            )

    # 4️⃣ Step: ensure an org-level user + employee row exists for the owner
    auth_user_id = None
    try:
        # Try to resolve auth user from Supabase Auth (non-fatal if missing)
        auth_user_id = _find_user_id_by_email(owner_email)
    except Exception as e:
        logger.warning("ORG_CREATE[4] _find_user_id_by_email failed: %s", e)

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # 4a) upsert into public.users for this org
                cur.execute(
                    """
                    SELECT id FROM public.users
                    WHERE organization_id = %s AND lower(email) = lower(%s)
                    """,
                    (org_id, owner_email),
                )
                user_row = cur.fetchone()
                if user_row:
                    user_id = user_row[0]
                    # keep it simple: update name/role if needed
                    cur.execute(
                        """
                        UPDATE public.users
                        SET full_name = %s,
                            role = %s,
                            auth_user_id = COALESCE(auth_user_id, %s)
                        WHERE id = %s
                        """,
                        (owner_name, role, auth_user_id, user_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO public.users (auth_user_id, email, full_name, role, status, organization_id, created_at)
                        VALUES (%s, %s, %s, %s, 'pending', %s, now())
                        RETURNING id
                        """,
                        (auth_user_id, owner_email, owner_name, role, org_id),
                    )
                    user_id = cur.fetchone()[0]

                # 4b) insert into public.employees if not already present
                cur.execute(
                    """
                    SELECT id FROM public.employees
                    WHERE org_id = %s AND lower(email) = lower(%s)
                    """,
                    (org_id, owner_email),
                )
                emp_row = cur.fetchone()
                if not emp_row:
                    cur.execute(
                        """
                        INSERT INTO public.employees
                            (org_id, user_id, auth_user_id, name, email, role, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, now())
                        """,
                        (org_id, user_id, auth_user_id, owner_name, owner_email, role),
                    )

        logger.info("ORG_CREATE[4] owner added as employee org_admin (org_id=%s)", org_id)

    except Exception as e:
        # Not fatal for org creation, but we log it so you can debug
        logger.error("ORG_CREATE[4] failed to insert owner into employees: %s", e)

    # 5️⃣ Step: send "organization created" email (non-fatal)
    try:
        html = render_template(
            "organization_created.html",
            org_name=org_name,
            owner_name=owner_name,
            email=owner_email,
        )
        send_email(owner_email, f"Organization {org_name} Created", html)
    except Exception as e:
        logger.warning("ORG_CREATE[5] email send failed (non-fatal): %s", e)

    logger.info("ORG_CREATE complete for %s", org_name)

    return {
        "organization": {
            "id": org_id,
            "name": org_name,
            "status": status,
            "created_at": created_at,
        },
        "owner": {
            "email": owner_email,
            "name": owner_name,
            "role": role,
            "auth_user_id": auth_user_id,
        },
        "note": "Verification email sent to owner via Supabase.",
    }
