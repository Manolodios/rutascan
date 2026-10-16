"""PIN hashing (bcrypt) and JWT token helpers.

Token types:
  - access : short/medium lived (default 8h) API access
  - refresh: long lived (default 60d), rotated on every refresh call
  - grace  : server-signed offline permit for the mobile app (default 3 days).
             The device caches it and can keep scanning without connectivity
             until it expires; then a server heartbeat is mandatory.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

PIN_REGEX = re.compile(r"^\d{4}$")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    """Raised when a JWT is invalid/expired."""


# ---------------------------------------------------------------- PINs ----
def validate_pin_format(pin: str) -> None:
    if not isinstance(pin, str) or not PIN_REGEX.match(pin):
        raise ValueError("PIN must be exactly 4 digits")


def hash_pin(pin: str) -> str:
    validate_pin_format(pin)
    return pwd_context.hash(pin)


def verify_pin(pin: str, pin_hash: str) -> bool:
    if not pin or not pin_hash:
        return False
    try:
        return pwd_context.verify(pin, pin_hash)
    except ValueError:
        # Malformed/legacy hash in DB -> treat as mismatch, never crash login
        return False


# ---------------------------------------------------------------- JWT ------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(
    *,
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    settings = get_settings()
    now = _now()
    payload: dict[str, Any] = {
        "sub": str(subject),
        "typ": token_type,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, payload


def create_access_token(user_id: str, company_id: str, role: str) -> str:
    settings = get_settings()
    token, _ = _encode(
        subject=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_minutes),
        extra={"cid": str(company_id), "role": role},
    )
    return token


def create_refresh_token(user_id: str, company_id: str, role: str) -> str:
    settings = get_settings()
    token, _ = _encode(
        subject=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_days),
        extra={"cid": str(company_id), "role": role},
    )
    return token


def create_grace_token(
    company_id: str,
    license_key: str,
    company_name: str,
    max_trucks: int,
) -> tuple[str, datetime]:
    """Offline permit cached by the mobile app. Cannot be renewed offline."""
    settings = get_settings()
    delta = timedelta(days=settings.grace_token_days)
    token, payload = _encode(
        subject=str(company_id),
        token_type="grace",
        expires_delta=delta,
        extra={
            "lic": license_key,
            "cname": company_name,
            "max_trucks": max_trucks,
        },
    )
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    return token, expires_at


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "typ"]},
            leeway=30,
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid token") from exc

    if expected_type and payload.get("typ") != expected_type:
        raise TokenError(f"Expected {expected_type} token")
    return payload


def token_seconds_remaining(payload: dict[str, Any]) -> int:
    exp = int(payload.get("exp", 0))
    return max(0, exp - int(_now().timestamp()))
