"""License & device management for the tenant ADMIN."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.device import Device
from app.models.user import User
from app.schemas.admin import DeviceOut, LicenseOut
from app.schemas.common import Message
from app.services import licensing

router = APIRouter(prefix="/license", tags=["admin:license"])


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


def _device_list(db: Session, company_id: uuid.UUID) -> list[Device]:
    return list(
        db.scalars(
            sa.select(Device)
            .options(joinedload(Device.user))
            .where(Device.company_id == company_id)
            .order_by(Device.last_seen_at.desc())
        ).all()
    )


def _device_out(device: Device) -> DeviceOut:
    from app.schemas.admin import UserBrief

    return DeviceOut(
        id=device.id,
        device_uuid=device.device_uuid,
        platform=device.platform,
        app_version=device.app_version,
        is_active=device.is_active,
        first_seen_at=device.first_seen_at,
        last_seen_at=device.last_seen_at,
        user=(
            UserBrief(
                id=device.user.id,
                user_cedula=device.user.user_cedula,
                full_name=device.user.full_name,
                role=device.user.role,
            )
            if device.user
            else None
        ),
    )


@router.get("", response_model=LicenseOut)
def get_license(
    db: Session = Depends(get_db), user: User = Depends(get_current_admin)
) -> LicenseOut:
    company = user.company
    snapshot = licensing.license_snapshot(db, company)
    return LicenseOut(
        **snapshot,
        tax_id=company.tax_id,
        devices=[_device_out(d) for d in _device_list(db, company.id)],
    )


@router.get("/devices", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db), user: User = Depends(get_current_admin)
) -> list[DeviceOut]:
    return [_device_out(d) for d in _device_list(db, user.company_id)]


@router.delete("/devices/{device_id}", response_model=Message)
def release_device(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Message:
    """Free a device slot so a new hardware UUID can register."""
    if not licensing.release_device(db, user.company_id, device_id):
        raise _error(404, "Dispositivo no encontrado.", "DEVICE_NOT_FOUND")
    return Message(detail="Ranura de dispositivo liberada.")


@router.post("/devices/{device_id}/block", response_model=Message)
def block_device(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Message:
    """Blacklist a UUID (lost/stolen device). It can never re-register."""
    if not licensing.block_device(db, user.company_id, device_id):
        raise _error(404, "Dispositivo no encontrado.", "DEVICE_NOT_FOUND")
    return Message(detail="Dispositivo bloqueado permanentemente.")
