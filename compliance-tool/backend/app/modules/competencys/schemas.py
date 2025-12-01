from __future__ import annotations
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class competencyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(pattern="^(technical|functional|behavioral)$")
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = True
    scope: str = Field(default="organization")  # ensure client passes scope when needed
    organization_id: Optional[UUID] = None  # optional for create payload

class competencyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    category: Optional[str] = Field(default=None, pattern="^(technical|functional|behavioral)$")
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None
    scope: Optional[str] = None
    organization_id: Optional[UUID] = None

class competencyOut(BaseModel):
    id: UUID
    organization_id: Optional[UUID]  # allow None for core scope
    name: str
    category: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    scope: str

class competencyListOut(BaseModel):
    items: List[competencyOut]
    total: int
    page: int
    limit: int

class SkillCategory(str, Enum):
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    FUNCTIONAL = "functional"

class SkillCreatedFor(str, Enum):
    CORE = "CORE"
    ORGANIZATION = "ORGANIZATION"
    ROLE_BASED = "ROLE_BASED"

class competencyBulkItem(BaseModel):
    name: str
    category: SkillCategory
    description: Optional[str] = None
    is_active: Optional[bool] = True
    scope: Optional[str] = "organization"
    organization_id: Optional[UUID] = None

class competencyBulkCreate(BaseModel):
    items: List[competencyBulkItem]
