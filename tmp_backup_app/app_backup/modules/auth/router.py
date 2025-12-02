from __future__ import annotations
from app.modules.auth.schemas import RegisterIn, RegisterOut, LoginIn, LoginOut, RefreshOut, RefreshIn
from app.modules.auth.service import register_user, confirm_and_send_credentials, login, confirm_from_redirect, resend_verification, refresh_access_token
from fastapi import APIRouter, HTTPException, Query, Request
from app.utils.html import render_confirm_page
from fastapi import Header
from app.modules.auth.schemas import MeOut
from app.modules.auth.service import get_me
from typing import Optional, Annotated

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn):
    try:
        register_user(payload.email, payload.full_name, payload.role)
        return {"message": "Verification email sent. Please check your inbox."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"REGISTER_ERR: {e}")
 
@router.post("/login", response_model=LoginOut)
def login_route(payload: LoginIn):
    try:
        token, user_id, email, role, perms, refresh = login(payload.email, payload.password, payload.as_role)
        return {"access_token": token, "refresh_token": refresh, "user_id": user_id, "email": email, "role": role, "permissions": perms}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"LOGIN_ERR: {e}")

@router.get("/confirm")
def confirm(
    request: Request,
    email: Optional[str] = Query(None),
    token_hash: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    typ: Optional[str] = Query(None, alias="type"),
    access_token: Optional[str] = Query(None),
):
    try:
        # 1) “fragment forwarded” flow (if you add a frontend later)
        if access_token:
            verified_email = confirm_and_send_credentials(access_token)
            return render_confirm_page(
                "Email Verified",
                f"<h1 class='ok'>Email verified</h1><p>{verified_email} has been activated.</p><a class='btn btn-primary' href='{request.url.scheme}://{request.url.netloc}'>Continue</a>"
            )

        # 2) normal server flow
        any_token = token_hash or token or code
        if (any_token and email) or (email and not any_token):
            verified_email = confirm_from_redirect(email=email, token_hash=any_token, typ=typ or "signup")
            return render_confirm_page(
                "Email Verified",
                f"<h1 class='ok'>Email verified</h1><p>{verified_email} has been activated. Your credentials were emailed to you.</p>"
                f"<a class='btn btn-primary' href='{request.url.scheme}://{request.url.netloc}'>Go to app</a>"
            )

        # 3) nothing useful in query — show helpful page instead of JSON error
        return render_confirm_page(
            "Verification Link Invalid",
            "<h1 class='err'>Verification link invalid or expired</h1>"
            "<p>The verification link is missing required data. Please request a new link.</p>"
            "<form method='get' action='/auth/resend'>"
            "<label>Resend to email</label><input type='email' name='email' required>"
            "<button class='btn btn-primary' type='submit'>Resend link</button>"
            "</form>"
        )

    except Exception as e:
        # Friendly HTML error (and keep the resend UI)
        return render_confirm_page(
            "Verification Error",
            f"<h1 class='err'>Verification failed</h1><p>{str(e)}</p>"
            "<form method='get' action='/auth/resend'>"
            "<label>Resend to email</label><input type='email' name='email' required>"
            "<button class='btn btn-primary' type='submit'>Resend link</button>"
            "</form>"
        )

@router.get("/resend")
def resend(email: str = Query(..., description="Email to resend verification link")):
    try:
        link = resend_verification(email)
        return {"message": "Verification email resent.", "debug_action_link": link}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"RESEND_ERR: {e}")

@router.get("/me", response_model=MeOut)
def me(authorization: Annotated[Optional[str], Header(alias="Authorization")] = None):
    """
    Reads Bearer token from Authorization header and returns the current user.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    access_token = authorization.split(" ", 1)[1].strip()
    try:
        user_id, email, full_name, role, perms, status, organization_id = get_me(access_token)
        return MeOut(
            user_id=user_id,
            email=email,
            full_name=full_name,
            role=role,
            permissions=perms,
            status=status,
            organization_id=organization_id,  # 👈 send it to the client
        )
    except Exception as e:
        # Keep the error short for security; prepend ME_ERR for frontend parsing
        raise HTTPException(status_code=401, detail=f"ME_ERR: {e}")

@router.post("/refresh", response_model=RefreshOut)
def refresh_route(body: RefreshIn):
    try:
        access, new_refresh = refresh_access_token(body.refresh_token)
        return {"access_token": access, "refresh_token": new_refresh}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"REFRESH_ERR: {e}")
