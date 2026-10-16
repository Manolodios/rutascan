"""trucks - fleet units, optionally bound to a driver."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.route import Route
    from app.models.user import User


class Truck(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "trucks"
    __table_args__ = (
        sa.UniqueConstraint("company_id", "license_plate", name="uq_trucks_plate_per_company"),
    )

    license_plate: Mapped[str] = mapped_column(sa.String(20), nullable=False, index=True)
    model: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    assigned_driver_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)

    company: Mapped["Company"] = relationship(back_populates="trucks")
    assigned_driver: Mapped["User | None"] = relationship(back_populates="trucks")
    routes: Mapped[list["Route"]] = relationship(
        back_populates="truck", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Truck {self.license_plate}>"
