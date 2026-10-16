"""Server-side license control (the anti-piracy pillar).

Rules enforced here:
  * every mobile request carries X-License-Key + X-Device-UUID
  * suspended / expired / inactive company  -> LicenseError(402)
  * new hardware UUID beyond `max_trucks`   -> LicenseError(403)
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.geo import ensure_utc, utcnow
from app.models.company import Company
from app.models.device import Device
from app.models.enums import SecurityEventType, SubscriptionStatus
from app.models.security_event import SecurityEvent
from app.models.user import User

LICENSE_WARN_DAYS = 7
DEVICE_TOUCH_THROTTLE_SECONDS = 60


class LicenseError(Exception):
    """Carries the exact HTTP status + machine-readable code for the client."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        detail: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.detail = detail or {}


# ------------------------------------------------------------------ company --
def get_company_by_license(db: Session, license_key: str) -> Company | None:
    if not license_key:
        return None
    return db.scalar(
        sa.select(Company).where(Company.license_key == license_key.strip())
    )


def assert_subscription_valid(company: Company) -> None:
    if not company.is_active:
        raise LicenseError(402, "SUBSCRIPTION_INACTIVE", "Cuenta desactivada por el proveedor.")
    if company.subscription_status != SubscriptionStatus.ACTIVE:
        raise LicenseError(
            402, "SUBSCRIPTION_SUSPENDED", "Suscripción suspendida. Contacte a su proveedor."
        )
    if company.expiration_date < date.today():
        raise LicenseError(
            402,
            "SUBSCRIPTION_EXPIRED",
            "Licencia vencida. Renueve para continuar operando.",
            detail={"expiration_date": company.expiration_date.isoformat()},
        )


def days_until_expiration(company: Company) -> int:
    return (company.expiration_date - date.today()).days


# ------------------------------------------------------------------ devices --
def _device_threshold() -> object:
    return utcnow() - timedelta(days=get_settings().device_ttl_days)


def count_active_devices(db: Session, company_id: uuid.UUID) -> int:
    threshold = _device_threshold()
    return int(
        db.scalar(
            sa.select(sa.func.count())
            .select_from(Device)
            .where(
                Device.company_id == company_id,
                Device.is_active.is_(True),
                Device.last_seen_at >= threshold,
            )
        )
        or 0
    )


def _flag_event(
    db: Session,
    company: Company,
    event_type: SecurityEventType,
    *,
    user_id: uuid.UUID | None = None,
    device_uuid: str | None = None,
    detail: dict | None = None,
) -> None:
    """Persist a fraud signal immediately (committed on its own)."""
    db.add(
        SecurityEvent(
            company_id=company.id,
            event_type=event_type,
            user_id=user_id,
            device_uuid=device_uuid,
            detail=detail,
        )
    )
    db.commit()


def register_device(
    db: Session,
    company: Company,
    device_uuid: str,
    *,
    user: User | None = None,
    platform: str | None = None,
    app_version: str | None = None,
    throttle: bool = True,
) -> Device:
    """Register/refresh a hardware UUID, enforcing the license device cap."""
    device_uuid = (device_uuid or "").strip()[:64]
    if not device_uuid:
        raise LicenseError(400, "MISSING_DEVICE_UUID", "X-Device-UUID header is required.")

    now = utcnow()
    device = db.scalar(
        sa.select(Device).where(
            Device.company_id == company.id, Device.device_uuid == device_uuid
        )
    )

    if device is not None and not device.is_active:
        raise LicenseError(
            403,
            "DEVICE_BLOCKED",
            "Este dispositivo fue bloqueado. Contacte al administrador.",
        )

    if device is None:
        if count_active_devices(db, company.id) >= company.max_trucks:
            _flag_event(
                db,
                company,
                SecurityEventType.DEVICE_LIMIT,
                user_id=user.id if user else None,
                device_uuid=device_uuid,
                detail={
                    "license_key": company.license_key,
                    "max_trucks": company.max_trucks,
                },
            )
            raise LicenseError(
                403,
                "DEVICE_LIMIT_REACHED",
                f"Límite de dispositivos alcanzado ({company.max_trucks}). "
                "Libere un dispositivo desde el panel o amplíe su plan.",
                detail={"max_trucks": company.max_trucks},
            )
        device = Device(
            company_id=company.id,
            device_uuid=device_uuid,
            user_id=user.id if user else None,
            platform=platform,
            app_version=app_version,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(device)
        db.flush()
        return device

    # Existing device: refresh activity (throttled to avoid write storms).
    last_seen = ensure_utc(device.last_seen_at) if device.last_seen_at else None
    if (
        not throttle
        or last_seen is None
        or (now - last_seen).total_seconds() >= DEVICE_TOUCH_THROTTLE_SECONDS
    ):
        device.last_seen_at = now
    if user is not None and device.user_id != user.id:
        device.user_id = user.id
    if platform:
        device.platform = platform
    if app_version:
        device.app_version = app_version
    db.flush()
    return device


def release_device(db: Session, company_id: uuid.UUID, device_id: uuid.UUID) -> bool:
    """Free a device slot: the row is removed so the UUID can re-register."""
    device = db.scalar(
        sa.select(Device).where(Device.id == device_id, Device.company_id == company_id)
    )
    if device is None:
        return False
    db.delete(device)
    db.commit()
    return True


def block_device(db: Session, company_id: uuid.UUID, device_id: uuid.UUID) -> bool:
    device = db.scalar(
        sa.select(Device).where(Device.id == device_id, Device.company_id == company_id)
    )
    if device is None:
        return False
    device.is_active = False
    device.user_id = None
    db.commit()
    return True


# ------------------------------------------------------------------ snapshot --
def license_snapshot(db: Session, company: Company) -> dict:
    days_left = days_until_expiration(company)
    return {
        "license_key": company.license_key,
        "company_name": company.name,
        "subscription_status": company.subscription_status.value,
        "expiration_date": company.expiration_date.isoformat(),
        "days_remaining": days_left,
        "expiring_soon": 0 <= days_left <= LICENSE_WARN_DAYS,
        "expired": days_left < 0,
        "max_trucks": company.max_trucks,
        "active_devices": count_active_devices(db, company.id),
        "device_ttl_days": get_settings().device_ttl_days,
    }
