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

    from app.db.init_db import init_db

    init_db(seed=seed)
    print("RutaScan database ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
