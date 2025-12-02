# schemas/analytics.py
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID

class SkillTrendItem(BaseModel):
    competency_id: UUID
    key: str = Field(..., description="Competency name (display key)")
    current_avg: Optional[float] = Field(None, description="Average current level")
    expected_avg: Optional[float] = Field(None, description="Average expected level")
    count: int = Field(..., description="Number of cells used to compute averages")


class RoleAverageItem(BaseModel):
    role_id: UUID
    key: str = Field(..., description="Role title (display key)")
    current_avg: Optional[float] = None
    expected_avg: Optional[float] = None
    count: int


class DepartmentAverageItem(BaseModel):
    department_id: Optional[UUID] = None
    key: str = Field(..., description="Department name or 'Unassigned'")
    current_avg: Optional[float] = None
    expected_avg: Optional[float] = None
    count: int


class MatrixSummary(BaseModel):
    total_competencies: int
    total_employees: int
    filled_cells: int
    coverage_pct: Optional[float] = None
