from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class RolecompetencyCreate(BaseModel):
    competency_name: str = Field(min_length=2, max_length=200)
    category: str = Field(pattern="^(technical|functional|behavioral)$")
    expected_level: int = Field(ge=1, le=60)
    description: Optional[str] = Field(default=None, max_length=2000)
    competency_code: Optional[str] = Field(default=None, max_length=200)  # <- new

# Bulk payload wrapper
class RolecompetencyBulkCreate(BaseModel):
    items: List[RolecompetencyCreate]

# Returned competency info
class competencyMini(BaseModel):
    id: UUID
    name: str
    category: str
    description: Optional[str] = None
    competency_code: Optional[str] = None  # <- new

class RolecompetencyOut(BaseModel):
    id: UUID
    role_id: UUID
    competency_id: UUID
    expected_level: int
    created_at: datetime
    updated_at: datetime
    competency: Optional[competencyMini] = None

class RolecompetencyListOut(BaseModel):
    items: List[RolecompetencyOut]
    total: int
    page: int
    limit: int
