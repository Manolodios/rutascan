"""devices - hardware UUID registry enforcing the per-license truck cap.

A device slot is consumed by any unique X-Device-UUID seen within
DEVICE_TTL_DAYS. Requests from new UUIDs beyond `companies.max_trucks`
are rejected with HTTP 403.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class Device(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "devices"
    __table_args__ = (
        sa.UniqueConstraint("company_id", "device_uuid", name="uq_devices_uuid_per_company"),
    )

    device_uuid: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    platform: Mapped[str | None] = mapped_column(sa.String(32))
    app_version: Mapped[str | None] = mapped_column(sa.String(32))
    first_seen_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), index=True
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)

    company: Mapped["Company"] = relationship(back_populates="devices")
    user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Device {self.device_uuid[:12]}… {self.platform or ''}>"
