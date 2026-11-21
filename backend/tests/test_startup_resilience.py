"""El arranque no debe morir si la base está temporalmente inaccesible.

Si el pooler de Supabase bloquea conexiones (por ejemplo, tras varios intentos
con una contraseña vieja), el contenedor debe levantar igual en modo degradado:
si muriera, Render lo reiniciaría en bucle y el bloqueo temporal nunca expiraría.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy.exc import OperationalError, ProgrammingError

from app import main as app_main
from scripts import init_db as init_script


def _production_settings() -> SimpleNamespace:
    return SimpleNamespace(
        seed_demo_data=False,
        demo_auto_refresh=False,
        is_production=True,
    )


def test_init_db_tolera_base_temporalmente_inaccesible(monkeypatch):
    def unavailable(seed: bool = True) -> None:
        raise OperationalError(
            "SELECT 1",
            {},
            Exception("ECIRCUITBREAKER: too many authentication failures"),
        )

    monkeypatch.setattr("app.db.init_db.init_db", unavailable)

    assert init_script.main() == 0


def test_init_db_no_oculta_errores_de_esquema(monkeypatch):
    def broken_schema(seed: bool = True) -> None:
        raise ProgrammingError("CREATE TABLE", {}, Exception("permission denied"))

    monkeypatch.setattr("app.db.init_db.init_db", broken_schema)

    with pytest.raises(ProgrammingError):
        init_script.main()


def test_lifespan_arranca_degradado_si_la_base_esta_bloqueada(monkeypatch):
    def unavailable(seed: bool = True, refresh_demo: bool = False) -> None:
        raise OperationalError(
            "SELECT 1",
            {},
            Exception("ECIRCUITBREAKER: too many authentication failures"),
        )

    monkeypatch.setattr("app.db.init_db.init_db", unavailable)

    app_main._initialize_database(_production_settings())


def test_lifespan_sigue_fallando_por_errores_de_esquema_en_produccion(monkeypatch):
    def broken_schema(seed: bool = True, refresh_demo: bool = False) -> None:
        raise ProgrammingError("CREATE TABLE", {}, Exception("permission denied"))

    monkeypatch.setattr("app.db.init_db.init_db", broken_schema)

    with pytest.raises(ProgrammingError):
        app_main._initialize_database(_production_settings())
