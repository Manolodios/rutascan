"""pod_files - proof-of-delivery artifacts stored in the database.

Render's filesystem is ephemeral: anything written under uploads/ at runtime
disappears on the next deploy or restart. Signatures and delivery photos are
legal evidence, so they are stored as bytes in Postgres and served by RutaScan
itself. The URL contains a random UUID, which acts as an unguessable
capability (the panel needs to render it from an <img> tag, where custom
headers cannot be attached).
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin


class PodFile(UUIDMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "pod_files"

    kind: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    content_type: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    data: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
