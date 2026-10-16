"""routes + route_details - the manifest of a truck for a given date."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin, enum_col
from app.models.enums import DetailStatus, RouteStatus

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.delivery import DeliveryLog
    from app.models.product import Product
    from app.models.truck import Truck
    from app.models.user import User


class Route(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "routes"
    __table_args__ = (
        sa.UniqueConstraint("truck_id", "route_date", name="uq_routes_truck_per_date"),
    )

    truck_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("trucks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    route_date: Mapped[date] = mapped_column(sa.Date, nullable=False, index=True)
    status: Mapped[RouteStatus] = enum_col(
        RouteStatus, nullable=False, default=RouteStatus.PENDING, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(sa.String(500))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")
    )

    company: Mapped["Company"] = relationship(back_populates="routes")
    truck: Mapped["Truck"] = relationship(back_populates="routes")
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])
    details: Mapped[list["RouteDetail"]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Route {self.route_date} truck={self.truck_id} ({self.status.value})>"


class RouteDetail(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "route_details"
    __table_args__ = (
        sa.UniqueConstraint("route_id", "product_id", name="uq_route_details_product"),
    )

    route_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_quantity: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    delivered_quantity: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    status: Mapped[DetailStatus] = enum_col(
        DetailStatus, nullable=False, default=DetailStatus.IN_TRUCK, index=True
    )
    # Set to True when a REJECT happens: the warehouse must re-enter the item
    # into inventory once the truck returns.
    return_required: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    rejection_reason: Mapped[str | None] = mapped_column(sa.String(40))

    route: Mapped["Route"] = relationship(back_populates="details")
    product: Mapped["Product"] = relationship(back_populates="route_details")
    delivery_logs: Mapped[list["DeliveryLog"]] = relationship(
        back_populates="route_detail", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RouteDetail route={self.route_id} product={self.product_id}>"
