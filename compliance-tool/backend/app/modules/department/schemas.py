from __future__ import annotations
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field

class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = None

class DepartmentOut(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class BulkDelete(BaseModel):
    ids: List[str]