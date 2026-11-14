"""La demo pública es de solo lectura cuando DEMO_READ_ONLY está activo.

Sin esto, cualquiera con las credenciales publicadas en el README entra como
administrador de la empresa demo y puede borrar o alterar los datos que ve el
siguiente prospecto.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.init_db import DEMO_LICENSE_KEY
from app.db.session import get_db
from app.main import create_app


@pytest.fixture(autouse=True)
def _fresh_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _client(db, user):
    # El fixture `tenant` ya llamó a get_settings() (vía local_today); hay que
    # releer el entorno después del monkeypatch.setenv.
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    token = create_access_token(str(user.id), str(user.company_id), user.role.value)
    return TestClient(app), {"Authorization": f"Bearer {token}"}


def test_demo_write_is_blocked(db, tenant, monkeypatch):
    tenant.company.license_key = DEMO_LICENSE_KEY
    db.commit()
    monkeypatch.setenv("DEMO_READ_ONLY", "true")

    client, headers = _client(db, tenant.admin)
    response = client.post(
        "/auth/change-pin",
        json={"current_pin": "1234", "new_pin": "5678"},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["code"] == "DEMO_READ_ONLY"


def test_demo_reads_are_allowed(db, tenant, monkeypatch):
    tenant.company.license_key = DEMO_LICENSE_KEY
    db.commit()
    monkeypatch.setenv("DEMO_READ_ONLY", "true")

    client, headers = _client(db, tenant.admin)
    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200


def test_real_tenant_writes_are_allowed(db, tenant, monkeypatch):
    monkeypatch.setenv("DEMO_READ_ONLY", "true")

    client, headers = _client(db, tenant.admin)
    response = client.post(
        "/auth/change-pin",
        json={"current_pin": "1234", "new_pin": "5678"},
        headers=headers,
    )

    # Llega al handler: el PIN del tenant de prueba no es 1234 -> 400, no 403.
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_CURRENT_PIN"


def test_production_blocks_demo_writes_even_without_the_flag(db, tenant, monkeypatch):
    """Si Render no aplica render.yaml, la demo no puede quedar escribible."""
    tenant.company.license_key = DEMO_LICENSE_KEY
    db.commit()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "s" * 64)
    monkeypatch.setenv("PLATFORM_API_KEY", "p" * 64)
    monkeypatch.delenv("DEMO_READ_ONLY", raising=False)

    client, headers = _client(db, tenant.admin)
    response = client.post(
        "/auth/change-pin",
        json={"current_pin": "1234", "new_pin": "5678"},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["code"] == "DEMO_READ_ONLY"
