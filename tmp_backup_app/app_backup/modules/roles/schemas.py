from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime
from decimal import Decimal

JobTypeLiteral = Literal["regular", "hybrid", "remote"]

class RoleBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    department_id: UUID
    experience_years: Optional[Decimal] = Field(default=None, ge=0, le=60)
    experience_level: Optional[int] = Field(default=None, ge=0, le=60)
    is_active: bool = False  # frontend will toggle to true after setup

    # 👇 job type stays enum (regular / hybrid / remote)
    job_type: Optional[JobTypeLiteral] = Field(default=None)

    # 👇 education is now FREE TEXT (no enum / Literal)
    #    frontend will still show dropdown + extra input for "Others"
    education_qualification: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Any free-text education value like SSLC, BSc, etc.",
    )


class RoleCreate(RoleBase):
    # we only keep descriptions here; specs removed from UI/backend
    job_descriptions: List[str]


class RoleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    department_id: Optional[UUID] = None
    experience_years: Optional[Decimal] = Field(default=None, ge=0, le=60)
    experience_level: Optional[int] = Field(default=None, ge=0, le=60)
    is_active: Optional[bool] = None

    job_descriptions: Optional[List[str]] = None

    job_type: Optional[JobTypeLiteral] = None

    # 👇 also free text in update
    education_qualification: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Any free-text education value like SSLC, BSc, etc.",
    )


class RoleOut(RoleBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

    # auto-generated code (nullable)
    role_code: Optional[str] = Field(
        default=None,
        max_length=60,
        description="Auto-generated role code (unique per organization)."
    )

    job_descriptions: List[str] = []

class RoleListOut(BaseModel):
    items: List[RoleOut]
    total: int
    page: int
    limit: int