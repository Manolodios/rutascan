"""Authentication: login with cedula + 4-digit PIN, refresh, logout."""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.cache import (
    cache,
    check_rate_limit,
    register_failed_attempt,
    reset_rate_limit,
)
from app.core.config import get_settings
from app.core.geo import utcnow
from app.core.security import (
    TokenError,
    create_access_token,
    create_grace_token,
    create_refresh_token,
    decode_token,
    hash_pin,
    token_seconds_remaining,
    verify_pin,
)
from app.db.session import get_db
from app.models.company import Company
from app.models.enums import Role, SecurityEventType
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.auth import (
    ChangePinRequest,
    CompanyPublic,
    HeartbeatResponse,
    LicenseStatusOut,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenPair,
    UserPublic,
)
from app.schemas.common import Message
from app.services import licensing
from app.services.licensing import LicenseError

router = APIRouter(prefix="/auth", tags=["auth"])


def _error(status_code: int, message: str, code: str, **extra) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code, **extra})


def _client_ip(request: Request) -> str:
    """IP del cliente (detras del proxy de Render) para el limite por conexion.

    X-Forwarded-For tiene la forma ``cliente, proxy1, proxy2``. El valor de la
    izquierda lo puede inventar el cliente (para saltarse el bloqueo cambiando
    la IP en la cabecera), en cambio el de la derecha lo agrega el proxy de
    confianza (Render) y por eso es el unico fiable. Nos quedamos con el ultimo.
    """
    forwarded = request.headers.get("x-forwarded-for") or ""
    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    if hops:
        return hops[-1]
    return request.client.host if request.client else "desconocida"


def _grace_for(user: User, company: Company | None) -> tuple[str, datetime] | None:
    if company is None or user.role == Role.ADMIN:
        return None
    return create_grace_token(
        str(company.id), company.license_key, company.name, company.max_trucks
    )


def _token_pair(
    user: User,
    company: Company | None,
    license_out: LicenseStatusOut | None,
    grace: tuple[str, datetime] | None,
) -> TokenPair:
    settings = get_settings()
    access = create_access_token(str(user.id), str(user.company_id), user.role.value)
    refresh = create_refresh_token(str(user.id), str(user.company_id), user.role.value)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_minutes * 60,
        user=UserPublic.model_validate(user),
        company=CompanyPublic.model_validate(company) if company else None,
        license=license_out,
        grace_token=grace[0] if grace else None,
        grace_expires_at=grace[1] if grace else None,
    )


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    """Cedula + 4-digit PIN login.

    Mobile clients additionally send X-License-Key/X-Device-UUID so that
    suspended/expired licenses cannot even authenticate (HTTP 402) and device
    slots are enforced (HTTP 403).
    """
    settings = get_settings()
    license_key = (request.headers.get("X-License-Key") or "").strip()

    company: Company | None = None
    if license_key:
        company = licensing.get_company_by_license(db, license_key)
        if company is None:
            raise LicenseError(402, "INVALID_LICENSE_KEY", "Licencia no válida o no registrada.")
        licensing.assert_subscription_valid(company)

    cedula = payload.cedula.strip()
    user = db.scalar(sa.select(User).where(User.user_cedula == cedula))

    # --- brute force protection ------------------------------------------
    ip = _client_ip(request)
    ip_limit = check_rate_limit(
        "login-ip", ip, settings.login_ip_max_attempts, settings.pin_lockout_minutes * 60
    )
    if not ip_limit.allowed:
        raise _error(
            429,
            "Demasiados intentos desde esta conexión. Espere antes de reintentar.",
            "IP_LOCKOUT",
            retry_after=ip_limit.retry_after,
        )

    limit = check_rate_limit(
        "pin-login", cedula, settings.pin_max_attempts, settings.pin_lockout_minutes * 60
    )
    if not limit.allowed:
        if user is not None:
            db.add(
                SecurityEvent(
                    company_id=user.company_id,
                    event_type=SecurityEventType.PIN_LOCKOUT,
                    user_id=user.id,
                    detail={"cedula": cedula, "retry_after_seconds": limit.retry_after},
                )
            )
            db.commit()
        raise _error(
            429,
            "Demasiados intentos fallidos. Espere antes de reintentar.",
            "PIN_LOCKOUT",
            retry_after=limit.retry_after,
        )

    if user is None or not user.is_active or not verify_pin(payload.pin, user.pin_hash):
        register_failed_attempt("pin-login", cedula, settings.pin_lockout_minutes * 60)
        register_failed_attempt("login-ip", ip, settings.pin_lockout_minutes * 60)
        raise _error(401, "Cédula o PIN incorrectos.", "INVALID_CREDENTIALS")

    # --- tenant coherence ---------------------------------------------------
    if company is not None and user.company_id != company.id:
        db.add(
            SecurityEvent(
                company_id=company.id,
                event_type=SecurityEventType.CROSS_TENANT,
                user_id=user.id,
                device_uuid=payload.device_uuid,
                detail={"license_key": company.license_key, "cedula": cedula},
            )
        )
        db.commit()
        raise _error(403, "La licencia no corresponde a este usuario.", "CROSS_TENANT")

    reset_rate_limit("pin-login", cedula)
    user.last_login_at = utcnow()

    target_company = company or db.get(Company, user.company_id)

    if payload.device_uuid and user.role != Role.ADMIN and target_company is not None:
        licensing.register_device(
            db,
            target_company,
            payload.device_uuid,
            user=user,
            platform=payload.platform,
            app_version=payload.app_version,
            throttle=False,
        )
    db.commit()

    license_out = (
        LicenseStatusOut(**licensing.license_snapshot(db, target_company))
        if target_company
        else None
    )
    return _token_pair(user, target_company, license_out, _grace_for(user, target_company))


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise _error(401, "Refresh token inválido o vencido.", "INVALID_REFRESH_TOKEN") from exc

    jti = claims.get("jti")
    if jti and cache.get(f"revoked:{jti}"):
        raise _error(401, "Sesión revocada.", "TOKEN_REVOKED")

    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (TypeError, ValueError) as exc:
        raise _error(401, "Refresh token inválido.", "INVALID_REFRESH_TOKEN") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _error(401, "Usuario inexistente o desactivado.", "USER_DISABLED")

    company = db.get(Company, user.company_id)
    license_header = (request.headers.get("X-License-Key") or "").strip()
    if license_header:
        if company is None or company.license_key != license_header:
            raise LicenseError(403, "CROSS_TENANT", "La licencia no corresponde al usuario.")
        licensing.assert_subscription_valid(company)

    # Rotate: burn the old refresh jti.
    if jti:
        cache.set(f"revoked:{jti}", "1", token_seconds_remaining(claims))

    license_out = (
        LicenseStatusOut(**licensing.license_snapshot(db, company)) if company else None
    )
    grace = _grace_for(user, company) if license_header else None
    return _token_pair(user, company, license_out, grace)


@router.post("/logout", response_model=Message)
def logout(
    payload: LogoutRequest,
    request: Request,
    user: User = Depends(get_current_user),
) -> Message:
    if payload.refresh_token:
        try:
            claims = decode_token(payload.refresh_token, expected_type="refresh")
            if claims.get("jti"):
                cache.set(
                    f"revoked:{claims['jti']}", "1", token_seconds_remaining(claims)
                )
        except TokenError:
            pass

    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            access_claims = decode_token(auth_header[7:], expected_type="access")
            if access_claims.get("jti"):
                cache.set(
                    f"revoked:{access_claims['jti']}",
                    "1",
                    token_seconds_remaining(access_claims),
                )
        except TokenError:
            pass

    return Message(detail="Sesión cerrada correctamente.")


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    company = db.get(Company, user.company_id)
    return {
        "user": UserPublic.model_validate(user),
        "company": CompanyPublic.model_validate(company) if company else None,
        "license": licensing.license_snapshot(db, company) if company else None,
    }


@router.post("/change-pin", response_model=Message)
def change_pin(
    payload: ChangePinRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    """Cambia el PIN del usuario autenticado verificando el PIN actual."""
    settings = get_settings()
    scope_id = str(user.id)
    limit = check_rate_limit(
        "change-pin",
        scope_id,
        settings.pin_max_attempts,
        settings.pin_lockout_minutes * 60,
    )
    if not limit.allowed:
        raise _error(
            429,
            "Demasiados intentos. Espere antes de reintentar.",
            "PIN_LOCKOUT",
            retry_after=limit.retry_after,
        )

    if not verify_pin(payload.current_pin, user.pin_hash):
        register_failed_attempt(
            "change-pin", scope_id, settings.pin_lockout_minutes * 60
        )
        raise _error(401, "El PIN actual no es correcto.", "INVALID_CURRENT_PIN")

    if payload.current_pin == payload.new_pin:
        raise _error(
            400,
            "El PIN nuevo debe ser distinto al actual.",
            "PIN_UNCHANGED",
        )

    user.pin_hash = hash_pin(payload.new_pin)
    db.commit()
    reset_rate_limit("change-pin", scope_id)
    return Message(detail="PIN actualizado correctamente.")


@router.get("/heartbeat", response_model=HeartbeatResponse)
def heartbeat(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> HeartbeatResponse:
    """Authenticated heartbeat usable by web clients (mobile uses the guarded
    /api/v1/mobile/heartbeat which also renews the offline grace token)."""
    company = db.get(Company, user.company_id)
    if company is None:
        raise _error(403, "Empresa no encontrada.", "COMPANY_NOT_FOUND")
    licensing.assert_subscription_valid(company)
    grace_token, grace_expires = create_grace_token(
        str(company.id), company.license_key, company.name, company.max_trucks
    )
    return HeartbeatResponse(
        server_time_utc=utcnow(),
        license=LicenseStatusOut(**licensing.license_snapshot(db, company)),
        grace_token=grace_token,
        grace_expires_at=grace_expires,
    )
