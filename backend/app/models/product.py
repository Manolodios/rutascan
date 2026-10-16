"""products - per-tenant catalog keyed by unique barcode/QR payload."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.route import RouteDetail


class Product(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        sa.UniqueConstraint("company_id", "barcode_qr", name="uq_products_barcode_per_company"),
    )

    barcode_qr: Mapped[str] = mapped_column(sa.String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(sa.String(300), nullable=False)
    unit: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="UNIT")
    weight: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 3), nullable=False, default=Decimal("0")
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)

    company: Mapped["Company"] = relationship(back_populates="products")
    route_details: Mapped[list["RouteDetail"]] = relationship(back_populates="product")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Product {self.barcode_qr} {self.description[:30]}>"
