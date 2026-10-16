"""users - platform users (ADMIN / WAREHOUSE / DRIVER) per company."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin, enum_col
from app.models.enums import Role

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.truck import Truck


class User(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        sa.UniqueConstraint("user_cedula", name="uq_users_cedula"),
    )

    user_cedula: Mapped[str] = mapped_column(sa.String(32), nullable=False, index=True)
    pin_hash: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    role: Mapped[Role] = enum_col(Role, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    company: Mapped["Company"] = relationship(back_populates="users")
    trucks: Mapped[list["Truck"]] = relationship(back_populates="assigned_driver")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.user_cedula} ({self.role.value})>"
