# app/modules/levels/schemas.py
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime  # ✅ add

class LevelBase(BaseModel):
    name: str
    description: Optional[str] = None
    score: int
    is_active: Optional[bool] = True

class LevelCreate(LevelBase):
    pass

class LevelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    score: Optional[int] = None
    is_active: Optional[bool] = None

class LevelOut(LevelBase):
    id: UUID
    organization_id: Optional[UUID]
    created_at: datetime             # ✅ accept datetime
    updated_at: Optional[datetime] = None  # ✅ accept datetime or None

class LevelListOut(BaseModel):
    items: list[LevelOut]
    total: int
    page: int
    limit: int
