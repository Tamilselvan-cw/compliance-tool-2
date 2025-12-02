from __future__ import annotations
from typing import List, Optional, Dict
from pydantic import BaseModel
from uuid import UUID

class CompetencyDictItem(BaseModel):
    competency_id: UUID
    competency_name: str
    competency_code: Optional[str] = None
    competency_description: Optional[str] = None
    competency_category: Optional[str] = None
    competency_scope: Optional[str] = None    # <-- added

    # make these optional (they can be None for canonical competency rows)
    expected_level: Optional[int] = None
    level_name: Optional[str] = None

    role_id: Optional[UUID] = None
    role_code: Optional[str] = None
    role_name: Optional[str] = None

    department_id: Optional[UUID] = None
    department_code: Optional[str] = None
    department_name: Optional[str] = None

    # optional extras
    roles_count: Optional[int] = None
    role_ids: Optional[List[UUID]] = None
    roles: Optional[List[dict]] = None
    roles_by_department: Optional[Dict[str, List[dict]]] = None
    


class CompetencyDictListOut(BaseModel):
    items: List[CompetencyDictItem]
    total: int
    page: int
    limit: int
