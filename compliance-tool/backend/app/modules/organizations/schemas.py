# app/modules/organizations/schemas.py
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator

# ───────────────────────── helpers ─────────────────────────
def _strip_or_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v2 = v.strip()
    return v2 if v2 != "" else None

# ───────────────────────── Base ─────────────────────────

def _strip_or_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None

class OrgBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    # email: Optional[EmailStr] = None
    number: Optional[str] = Field(None, max_length=40)
    status: str = Field("inactive", max_length=32)

    @field_validator("name")
    @classmethod
    def _v_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name is required")
        return v

    @field_validator("description", "number", "status", mode="before")
    @classmethod
    def _v_trim_nullable(cls, v: Optional[str]) -> Optional[str]:
        return _strip_or_none(v)

    # ✅ Pydantic v2-safe: return a string (or None), not EmailStr(...)
    # @field_validator("email", mode="before")
    # @classmethod
    # def _v_email_lower(cls, v: Optional[str]) -> Optional[str]:
    #     v = _strip_or_none(v)
    #     return v.lower() if v else None

# ───────────────────────── Create / Update / Out ─────────────────────────
class OrgCreate(OrgBase):
    """Payload for insert. Matches nullable fields in DB (email/description/number/status optional)."""
    pass


class OrgUpdate(BaseModel):
    # All optional for PATCH-like updates; DB will keep existing values
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    # email: Optional[EmailStr] = None
    number: Optional[str] = Field(None, max_length=40)
    status: Optional[str] = Field(None, max_length=32)

    @field_validator("name")
    @classmethod
    def _v_name_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("description", "number", "status")
    @classmethod
    def _v_trim_nullable(cls, v: Optional[str]) -> Optional[str]:
        return _strip_or_none(v)

    # @field_validator("email")
    # @classmethod
    # def _v_email_lower(cls, v: Optional[EmailStr]) -> Optional[EmailStr]:
    #     return EmailStr(str(v).lower()) if v is not None else None


class OrgOut(OrgBase):
    # DB identity/metadata fields
    id: UUID
    created_at: datetime
    updated_at: datetime

    # DB FKs / optional metadata
    updated_by: Optional[UUID] = None          # FK to auth.users(id), nullable
    authentication_id: Optional[UUID] = None   # nullable
    verification_token: Optional[str] = None   # text
    verification_sent_at: Optional[datetime] = None

    # Allow returning from ORM/Row objects easily
    model_config = {
        "from_attributes": True
    }


class OrgListOut(BaseModel):
    items: List[OrgOut]
    total: int
    page: int
    limit: int

# ───────────────────────── Bulk payloads ─────────────────────────
class BulkCreateIn(BaseModel):
    items: List[OrgCreate]


class BulkUpdateItem(BaseModel):
    id: UUID
    patch: OrgUpdate


class BulkUpdateIn(BaseModel):
    items: List[BulkUpdateItem]


class BulkDeleteIn(BaseModel):
    ids: List[UUID]
