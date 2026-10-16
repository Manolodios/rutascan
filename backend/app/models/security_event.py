"""security_events - anti-fraud / anti-piracy audit trail."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin, enum_col, json_col
from app.models.enums import SecurityEventType

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class SecurityEvent(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "security_events"

    event_type: Mapped[SecurityEventType] = enum_col(
        SecurityEventType, nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    device_uuid: Mapped[str | None] = mapped_column(sa.String(64), index=True)
    latitude: Mapped[float | None] = mapped_column(sa.Float)
    longitude: Mapped[float | None] = mapped_column(sa.Float)
    detail: Mapped[dict | None] = json_col(nullable=True)

    company: Mapped["Company"] = relationship(back_populates="security_events")
    user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SecurityEvent {self.event_type.value}>"
