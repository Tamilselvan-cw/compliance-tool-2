from __future__ import annotations
from pydantic import BaseModel, EmailStr
from typing import Literal, Optional, List

Role = Literal["superadmin", "org_admin", "manager", "staff", "user"]

class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: Role = "user"   # who they will be

class RegisterOut(BaseModel):
    message: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    as_role: Optional[Role] = None   # optional: login “as” a specific role

class LoginOut(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    user_id: str
    email: str
    role: str
    permissions: List[str]

class RegistrationError(Exception):
    pass

# app/modules/auth/schemas.py

class MeOut(BaseModel):
    user_id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    permissions: List[str]
    status: str
    organization_id: Optional[str] = None  # 👈 NEW


class RefreshIn(BaseModel):
    refresh_token: str
class RefreshOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
