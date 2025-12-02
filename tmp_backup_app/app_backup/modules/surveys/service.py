from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from app.db.session import get_conn


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    v = s.strip()
    return v or None


def _row_to_out(row) -> Dict[str, Any]:
    """Map SELECT order -> API keys that match SurveyOut."""
    cols = [
        "id", "org_id", "title", "description", "status",
        "role_ids", "created_by", "updated_by", "created_at", "updated_at",
    ]
    return dict(zip(cols, row))

def _row_to_dict(cur, row):
    if row is None:
        return None
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row))

def create_survey(
    org_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    name        = _clean(payload.get("name"))
    description = _clean(payload.get("description")) or None
    raw_status  = (payload.get("status") or "draft").strip().lower()

    if raw_status not in {"draft", "active", "closed"}:
        raise ValueError("status must be one of: draft, active, closed")
    if not name:
        raise ValueError("name is required")

    # normalize role_ids -> list[str] or empty list
    role_ids_in = payload.get("role_ids") or []
    role_ids_str: List[str] = [str(x) for x in role_ids_in] if role_ids_in else []

    created_by_str = str(actor_user_id) if actor_user_id else None

    sql = """
    WITH ins AS (
      INSERT INTO public.competency_matrix
        (org_id, title, description, status, role_ids, created_by, updated_by)
      VALUES
        (%s::uuid, %s, %s, %s, %s::uuid[], %s::uuid, %s::uuid)
      RETURNING
        id, org_id, title, description, status, role_ids, created_by, updated_by, created_at, updated_at
    )
    SELECT
      id::text          AS id,
      org_id::text      AS org_id,
      title,
      description,
      status,
      role_ids::text[]  AS role_ids,
      created_by::text  AS created_by,
      updated_by::text  AS updated_by,
      created_at,
      updated_at
    FROM ins;
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    str(org_id),
                    name,
                    description,
                    raw_status,
                    role_ids_str,    # <-- psycopg will send text[], cast to uuid[] in SQL
                    created_by_str,
                    created_by_str,
                ),
            )
            row = cur.fetchone()
            return _row_to_dict(cur, row)


def get_survey(org_id: UUID, survey_id: UUID) -> Dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  id::text,
                  org_id::text,
                  title,
                  description,
                  status,
                  role_ids::text[],
                  created_by::text,
                  updated_by::text,
                  created_at,
                  updated_at
                FROM public.competency_matrix
                WHERE id=%s AND org_id=%s
                LIMIT 1
                """,
                (str(survey_id), str(org_id)),
            )
            row = cur.fetchone()
    if not row:
        raise ValueError("Survey not found")
    return _row_to_out(row)



def list_surveys(
    org_id: UUID,
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    if page < 1 or limit < 1:
        raise ValueError("Invalid pagination")
    offset = (page - 1) * limit

    where = ["org_id=%s"]
    params: List[Any] = [str(org_id)]

    if status:
        where.append("status = %s")
        params.append(status)

    if search:
        where.append("(title ILIKE %s OR COALESCE(description,'') ILIKE %s)")
        like = f"%{search}%"
        params.extend([like, like])

    where_sql = " AND ".join(where)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM public.competency_matrix WHERE {where_sql}",
                params,
            )
            total = cur.fetchone()[0]

            cur.execute(
                f"""
                SELECT
                  id::text,
                  org_id::text,
                  title,
                  description,
                  status,
                  role_ids::text[],
                  created_by::text,
                  updated_by::text,
                  created_at,
                  updated_at
                FROM public.competency_matrix
                WHERE {where_sql}
                ORDER BY created_at DESC
                OFFSET %s LIMIT %s
                """,
                params + [offset, limit],
            )
            rows = cur.fetchall()

    items = [_row_to_out(r) for r in rows]
    return items, total

def update_survey(
    org_id: UUID,
    survey_id: UUID,
    payload: Dict[str, Any],
    actor_user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    sets = []
    vals: List[Any] = []

    def _set(expr: str, *v):
        nonlocal sets, vals
        sets.append(expr)
        vals.extend(v)

    # title
    if "name" in payload and payload["name"] is not None:
        v = _clean(payload["name"])
        if not v:
            raise ValueError("name cannot be empty")
        _set("title=%s", v)
    if "title" in payload and payload["title"] is not None:
        v = _clean(payload["title"])
        if not v:
            raise ValueError("title cannot be empty")
        _set("title=%s", v)

    # description
    if "description" in payload:
        _set("description=%s", _clean(payload["description"]))

    # status
    if "status" in payload and payload["status"] is not None:
        s = (payload["status"] or "").strip().lower()
        if s not in {"draft", "active", "closed"}:
            raise ValueError("status must be one of: draft, active, closed")
        _set("status=%s", s)

    # role_ids (expects list[str] / list[UUID])
    if "role_ids" in payload:
        role_ids_in = payload.get("role_ids") or []
        role_ids_str = [str(x) for x in role_ids_in] if role_ids_in else []
        _set("role_ids=%s::uuid[]", role_ids_str)

    # audit
    _set("updated_by=%s::uuid", str(actor_user_id) if actor_user_id else None)
    sets.append("updated_at = now()")

    if not sets:
        return get_survey(org_id, survey_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE public.competency_matrix
                SET {", ".join(sets)}
                WHERE id=%s AND org_id=%s
                RETURNING
                  id::text,
                  org_id::text,
                  title,
                  description,
                  status,
                  role_ids::text[],
                  created_by::text,
                  updated_by::text,
                  created_at,
                  updated_at
                """,
                vals + [str(survey_id), str(org_id)],
            )
            row = cur.fetchone()
    if not row:
        raise ValueError("Survey not found")
    return _row_to_out(row)


def delete_survey(org_id: UUID, survey_id: UUID) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "delete from public.competency_matrix where id=%s and org_id=%s returning id",
                (str(survey_id), str(org_id)),
            )
            r = cur.fetchone()
    if not r:
        raise ValueError("Survey not found")
