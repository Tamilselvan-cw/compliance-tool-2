# app/modules/levels/service.py
from __future__ import annotations
from typing import Any, Dict, Optional, Tuple, List
import logging
from psycopg2 import errors

from app.db.session import get_conn

logger = logging.getLogger(__name__)

ALLOWED_LEVEL_ROLES = {"superadmin", "org_admin", "hr", "hod"}

def _ensure_actor_allowed(payload_jwt: Optional[Dict[str, Any]]) -> None:
    if not payload_jwt:
        return
    role = (
        (payload_jwt.get("app_metadata") or {}).get("role")
        or (payload_jwt.get("user_metadata") or {}).get("app_role")
        or payload_jwt.get("role")
        or ""
    )
    if role not in ALLOWED_LEVEL_ROLES:
        raise PermissionError("Not allowed to manage levels")

# ---------- Normalization / Validation ----------

def _normalize_level_payload(org_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or None)
    score_raw = payload.get("score")

    if not name:
        raise ValueError("name is required")

    try:
        score = int(score_raw)
    except Exception:
        raise ValueError("score must be an integer")

    if not (1 <= score <= 10):  # adjust if your business rule is 1..5
        raise ValueError("score must be between 1 and 10")

    def _clean(s: Optional[str]) -> Optional[str]:
        if s is None:
            return None
        s2 = str(s).strip()
        return s2 or None

    return {
        "organization_id": str(org_id),
        "name": name,
        "description": _clean(description),
        "score": score,
    }

# ---------- Core Operations ----------

def create_level_for_org(org_id: str, data: Dict[str, Any], actor_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    _ensure_actor_allowed(actor_payload)
    # ✅ use the incoming body as payload (NOT actor_payload)
    clean = _normalize_level_payload(org_id, data)

    with get_conn() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO public.levels (organization_id, name, description, score)
                    VALUES (%s, %s, %s, %s)
                    RETURNING
                        id::text, organization_id::text, name, description, score, is_active,
                        created_at, updated_at
                    """,
                    (
                        clean["organization_id"],
                        clean["name"],
                        clean["description"],
                        clean["score"],
                    ),
                )
                row = cur.fetchone()
            except errors.UniqueViolation as ue:
                # Could be name or score conflict (both unique per org)
                raise ValueError("Duplicate level name or score for this organization") from ue

    return {
        "id": row[0],
        "organization_id": row[1],
        "name": row[2],
        "description": row[3],
        "score": row[4],
        "is_active": row[5],
        "created_at": row[6],
        "updated_at": row[7],
    }

def list_levels(
    org_id: str,
    page: int = 1,
    limit: int = 50,
    q: Optional[str] = None,
    only_active: bool = True,
    order_by: str = "score",
    ascending: bool = True,
) -> Tuple[List[Dict[str, Any]], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination params")

    order_by = order_by if order_by in {"score", "name", "created_at"} else "score"
    direction = "asc" if ascending else "desc"

    params: List[Any] = [org_id]
    where = ["organization_id = %s", "deleted_at IS NULL"]
    if only_active:
        where.append("is_active = true")

    if q:
        params.extend([f"%{q}%", f"%{q}%"])
        where.append("(name ILIKE %s OR description ILIKE %s)")

    where_sql = " AND ".join(where)
    offset = (page - 1) * limit

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM public.levels WHERE {where_sql}", params)
            total = cur.fetchone()[0]

            cur.execute(
                f"""
                SELECT
                    id::text, organization_id::text, name, description, score,
                    is_active, created_at, updated_at
                FROM public.levels
                WHERE {where_sql}
                ORDER BY {order_by} {direction}, created_at desc
                OFFSET %s LIMIT %s
                """,
                params + [offset, limit],
            )
            rows = cur.fetchall()

    cols = [
        "id", "organization_id", "name", "description", "score",
        "is_active", "created_at", "updated_at"
    ]
    items = [dict(zip(cols, r)) for r in rows]
    return items, total

def get_level(level_id: str, org_id: str) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id::text, organization_id::text, name, description, score,
                    is_active, created_at, updated_at
                FROM public.levels
                WHERE id = %s AND organization_id = %s AND deleted_at IS NULL
                """,
                (level_id, org_id),
            )
            row = cur.fetchone()
    if not row:
        raise ValueError("Level not found")
    cols = [
        "id", "organization_id", "name", "description", "score",
        "is_active", "created_at", "updated_at"
    ]
    return dict(zip(cols, row))

def update_level_for_org(
    org_id: str,
    level_id: str,
    payload: Dict[str, Any],
    actor_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _ensure_actor_allowed(actor_payload)

    fields: List[str] = []
    values: List[Any] = []

    if "name" in payload and payload["name"] is not None:
        name = str(payload["name"]).strip()
        if not name:
            raise ValueError("name cannot be empty")
        fields.append("name = %s")
        values.append(name)

    if "description" in payload:
        desc = payload["description"]
        desc = (str(desc).strip() if desc is not None else None)
        fields.append("description = %s")
        values.append(desc)

    if "score" in payload and payload["score"] is not None:
        try:
            score = int(payload["score"])
        except Exception:
            raise ValueError("score must be an integer")
        if not (1 <= score <= 10):
            raise ValueError("score must be between 1 and 10")
        fields.append("score = %s")
        values.append(score)

    if "is_active" in payload and payload["is_active"] is not None:
        fields.append("is_active = %s")
        values.append(bool(payload["is_active"]))

    if not fields:
        return get_level(level_id, org_id)  # nothing to update

    set_sql = ", ".join(fields)
    values.extend([level_id, org_id])

    with get_conn() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    f"""
                    UPDATE public.levels
                    SET {set_sql}, updated_at = now()
                    WHERE id = %s AND organization_id = %s AND deleted_at IS NULL
                    RETURNING
                        id::text, organization_id::text, name, description, score,
                        is_active, created_at, updated_at
                    """,
                    values,
                )
                row = cur.fetchone()
            except errors.UniqueViolation as ue:
                raise ValueError("Duplicate level name or score for this organization") from ue

    if not row:
        raise ValueError("Level not found")

    cols = [
        "id", "organization_id", "name", "description", "score",
        "is_active", "created_at", "updated_at"
    ]
    return dict(zip(cols, row))

def delete_level_for_org(
    org_id: str,
    level_id: str,
    soft: bool = True,
    actor_payload: Optional[Dict[str, Any]] = None,
) -> None:
    _ensure_actor_allowed(actor_payload)

    with get_conn() as conn:
        with conn.cursor() as cur:
            if soft:
                cur.execute(
                    """
                    UPDATE public.levels
                    SET is_active = false, deleted_at = now(), updated_at = now()
                    WHERE id = %s AND organization_id = %s AND deleted_at IS NULL
                    RETURNING id
                    """,
                    (level_id, org_id),
                )
            else:
                cur.execute(
                    """
                    DELETE FROM public.levels
                    WHERE id = %s AND organization_id = %s
                    RETURNING id
                    """,
                    (level_id, org_id),
                )
            row = cur.fetchone()
    if not row:
        raise ValueError("Level not found or already deleted")

def bulk_create_levels_for_org(
    org_id: str,
    items: List[Dict[str, Any]],
    actor_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _ensure_actor_allowed(actor_payload)

    cleaned: List[Dict[str, Any]] = []
    for it in items:
        try:
            cleaned.append(_normalize_level_payload(org_id, it))
        except Exception as e:
            logger.info("BULK_LEVELS skip invalid row: %s (%s)", it, e)

    if not cleaned:
        return {"inserted": [], "count": 0, "skipped": len(items)}

    inserted: List[Dict[str, Any]] = []
    skipped = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            for c in cleaned:
                try:
                    cur.execute(
                        """
                        INSERT INTO public.levels (organization_id, name, description, score)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (organization_id, name) DO NOTHING
                        RETURNING
                          id::text, organization_id::text, name, description, score, is_active, created_at, updated_at
                        """,
                        (c["organization_id"], c["name"], c["description"], c["score"]),
                    )
                    row = cur.fetchone()
                    if row:
                        cols = ["id","organization_id","name","description","score","is_active","created_at","updated_at"]
                        inserted.append(dict(zip(cols, row)))
                    else:
                        skipped += 1
                except errors.UniqueViolation:
                    skipped += 1
                except Exception as e:
                    logger.warning("BULK_LEVELS row failed: %s", e)
                    skipped += 1

    return {"inserted": inserted, "count": len(inserted), "skipped": skipped}
