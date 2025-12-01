# backend/app/routers/users.py
from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me")
def me():
    return {"ok": True}
