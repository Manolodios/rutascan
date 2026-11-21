"""Entrypoint: python -m scripts.init_db

Creates all tables and (optionally) seeds the demo tenant. Idempotent; safe to
run on every container start / deploy.
"""

from __future__ import annotations

import logging
import os
import sys

from app.core.config import get_settings


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    settings = get_settings()
    seed = os.getenv("SEED_DEMO_DATA", str(settings.seed_demo_data)).lower() in (
        "1",
        "true",
        "yes",
    )

    from sqlalchemy.exc import OperationalError

    from app.db.init_db import init_db

    try:
        init_db(seed=seed)
    except OperationalError as exc:
        # La base puede estar inaccesible por unos minutos: el pooler de
        # Supabase bloquea conexiones nuevas tras varios fallos de
        # autenticación (ECIRCUITBREAKER). No matamos el contenedor; uvicorn
        # arranca igual, /health informa "degraded" y la aplicación se
        # recupera sola cuando la base vuelve. Si muriéramos aquí, Render
        # reiniciaría en bucle y el bloqueo temporal no expiraría nunca.
        logging.getLogger(__name__).warning(
            "Base de datos no disponible al arrancar (%s). "
            "La API arrancará en modo degradado y reintentará en cada petición.",
            exc,
        )
        return 0

    print("RutaScan database ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
