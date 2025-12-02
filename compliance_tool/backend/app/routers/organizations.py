# app/routers/organizations.py
"""
Expose the Organizations API router from the feature module.

Usage in app/main.py:
    from app.routers.organizations import router as organizations_router
    app.include_router(organizations_router)
"""

from app.modules.organizations.router import router as organizations_router

# Re-export under a standard name so all routers look consistent to main.py
router = organizations_router

__all__ = ["router"]
