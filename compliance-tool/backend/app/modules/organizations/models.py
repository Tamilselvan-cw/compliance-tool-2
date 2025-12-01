from __future__ import annotations
import uuid, datetime as dt
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import String, DateTime, ForeignKey, Index
from app.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"  # plural table name (recommended)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # NEW: who owns/admins this org (created first in auth)
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Optional helpful fields
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow)

    # relationships
    admin_user = relationship("AuthUser", back_populates="admin_of_orgs")
    members = relationship("OrganizationMember", back_populates="organization", cascade="all,delete-orphan")

    __table_args__ = (
        Index("ix_organizations_name", "name"),
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth_users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # member’s role within this org (separate from global role on AuthUser)
    org_role: Mapped[str] = mapped_column(String(60), default="member")

    joined_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=False), default=dt.datetime.utcnow)

    # relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("AuthUser", back_populates="org_memberships")
