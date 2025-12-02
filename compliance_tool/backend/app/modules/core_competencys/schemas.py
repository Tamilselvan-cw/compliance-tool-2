# app/modules/core_competencys/schemas.py
from __future__ import annotations
from enum import Enum
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

# reuse the enum you already have for competencys
from app.modules.competencys.schemas import SkillCategory
# SkillCategory: technical | functional | behavioral

class CoreCompetencyCategory(str, Enum):
    technical = "technical"
    functional = "functional"
    behavioral = "behavioral"

class CoreCompetencyBase(BaseModel):
    name: str = Field(..., min_length=1)
    category: CoreCompetencyCategory
    description: Optional[str] = None
    required_level: Optional[int] = Field(None, ge=1, le=5)
    is_active: bool = True

class CoreCompetencyCreate(CoreCompetencyBase):
    pass

class CoreCompetencyOut(CoreCompetencyBase):
    id: UUID
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CoreCompetencyUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CoreCompetencyCategory] = None
    description: Optional[str] = None
    required_level: Optional[int] = Field(None, ge=1, le=5)
    is_active: Optional[bool] = None

class CoreCompetencyListOut(BaseModel):
    items: List[CoreCompetencyOut]
    total: int
    page: int
    limit: int
