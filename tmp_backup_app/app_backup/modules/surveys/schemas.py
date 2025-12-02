from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime


SurveyStatus = Literal["draft", "completed", "inprogress"]


# ---------- Inputs ----------
class SurveyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Literal["draft", "active", "closed"] = "draft"
    role_ids: List[UUID] = []  # now accepted from FE

    @field_validator("name")
    @classmethod
    def _name_trim(cls, v: str) -> str:
        v2 = v.strip()
        if not v2:
            raise ValueError("name cannot be empty")
        return v2


class SurveyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[SurveyStatus] = None
    role_ids: Optional[List[UUID]] = None

    @field_validator("name")
    @classmethod
    def _name_trim(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v


# ---------- Outputs ----------

class SurveyOut(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    description: Optional[str] = None
    status: Literal["draft", "active", "closed"]
    role_ids: Optional[List[UUID]] = []  # new in output
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class SurveyListOut(BaseModel):
    items: List[SurveyOut]
    total: int
    page: int
    limit: int
