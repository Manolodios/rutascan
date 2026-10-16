"""companies - tenant root table (SaaS license holder)."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin, enum_col
from app.models.enums import SubscriptionStatus

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.product import Product
    from app.models.route import Route
    from app.models.security_event import SecurityEvent
    from app.models.truck import Truck
    from app.models.user import User


class Company(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    tax_id: Mapped[str] = mapped_column(sa.String(50), nullable=False, unique=True)
    license_key: Mapped[str] = mapped_column(
        sa.String(64), nullable=False, unique=True, index=True
    )
    subscription_status: Mapped[SubscriptionStatus] = enum_col(
        SubscriptionStatus, nullable=False, default=SubscriptionStatus.ACTIVE
    )
    expiration_date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    max_trucks: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=5)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)

    users: Mapped[list["User"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    trucks: Mapped[list["Truck"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    routes: Mapped[list["Route"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    devices: Mapped[list["Device"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    security_events: Mapped[list["SecurityEvent"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Company {self.name} lic={self.license_key}>"
