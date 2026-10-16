"""SQLAlchemy declarative base, mixins and shared column helpers."""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, declared_attr

from app.core.geo import utcnow


class Base(DeclarativeBase):
    """Declarative base for all RutaScan models."""


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class TenantMixin:
    """Every tenant-scoped table carries an indexed company_id FK.

    Multi-tenant isolation is enforced at the query layer (all repositories
    filter by company_id); this mixin guarantees the column + index always
    exist and is declared with ON DELETE CASCADE so deleting a company
    purges all of its operational data.
    """

    @declared_attr
    def company_id(cls) -> Mapped[uuid.UUID]:  # noqa: N805
        return mapped_column(
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )


def enum_col(enum_cls: type, /, **kwargs: object):
    """Portable enum column: VARCHAR + CHECK on any backend (PG/SQLite).

    Stores the enum *values* (e.g. 'ADMIN'), not the python member names.
    """
    return mapped_column(
        sa.Enum(
            enum_cls,
            native_enum=False,
            length=32,
            values_callable=lambda e: [m.value for m in e],
            validate_strings=True,
        ),
        **kwargs,
    )


def json_col(**kwargs: object):
    """JSON column that becomes JSONB on PostgreSQL."""
    from sqlalchemy.dialects.postgresql import JSONB  # noqa: PLC0415

    return mapped_column(sa.JSON().with_variant(JSONB, "postgresql"), **kwargs)
