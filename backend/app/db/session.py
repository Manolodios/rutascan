"""Database engine/session factory (PostgreSQL, Supabase/Neon compatible)."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# pool_pre_ping keeps pooled connections healthy behind Supabase/Neon poolers.
# SQLite (tests) does not accept pool sizing args, so only pass them for SQL.
engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if not settings.database_url.startswith("sqlite"):
    # Small on purpose: the SQLAlchemy pool must fit inside the Supabase
    # Supavisor session pool (15 client connections per user/db by default)
    # even during request bursts from the panel.
    engine_kwargs.update(pool_size=5, max_overflow=5, pool_recycle=1800)

engine = create_engine(settings.database_url, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session
)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
