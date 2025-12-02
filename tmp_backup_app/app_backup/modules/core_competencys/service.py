# app/modules/core_competencys/service.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Optional
from uuid import UUID

from app.db.session import get_conn


def _row_to_core(r) -> Dict[str, Any]:
    return {
        "id": r[0],
        "name": r[1],
        "category": r[2],
        "description": r[3],
        "required_level": r[4],
        "is_active": r[5],
        "created_by": r[6],
        "updated_by": r[7],
        "created_at": r[8],
        "updated_at": r[9],
    }


def create_core_competency(
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")

    category = payload.get("category")
    if not category:
        raise ValueError("category is required")

    description = (payload.get("description") or None)
    required_level = payload.get("required_level")
    is_active = bool(payload.get("is_active", True))

    created_by = str(actor_user_id) if actor_user_id else None

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.core_competencys
                  (name, category, description, required_level,
                   is_active, created_by, updated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING
                  id, name, category, description, required_level,
                  is_active, created_by, updated_by, created_at, updated_at
                """,
                (
                    name,
                    category,
                    description,
                    required_level,
                    is_active,
                    created_by,
                    created_by,
                ),
            )
            row = cur.fetchone()

    return _row_to_core(row)


def list_core_competencys(
    page: int,
    limit: int,
) -> Tuple[List[Dict[str, Any]], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")

    offset = (page - 1) * limit

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)
                FROM public.core_competencys c
                WHERE c.is_active = TRUE
                """
            )
            total = cur.fetchone()[0]

            cur.execute(
                """
                SELECT
                  id, name, category, description, required_level,
                  is_active, created_by, updated_by, created_at, updated_at
                FROM public.core_competencys
                WHERE is_active = TRUE
                ORDER BY updated_at DESC
                OFFSET %s LIMIT %s
                """,
                (offset, limit),
            )
            rows = cur.fetchall()

    items = [_row_to_core(r) for r in rows]
    return items, total


def get_core_competency(core_id: UUID) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id, name, category, description, required_level,
                  is_active, created_by, updated_by, created_at, updated_at
                FROM public.core_competencys
                WHERE id = %s
                """,
                (str(core_id),),
            )
            row = cur.fetchone()

    if not row:
        raise ValueError("Core competency not found")

    return _row_to_core(row)


def update_core_competency(
    core_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID],
) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}

    if "name" in payload:
        fields["name"] = (payload["name"] or "").strip() or None
    if "category" in payload:
        fields["category"] = payload["category"]
    if "description" in payload:
        fields["description"] = payload["description"]
    if "required_level" in payload:
        fields["required_level"] = payload["required_level"]
    if "is_active" in payload:
        fields["is_active"] = bool(payload["is_active"])

    if not fields:
        return get_core_competency(core_id)

    fields["updated_by"] = str(actor_user_id) if actor_user_id else None

    set_clause = ", ".join(f"{k} = %s" for k in fields.keys())
    params = list(fields.values()) + [str(core_id)]

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE public.core_competencys
                SET {set_clause}, updated_at = now()
                WHERE id = %s
                RETURNING id
                """,
                params,
            )
            row = cur.fetchone()

    if not row:
        raise ValueError("Core competency not found")

    return get_core_competency(core_id)


def delete_core_competency(
    core_id: UUID,
    soft: bool = True,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if soft:
                cur.execute(
                    """
                    UPDATE public.core_competencys
                    SET is_active = FALSE, updated_at = now()
                    WHERE id = %s AND is_active = TRUE
                    RETURNING id
                    """,
                    (str(core_id),),
                )
            else:
                cur.execute(
                    """
                    DELETE FROM public.core_competencys
                    WHERE id = %s
                    RETURNING id
                    """,
                    (str(core_id),),
                )
            row = cur.fetchone()

    if not row:
        raise ValueError("Core competency not found or already deleted")
