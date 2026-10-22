"""FastAPI dependencies: auth, roles and the mobile license context."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.security import TokenError, decode_token
from app.db.session import get_db
from app.models.company import Company
from app.models.device import Device
from app.models.enums import Role, SecurityEventType
from app.models.user import User
from app.services import licensing
from app.services.audit import PendingSecurityEvent, persist_security_events

bearer_scheme = HTTPBearer(auto_error=False)


def _http_error(status_code: int, message: str, code: str, **extra) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code, **extra})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _http_error(401, "Token de acceso requerido.", "UNAUTHORIZED")
    try:
        claims = decode_token(credentials.credentials, expected_type="access")
    except TokenError as exc:
        raise _http_error(401, "Token inválido o vencido.", "INVALID_TOKEN") from exc

    if cache.get(f"revoked:{claims.get('jti')}"):
        raise _http_error(401, "Sesión revocada.", "TOKEN_REVOKED")

    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (TypeError, ValueError) as exc:
        raise _http_error(401, "Token inválido.", "INVALID_TOKEN") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _http_error(401, "Usuario inexistente o desactivado.", "USER_DISABLED")
    return user


# --------------------------------------------------------------------- rate limit ---
def rate_limit_dependency(
    namespace: str,
    limit: int,
    window_seconds: int,
    *,
    key_fn: Callable[[Request, User], str],
) -> Callable[[Request, User], None]:
    """Crea una dependencia que aplica rate-limit por llave dinámica.

    La llave la construye ``key_fn(request, user)``; típicamente
    ``f"driver:{user.id}"`` o similar. Usa la caché compartida (Redis o memoria).
    """
    def dependency(request: Request, user: User = Depends(get_current_user)) -> None:
        key = f"{namespace}:{key_fn(request, user)}"
        result = cache.rate_limit(key, limit, window_seconds)
        if not result.allowed:
            raise _http_error(
                429,
                "Demasiadas peticiones. Espere antes de reintentar.",
                "RATE_LIMIT",
                retry_after=result.retry_after,
            )
    return dependency


driver_rate_limit = rate_limit_dependency(
    namespace="driver-api",
    limit=120,              # 120 req / 5 min = razonable para panel web
    window_seconds=300,
    key_fn=lambda _req, user: f"user:{user.id}",
)


def require_roles(*roles: Role):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise _http_error(403, "Permiso insuficiente para esta operación.", "FORBIDDEN_ROLE")
        return user

    return dependency


get_current_admin = require_roles(Role.ADMIN)
get_current_staff = require_roles(Role.ADMIN, Role.WAREHOUSE)


def get_user_company(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Company:
    company = db.get(Company, user.company_id)
    if company is None:
        raise _http_error(403, "Empresa no encontrada.", "COMPANY_NOT_FOUND")
    return company


def require_active_license(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Company:
    """Corta el panel cuando la licencia esta vencida o desactivada.

    El API movil ya tiene su propio guardia (middleware); este cubre
    /api/v1/admin, donde antes una licencia vencida seguia operando con el
    token de sesion. La pantalla de licencia queda fuera de esta dependencia
    para que el cliente pueda ver su estado y el contacto del proveedor.
    """
    company = db.get(Company, user.company_id)
    if company is None:
        raise _http_error(403, "Empresa no encontrada.", "COMPANY_NOT_FOUND")
    licensing.assert_subscription_valid(company)
    return company


# ---------------------------------------------------------------- mobile ----
@dataclass
class MobileContext:
    company: Company
    user: User
    device_uuid: str
    device: Device


def get_mobile_context(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MobileContext:
    """Post-middleware dependency: license was already validated.

    Re-resolves the company, enforces tenant coherence (JWT user vs license
    company) and registers/refreshes the device heartbeat.
    """
    company_id = getattr(request.state, "license_company_id", None)
    if company_id is None:
        raise _http_error(401, "Contexto de licencia ausente.", "MISSING_LICENSE_CONTEXT")

    company = db.get(Company, uuid.UUID(company_id))
    if company is None:
        raise _http_error(402, "Licencia no válida.", "INVALID_LICENSE_KEY")

    if user.company_id != company.id:
        persist_security_events(
            db,
            company.id,
            [
                PendingSecurityEvent(
                    event_type=SecurityEventType.CROSS_TENANT,
                    user_id=user.id,
                    device_uuid=request.headers.get("X-Device-UUID"),
                    detail={
                        "user_company": str(user.company_id),
                        "license_company": str(company.id),
                        "path": request.url.path,
                    },
                )
            ],
        )
        db.commit()
        raise _http_error(403, "La licencia no corresponde al usuario autenticado.", "CROSS_TENANT")

    device_uuid = (request.headers.get("X-Device-UUID") or "").strip()
    device = licensing.register_device(
        db,
        company,
        device_uuid,
        user=user,
        platform=request.headers.get("X-Device-Platform"),
        app_version=request.headers.get("X-App-Version"),
        throttle=True,
    )
    db.commit()
    return MobileContext(company=company, user=user, device_uuid=device_uuid, device=device)