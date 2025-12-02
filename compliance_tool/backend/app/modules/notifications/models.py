# app/modules/notifications/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid, datetime as dt
from app.db.base import Base

class Device(Base):
    __tablename__ = "device"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    platform: Mapped[str]   # web|ios|android|desktop
    token: Mapped[str]      # FCM token
    device_label: Mapped[str | None]
    created_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)
    last_seen_at: Mapped[dt.datetime | None]
