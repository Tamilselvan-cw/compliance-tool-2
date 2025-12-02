# app/routers/__init__.py
from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.routers.debug_db import router as debug_router
from app.routers.organizations import router as org_router
from app.modules.employees.router import router as employees_router
from app.modules.employees.heirarchy import router as heirarchy_router
from app.modules.department.router import router as department_router
from app.modules.levels.router import router as levels_router
from app.modules.roles.router import router as roles_router
from app.modules.competencys.router import router as competencys_router
from app.modules.role_competencys.router import router as role_competencys_router
from app.modules.employee_role_competency.router import router as employee_role_competency_router
from app.modules.surveys.router import router as surveys_router
from app.modules.analytics.router import router as analytics_router
from app.modules.competency.router import router as competency_router
from app.modules.core_competencys.router import router as core_competencys_router
from app.modules.organization_competencys.router import router as org_competencys_router

api = APIRouter()
api.include_router(auth_router)
api.include_router(debug_router)
api.include_router(org_router)
api.include_router(employees_router)
api.include_router(department_router)
api.include_router(levels_router)
api.include_router(roles_router)
api.include_router(competencys_router)
api.include_router(role_competencys_router)
api.include_router(employee_role_competency_router)
api.include_router(surveys_router)
api.include_router(analytics_router)
api.include_router(competency_router)
api.include_router(core_competencys_router)
api.include_router(org_competencys_router)
api.include_router(heirarchy_router)
