# app/routers/debug_db.py
from fastapi import APIRouter
from app.db.session import get_conn

router = APIRouter(prefix="/__debug", tags=["__debug"])

@router.get("/db")
def debug_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select current_database(), current_user, inet_server_addr(), inet_server_port(), current_schema")
            db, user, host, port, schema = cur.fetchone()
            return {"db": db, "user": user, "host": str(host), "port": port, "schema": schema}
