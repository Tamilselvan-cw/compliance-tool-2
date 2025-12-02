# app/modules/reports/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid, datetime as dt
from app.db.base import Base

class GapSnapshot(Base):
    __tablename__ = "gap_snapshot"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    competency_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    expected_level: Mapped[int]
    actual_level: Mapped[int]
    gap: Mapped[int]
    snapshot_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow, index=True)
    scope: Mapped[str | None]
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
