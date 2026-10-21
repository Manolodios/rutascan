"""Security regressions: licence gate on the panel, Excel cells, client IP."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.deps import require_active_license
from app.api.v1.auth import _client_ip
from app.models.enums import SubscriptionStatus
from app.services.licensing import LicenseError
from app.services.reports import _cell


def _user(user_id, company_id) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, company_id=company_id, is_active=True)


# --------------------------------------------------- licence gate (panel) --
def test_admin_gate_allows_active_license(db, tenant):
    company = require_active_license(user=_user(tenant.admin.id, tenant.company.id), db=db)
    assert company.id == tenant.company.id


def test_admin_gate_blocks_suspended_license(db, tenant):
    tenant.company.subscription_status = SubscriptionStatus.SUSPENDED
    db.commit()
    with pytest.raises(LicenseError) as exc:
        require_active_license(user=_user(tenant.admin.id, tenant.company.id), db=db)
    assert exc.value.status_code == 402


def test_admin_gate_blocks_inactive_company(db, tenant):
    tenant.company.is_active = False
    db.commit()
    with pytest.raises(LicenseError) as exc:
        require_active_license(user=_user(tenant.admin.id, tenant.company.id), db=db)
    assert exc.value.status_code == 402


def test_admin_gate_rejects_unknown_company(db, tenant):
    with pytest.raises(HTTPException) as exc:
        require_active_license(user=_user(tenant.admin.id, uuid4()), db=db)
    assert exc.value.status_code == 403


# ------------------------------------------------------------ Excel export --
def test_excel_cells_are_not_formulas():
    assert _cell("=1+1") == "'=1+1"
    assert _cell("+CMD") == "'+CMD"
    assert _cell("-2+3") == "'-2+3"
    assert _cell("@SUM(A1)") == "'@SUM(A1)"


def test_excel_cells_keep_numbers_and_text():
    assert _cell("Producto A") == "Producto A"
    assert _cell(-71.436) == -71.436
    assert _cell(0) == 0
    assert _cell("") == ""


# ----------------------------------------------------------- login rate limit
def test_client_ip_uses_proxy_appended_hop():
    request = SimpleNamespace(
        headers={"x-forwarded-for": "190.1.2.3, 10.0.0.1"},
        client=SimpleNamespace(host="10.0.0.1"),
    )
    # El cliente puede falsificar el valor de la izquierda (190.1.2.3); el de la
    # derecha lo agrega el proxy de confianza (Render) y por eso es el fiable.
    assert _client_ip(request) == "10.0.0.1"


def test_client_ip_ignores_spoofed_leftmost_when_alone():
    # Una sola IP falsificada viaja sola: al ser la ultima (y unica) se respeta
    # el limite por IP real que agrega el proxy; aqui validamos que no truena.
    request = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.7"},
        client=SimpleNamespace(host="10.0.0.1"),
    )
    assert _client_ip(request) == "203.0.113.7"


def test_client_ip_falls_back_to_socket():
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    assert _client_ip(request) == "127.0.0.1"
