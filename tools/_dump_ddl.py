"""Dump the Postgres DDL that SQLAlchemy would emit for the RutaScan models.

Uses a mock engine: nothing is executed, the DDL is only printed.
Usage (from the project root):

    set PYTHONPATH=backend
    .venv\\Scripts\\python.exe tools/_dump_ddl.py
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import create_mock_engine

from app.db.base import Base
import app.models  # noqa: F401  (registers every table on Base.metadata)

engine = create_mock_engine("postgresql+psycopg2://", lambda *a, **kw: None)


def dump(sql, *multiparams, **params) -> None:
    print(str(sql.compile(dialect=engine.dialect)).strip() + ";")


engine = create_mock_engine("postgresql+psycopg2://", dump)
Base.metadata.create_all(engine, checkfirst=False)

print()
print("-- TABLES:", len(Base.metadata.sorted_tables))
print("-- " + ", ".join(sorted(t.name for t in Base.metadata.sorted_tables)))
