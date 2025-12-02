# app/modules/employees/schemas.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum

class AppRole(str, Enum):
    employee = "employee"
    hr       = "hr"
    org_admin= "org_admin"
    hod      = "hod"

# Small nested display objects (for FE convenience)
class DeptMini(BaseModel):
    id: str
    name: str

class RoleMini(BaseModel):
    id: str
    title: Optional[str] = None
    name: Optional[str] = None

class EmployeeBase(BaseModel):
    name: str
    email: EmailStr
    role: AppRole

    department_id: str
    primary_role_id: str
    secondary_role_id: Optional[str] = None

    # new: custom employee number / code entered by user
    employee_number: Optional[str] = None

    # legacy (optional)
    department: Optional[str] = None
    job_title: Optional[str] = None
    phone_number: Optional[str] = None

    # manager links
    manager_id: Optional[str] = None            # existing: employees.id
    manager_user_id: Optional[str] = None       # NEW: users.id


class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[AppRole] = None

    department_id: Optional[str] = None
    primary_role_id: Optional[str] = None
    secondary_role_id: Optional[str] = None

    department: Optional[str] = None
    job_title: Optional[str] = None
    phone_number: Optional[str] = None

    manager_id: Optional[str] = None
    manager_user_id: Optional[str] = None


class EmployeeOut(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str] = None
    auth_user_id: Optional[str] = None
    name: str
    email: EmailStr
    role: AppRole
    employee_number: Optional[str] = None

    department_id: Optional[str] = None
    primary_role_id: Optional[str] = None
    secondary_role_id: Optional[str] = None

    department: Optional[DeptMini] = None
    primary_role: Optional[RoleMini] = None
    secondary_role: Optional[RoleMini] = None

    job_title: Optional[str] = None
    phone_number: Optional[str] = None

    manager_id: Optional[str] = None               # employee FK
    manager_user_id: Optional[str] = None          # NEW user FK
    manager_user: Optional[UserMini] = None        # hydrated

    status: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserMini(BaseModel):
    id: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
