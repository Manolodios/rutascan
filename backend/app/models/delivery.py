"""delivery_logs + sync_batches - every scan event, online or offline.

delivery_logs is append-only: one row per physical scan of a product QR.
scan_uuid is the client-generated idempotency key, which makes the offline
bulk-sync endpoint safe to retry at will.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin, enum_col, json_col
from app.models.enums import RejectionReasonCode, ScanAction

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.route import RouteDetail
    from app.models.user import User


class DeliveryLog(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "delivery_logs"
    __table_args__ = (
        sa.Index("ix_delivery_logs_driver_time", "driver_id", "scan_timestamp_utc"),
        sa.Index("ix_delivery_logs_detail", "route_detail_id", "scan_timestamp_utc"),
    )

    route_detail_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("route_details.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Idempotency key generated on-device (UUIDv4 string). Unique -> retries safe.
    scan_uuid: Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True)

    action: Mapped[ScanAction] = enum_col(ScanAction, nullable=False)
    quantity: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)

    # UTC ISO-8601 timestamps. scan_timestamp_utc comes from the device clock;
    # server_timestamp_utc is stamped when the row reaches the server.
    scan_timestamp_utc: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False
    )
    server_timestamp_utc: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False
    )

    latitude: Mapped[float] = mapped_column(sa.Float, nullable=False)
    longitude: Mapped[float] = mapped_column(sa.Float, nullable=False)
    gps_accuracy_m: Mapped[float | None] = mapped_column(sa.Float)

    device_uuid: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    is_mocked_location: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    synced_with_server: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    # Captured while offline (arrived via sync-batch) vs live scan.
    via_offline_batch: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    flags: Mapped[dict | None] = json_col(nullable=True)

    pod_signature_url: Mapped[str | None] = mapped_column(sa.String(500))
    pod_photo_url: Mapped[str | None] = mapped_column(sa.String(500))
    rejection_reason: Mapped[RejectionReasonCode | None] = enum_col(
        RejectionReasonCode, nullable=True
    )
    rejection_notes: Mapped[str | None] = mapped_column(sa.String(500))

    sync_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("sync_batches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    route_detail: Mapped["RouteDetail"] = relationship(back_populates="delivery_logs")
    driver: Mapped["User"] = relationship(foreign_keys=[driver_id])
    sync_batch: Mapped["SyncBatch | None"] = relationship(back_populates="logs")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<DeliveryLog {self.action.value} {self.scan_uuid[:8]}…>"


class SyncBatch(UUIDMixin, TenantMixin, TimestampMixin, Base):
    """Audit record of an offline queue flush sent by a device."""

    __tablename__ = "sync_batches"

    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    device_uuid: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    received_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    accepted_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    rejected_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    duplicate_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    logs: Mapped[list["DeliveryLog"]] = relationship(back_populates="sync_batch")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SyncBatch n={self.received_count} ok={self.accepted_count}>"
