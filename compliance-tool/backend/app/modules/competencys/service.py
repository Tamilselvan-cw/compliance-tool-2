from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
import logging
from psycopg2 import errors
from .schemas import competencyOut, SkillCategory
from app.db.session import get_conn

logger = logging.getLogger(__name__)

_ALLOWED_CATS = {"technical", "functional", "behavioral"}
_ALLOWED_SCOPES = {"core", "organization", "role_based"}


def _clean_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _normalize_create(org_id: Optional[UUID], body: Dict[str, Any]) -> Dict[str, Any]:
    scope = _clean_str(body.get("scope"))
    if not scope:
        raise ValueError("scope is required")
    if scope not in _ALLOWED_SCOPES:
        raise ValueError(f"scope must be one of {', '.join(_ALLOWED_SCOPES)}")

    # If not core, org_id is required either from arg or body
    if scope != "core":
        if org_id is None:
            # try body
            org_val = _clean_str(body.get("organization_id") or body.get("org_id"))
            if not org_val:
                raise ValueError("organization_id (org_id) is required for non-core scopes")
            organization_id = org_val
        else:
            organization_id = str(org_id)
    else:
        organization_id = None  # must be NULL in DB for core scope

    name = _clean_str(body.get("name"))
    if not name:
        raise ValueError("name is required")

    cat = _clean_str(body.get("category"))
    if cat not in _ALLOWED_CATS:
        raise ValueError("category must be one of technical|functional|behavioral")

    desc = _clean_str(body.get("description"))
    is_active = True if body.get("is_active", True) else False

    return {
        "organization_id": organization_id,
        "name": name,
        "category": cat,
        "description": desc,
        "is_active": is_active,
        "scope": scope,
    }


def _row_to_dict(row) -> Dict[str, Any]:
    cols = [
        "id", "organization_id", "name", "category",
        "description", "is_active", "created_at", "updated_at", "scope"
    ]
    return dict(zip(cols, row))


def create_competency_for_org(org_id: Optional[UUID], body: Dict[str, Any], actor_user_id: Optional[UUID] = None) -> Dict[str, Any]:
    clean = _normalize_create(org_id, body)
    db_org_id = clean["organization_id"]  # string or None
    scope = clean["scope"]

    with get_conn() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO public.competencys
                      (organization_id, name, category, description, is_active, created_by, updated_by, scope)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING
                      id::text, organization_id::text, name, category::text,
                      description, is_active, created_at, updated_at, scope::text
                    """,
                    (
                        db_org_id,
                        clean["name"],
                        clean["category"],
                        clean["description"],
                        clean["is_active"],
                        str(actor_user_id) if actor_user_id else None,
                        str(actor_user_id) if actor_user_id else None,
                        scope,
                    ),
                )
                row = cur.fetchone()
            except errors.UniqueViolation as ue:
                raise ValueError("competency already exists for this category") from ue
    return _row_to_dict(row)


def list_compencys(
    org_id: Optional[UUID],
    page: int,
    limit: int,
    q: Optional[str] = None,
    category: Optional[SkillCategory] = None,
    scope: Optional[str] = None,
) -> Tuple[List[competencyOut], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")
    offset = (page - 1) * limit

    params: List[Any] = []
    where_clauses: List[str] = []

    # if explicit scope filter present (eg. scope=core), respect it
    if scope and _clean_str(scope):
        scope_val = _clean_str(scope)
        if scope_val not in _ALLOWED_SCOPES:
            raise ValueError(f"scope must be one of {', '.join(_ALLOWED_SCOPES)}")
        where_clauses.append("scope = %s")
        params.append(scope_val)
    else:
        # no explicit scope — if org_id is None return only core; otherwise select org-specific + core
        if org_id is None:
            where_clauses.append("scope = 'core'")
        else:
            where_clauses.append("(organization_id = %s OR scope = 'core')")
            params.append(str(org_id))

    if q and _clean_str(q):
        where_clauses.append("(name ILIKE %s)")
        params.append(f"%{q}%")

    if category and str(category).strip():
        cat_val = getattr(category, "value", None) if hasattr(category, "value") else str(category)
        cat_val = str(cat_val).strip().lower()
        if cat_val:
            where_clauses.append("(category = %s)")
            params.append(cat_val)

    where_sql = " AND ".join(where_clauses) or "true"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM public.competencys WHERE {where_sql}", params)
            total = cur.fetchone()[0]

            cur.execute(
                f"""
                SELECT
                  id::text, organization_id::text, name, category::text,
                  description, is_active, created_at, updated_at, scope::text
                FROM public.competencys
                WHERE {where_sql}
                ORDER BY updated_at DESC
                OFFSET %s LIMIT %s
                """,
                params + [offset, limit],
            )
            rows = cur.fetchall()

    return [_row_to_dict(r) for r in rows], total


def get_competency(org_id: Optional[UUID], competency_id: UUID) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if org_id is None:
                cur.execute(
                    """
                    SELECT
                      id::text, organization_id::text, name, category::text,
                      description, is_active, created_at, updated_at, scope::text
                    FROM public.competencys
                    WHERE id=%s AND scope='core'
                    """,
                    (str(competency_id),),
                )
            else:
                cur.execute(
                    """
                    SELECT
                      id::text, organization_id::text, name, category::text,
                      description, is_active, created_at, updated_at, scope::text
                    FROM public.competencys
                    WHERE id=%s AND (organization_id=%s OR scope='core')
                    """,
                    (str(competency_id), str(org_id)),
                )
            row = cur.fetchone()
    if not row:
        raise ValueError("competency not found")
    return _row_to_dict(row)


def update_competency(org_id: Optional[UUID], competency_id: UUID, patch: Dict[str, Any], actor_user_id: Optional[UUID] = None) -> Dict[str, Any]:
    fields: List[str] = []
    values: List[Any] = []

    if "name" in patch and patch["name"] is not None:
        nm = _clean_str(patch["name"])
        if not nm:
            raise ValueError("name cannot be empty")
        fields.append("name = %s"); values.append(nm)

    if "category" in patch and patch["category"] is not None:
        cat = _clean_str(patch["category"])
        if cat not in _ALLOWED_CATS:
            raise ValueError("category must be one of technical|functional|behavioral")
        fields.append("category = %s"); values.append(cat)

    if "description" in patch:
        desc = _clean_str(patch["description"])
        fields.append("description = %s"); values.append(desc)

    if "is_active" in patch and patch["is_active"] is not None:
        fields.append("is_active = %s"); values.append(bool(patch["is_active"]))

    if "scope" in patch and patch["scope"] is not None:
        scope_val = _clean_str(patch["scope"])
        if scope_val not in _ALLOWED_SCOPES:
            raise ValueError(f"scope must be one of {', '.join(_ALLOWED_SCOPES)}")
        fields.append("scope = %s"); values.append(scope_val)
        if scope_val == "core":
            fields.append("organization_id = NULL")
        else:
            explicit_org = _clean_str(patch.get("organization_id") or patch.get("org_id"))
            if explicit_org:
                fields.append("organization_id = %s"); values.append(explicit_org)
            elif org_id is not None:
                fields.append("organization_id = %s"); values.append(str(org_id))
            else:
                raise ValueError("organization_id (org_id) is required when setting scope != 'core'")

    if "organization_id" in patch and patch.get("organization_id") is not None and "scope" not in patch:
        org_val = _clean_str(patch.get("organization_id"))
        if org_val:
            fields.append("organization_id = %s"); values.append(org_val)

    if actor_user_id:
        fields.append("updated_by = %s"); values.append(str(actor_user_id))

    # matching org for WHERE clause: prefer explicit in patch else provided org_id param else None
    provided_org_for_match = None
    explicit_org_for_match = _clean_str(patch.get("organization_id") or patch.get("org_id"))
    if explicit_org_for_match:
        provided_org_for_match = explicit_org_for_match
    elif org_id is not None:
        provided_org_for_match = str(org_id)

    if fields:
        set_sql = ", ".join(fields) + ", updated_at = now()"
        if provided_org_for_match is None:
            where_clause = "id=%s AND scope='core'"
            params = values + [str(competency_id)]
            sql = f"""
                UPDATE public.competencys
                SET {set_sql}
                WHERE {where_clause}
                RETURNING
                  id::text, organization_id::text, name, category::text,
                  description, is_active, created_at, updated_at, scope::text
                """
        else:
            where_clause = "id=%s AND (organization_id=%s OR scope='core')"
            params = values + [str(competency_id), provided_org_for_match]
            sql = f"""
                UPDATE public.competencys
                SET {set_sql}
                WHERE {where_clause}
                RETURNING
                  id::text, organization_id::text, name, category::text,
                  description, is_active, created_at, updated_at, scope::text
                """
        with get_conn() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(sql, params)
                    row = cur.fetchone()
                except errors.UniqueViolation as ue:
                    raise ValueError("competency already exists for this category") from ue
        if not row:
            raise ValueError("competency not found")
        return _row_to_dict(row)
    else:
        return get_competency(org_id, competency_id)


def delete_competency(org_id: Optional[UUID], competency_id: UUID, soft: bool = True) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if org_id is None:
                if soft:
                    cur.execute(
                        """
                        UPDATE public.competencys
                        SET is_active=false, updated_at=now()
                        WHERE id=%s AND scope='core'
                        RETURNING id
                        """,
                        (str(competency_id),),
                    )
                else:
                    cur.execute(
                        "DELETE FROM public.competencys WHERE id=%s AND scope='core' RETURNING id",
                        (str(competency_id),),
                    )
            else:
                if soft:
                    cur.execute(
                        """
                        UPDATE public.competencys
                        SET is_active=false, updated_at=now()
                        WHERE id=%s AND (organization_id=%s OR scope='core')
                        RETURNING id
                        """,
                        (str(competency_id), str(org_id)),
                    )
                else:
                    cur.execute(
                        "DELETE FROM public.competencys WHERE id=%s AND (organization_id=%s OR scope='core') RETURNING id",
                        (str(competency_id), str(org_id)),
                    )
            row = cur.fetchone()
    if not row:
        raise ValueError("competency not found or already deleted")


def bulk_create_compencys(
    org_id: Optional[UUID],
    items: List[Dict[str, Any]],
    actor_user_id: Optional[UUID] = None
) -> Dict[str, Any]:
    created = []
    failed = []

    created_by_str = str(actor_user_id) if actor_user_id else None

    with get_conn() as conn:
        with conn.cursor() as cur:
            for item in items:
                try:
                    clean = _normalize_create(org_id, item)
                    cur.execute(
                        """
                        INSERT INTO public.competencys
                          (organization_id, name, category, description,
                           is_active, created_by, updated_by, scope)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING
                          id::text, organization_id::text, name, category::text,
                          description, is_active, created_at, updated_at, scope::text
                        """,
                        (
                            clean["organization_id"],
                            clean["name"],
                            clean["category"],
                            clean["description"],
                            clean["is_active"],
                            created_by_str,
                            created_by_str,
                            clean["scope"],
                        ),
                    )
                    row = cur.fetchone()
                    created.append(_row_to_dict(row))
                except errors.UniqueViolation:
                    failed.append({
                        "item": item,
                        "reason": "duplicate competency for same category"
                    })
                except Exception as e:
                    failed.append({
                        "item": item,
                        "reason": str(e)
                    })

    return {
        "created_count": len(created),
        "failed_count": len(failed),
        "created": created,
        "failed": failed,
    }
