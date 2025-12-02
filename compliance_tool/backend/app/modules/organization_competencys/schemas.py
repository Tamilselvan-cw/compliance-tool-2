from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

# ==========================
# ORG-LEVEL COMPETENCYS
# ==========================

class OrgCompetencyBase(BaseModel):
    competency_id: UUID
    required_level: Optional[int] = None
    weight: Optional[int] = None
    is_active: bool = True


class OrgCompetencyCreate(OrgCompetencyBase):
    """
    Body for POST /organizations/{org_id}/organization-competencys
    org_id comes from path; created_by is set from actor_user_id in service.
    """
    pass


class OrgCompetencyUpdate(BaseModel):
    required_level: Optional[int] = None
    weight: Optional[int] = None
    is_active: Optional[bool] = None


class OrgCompetencyOut(OrgCompetencyBase):
    id: UUID
    organization_id: UUID
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrgCompetencyListOut(BaseModel):
    items: List[OrgCompetencyOut]
    total: int
    page: int
    limit: int
