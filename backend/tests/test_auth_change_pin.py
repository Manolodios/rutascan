"""Self-service PIN change for the authenticated user."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1.auth import change_pin
from app.core.security import hash_pin, verify_pin
from app.schemas.auth import ChangePinRequest


def _payload(current: str = "1234", new: str = "5678") -> ChangePinRequest:
    return ChangePinRequest(current_pin=current, new_pin=new)


def test_change_pin_updates_hash(db, tenant):
    tenant.admin.pin_hash = hash_pin("1234")
    db.commit()

    result = change_pin(_payload(), user=tenant.admin, db=db)

    assert "actualizado" in result.detail
    db.refresh(tenant.admin)
    assert verify_pin("5678", tenant.admin.pin_hash)
    assert not verify_pin("1234", tenant.admin.pin_hash)


def test_change_pin_rejects_wrong_current(db, tenant):
    tenant.admin.pin_hash = hash_pin("1234")
    db.commit()

    with pytest.raises(HTTPException) as exc:
        change_pin(_payload(current="0000"), user=tenant.admin, db=db)

    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "INVALID_CURRENT_PIN"
    db.refresh(tenant.admin)
    assert verify_pin("1234", tenant.admin.pin_hash)


def test_change_pin_rejects_same_pin(db, tenant):
    tenant.admin.pin_hash = hash_pin("1234")
    db.commit()

    with pytest.raises(HTTPException) as exc:
        change_pin(_payload(new="1234"), user=tenant.admin, db=db)

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "PIN_UNCHANGED"
