# app/modules/ratings/models.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid, datetime as dt
from app.db.base import Base

class EmployeecompetencyRating(Base):
    __tablename__ = "employee_competency_rating"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    competency_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    rated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)  # user.id
    source: Mapped[str]      # self | manager | import
    rating_level: Mapped[int]  # 1..5
    rated_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)
