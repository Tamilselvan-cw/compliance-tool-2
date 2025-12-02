# # schemas.py
# from __future__ import annotations
# from pydantic import BaseModel, Field
# from typing import Optional, List
# from uuid import UUID
# from datetime import datetime

# class ERSCreateByName(BaseModel):
#     competency_name: str = Field(min_length=2, max_length=200)
#     category: str = Field(pattern="^(technical|functional|behavioral)$")
#     current_level: int = Field(ge=1, le=10)
#     expected_level: Optional[int] = Field(default=None, ge=1, le=60)
#     source: Optional[str] = Field(default="manual", max_length=50)
#     description: Optional[str] = Field(default=None, max_length=2000)
#     remarks: Optional[str] = Field(default=None, max_length=2000)

# class ERSCreateById(BaseModel):
#     competency_id: UUID
#     current_level: int = Field(ge=1, le=10)
#     expected_level: Optional[int] = Field(default=None, ge=1, le=60)
#     source: Optional[str] = Field(default="manual", max_length=50)
#     remarks: Optional[str] = Field(default=None, max_length=2000)

# class ERSBulkUpsertByName(BaseModel):
#     items: List[ERSCreateByName]

# class ERSBulkUpsertById(BaseModel):
#     items: List[ERSCreateById]

# class competencyMini(BaseModel):
#     id: UUID
#     name: str
#     category: str
#     description: Optional[str] = None

# class EmployeeRolecompetencyOut(BaseModel):
#     id: UUID
#     org_id: UUID
#     employee_id: UUID
#     role_id: UUID
#     competency_matrix_id: UUID        # NEW canonical
#     # survey_id is deprecated — omit from output or keep optional if you must expose it:
#     # survey_id: Optional[UUID] = None
#     competency_id: UUID
#     current_level: int
#     expected_level: Optional[int] = None
#     source: Optional[str] = None
#     remarks: Optional[str] = None
#     updated_by: Optional[UUID] = None
#     updated_at: datetime
#     competency: Optional[competencyMini] = None

# class ERSListOut(BaseModel):
#     items: List[EmployeeRolecompetencyOut]
#     total: int
#     page: int
#     limit: int


# app/modules/employee_role_competency/schemas.py
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID
from pydantic import BaseModel

class EmployeeRoleCompetencyItemIn(BaseModel):
    role_id: UUID
    competency_id: UUID
    level: int = Field(..., ge=0)
    remarks: str | None = None


class EmployeeRoleCompetencyBulkIn(BaseModel):
    employee_id: UUID
    items: List[EmployeeRoleCompetencyItemIn]


class EmployeeRoleCompetencyOut(BaseModel):
    id: UUID
    employee_id: UUID
    role_id: UUID
    competency_id: UUID
    level: int
    remarks: str | None = None


class EmployeeRoleCompetencyListOut(BaseModel):
    items: List[EmployeeRoleCompetencyOut]
