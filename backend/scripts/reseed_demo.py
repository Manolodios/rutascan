"""Rehace el tenant de demostración (borra y vuelve a sembrar).

Se usa cuando cambian los datos demo (empresa, camiones, placas, productos,
coordenadas de la ciudad...). Conserva el resto de la base de datos intacto:
solo borra las filas del tenant demo (columna `company_id`).

Uso:
    cd backend
    python -m scripts.reseed_demo

    # contra Supabase / Postgres:
    $env:DATABASE_URL = "postgresql+psycopg2://..."   # PowerShell
    python -m scripts.reseed_demo
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401  (registra todas las tablas)
from sqlalchemy import delete, or_, select

from app.db.base import Base
from app.db.init_db import DEMO_COMPANY_NAME, DEMO_LICENSE_KEY, seed_demo
from app.db.session import SessionLocal
from app.models.company import Company


def purge_demo() -> int:
    """Borra las filas del tenant demo. Devuelve cuántas filas eliminó."""
    with SessionLocal() as db:
        companies = db.scalars(
            select(Company).where(
                or_(
                    Company.license_key == DEMO_LICENSE_KEY,
                    Company.name == DEMO_COMPANY_NAME,
                )
            )
        ).all()
        if not companies:
            print("No hay empresa demo que borrar.")
            return 0

        ids = [c.id for c in companies]
        print(f"Borrando tenant demo: {[c.name for c in companies]}")

        borradas = 0
        # Orden inverso al de creación: primero las tablas que dependen de otras.
        for table in reversed(Base.metadata.sorted_tables):
            if "company_id" in table.columns:
                result = db.execute(delete(table).where(table.c.company_id.in_(ids)))
                borradas += result.rowcount or 0
                if result.rowcount:
                    print(f"  - {table.name}: {result.rowcount} filas")
            else:
                print(f"  (sin company_id, se omite) {table.name}")

        for company in companies:
            db.delete(company)
        db.commit()
        print(f"Total borrado: {borradas} filas + {len(companies)} empresa(s)")
        return borradas


def main() -> int:
    purga = purge_demo()
    if purga == 0:
        print("Nada que resembrar (¿la base está vacía?). Se intenta sembrar igual.")
    sembrado = seed_demo()
    print("Sembrado:", "sí" if sembrado else "no (ya había empresas)")
    return 0 if sembrado else 1


if __name__ == "__main__":
    raise SystemExit(main())
