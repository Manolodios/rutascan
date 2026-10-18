"""Entrypoint: python -m scripts.refrescar_demo

Mueve a "hoy" todas las fechas de la empresa de demostración, para que una
demostración en vivo nunca se vea vacía (rutas de hoy, escaneos recientes,
licencia vigente). No cambia ids, ni códigos QR, ni cantidades: solo corre las
fechas la misma cantidad de días.

Uso:
    cd backend
    python -m scripts.refrescar_demo                    # usa DATABASE_URL
    DATABASE_URL=postgresql://... python -m scripts.refrescar_demo
"""

from __future__ import annotations

import logging
import sys


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    from app.db.init_db import DEMO_COMPANY_NAME, refresh_demo_dates

    days = refresh_demo_dates()
    if days:
        print(f"Datos de demostracion movidos {days} dia(s) hasta hoy ({DEMO_COMPANY_NAME}).")
    else:
        print(f"Los datos de demostracion ya estaban al dia ({DEMO_COMPANY_NAME}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
