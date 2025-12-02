# app/modules/imports/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid, datetime as dt
from app.db.base import Base

class ImportJob(Base):
    __tablename__ = "import_job"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    uploader_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    file_s3_key: Mapped[str]
    status: Mapped[str]      # queued|running|failed|completed
    summary: Mapped[dict | None]
    error_report_s3_key: Mapped[str | None]
    created_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)
    completed_at: Mapped[dt.datetime | None]
