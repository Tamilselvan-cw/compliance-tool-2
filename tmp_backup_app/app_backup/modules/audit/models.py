 
# app/modules/audit/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid, datetime as dt
from app.db.base import Base

class LoginActivity(Base):
    __tablename__ = "login_activity"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    ip: Mapped[str | None]
    user_agent: Mapped[str | None]
    device_vendor: Mapped[str | None]
    device_model: Mapped[str | None]
    platform: Mapped[str | None]   # windows/mac/ios/android/web
    logged_in_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)
    supabase_session_id: Mapped[str | None]
