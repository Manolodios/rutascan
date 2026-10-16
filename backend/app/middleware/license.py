"""License guard middleware - the server-side anti-piracy gate.

Guards every /api/v1/mobile/* request:
  missing headers            -> 400 MISSING_LICENSE_HEADERS
  unknown license key        -> 402 INVALID_LICENSE_KEY
  suspended / expired        -> 402 SUBSCRIPTION_SUSPENDED / SUBSCRIPTION_EXPIRED
  new UUID beyond max_trucks -> 403 DEVICE_LIMIT_REACHED
"""

from __future__ import annotations

from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.db.session import SessionLocal
from app.services import licensing
from app.services.licensing import LicenseError

GUARDED_PREFIX = "/api/v1/mobile"


def _error(status_code: int, code: str, message: str, detail: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": message, "code": code, **(detail or {})},
    )


class LicenseGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith(GUARDED_PREFIX):
            return await call_next(request)
        response = await run_in_threadpool(self._validate, request)
        if response is not None:
            return response
        return await call_next(request)

    def _validate(self, request: Request) -> JSONResponse | None:
        license_key = (request.headers.get("X-License-Key") or "").strip()
        device_uuid = (request.headers.get("X-Device-UUID") or "").strip()
        if not license_key or not device_uuid:
            return _error(
                400,
                "MISSING_LICENSE_HEADERS",
                "Las cabeceras X-License-Key y X-Device-UUID son obligatorias.",
            )

        db = SessionLocal()
        try:
            company = licensing.get_company_by_license(db, license_key)
            if company is None:
                return _error(402, "INVALID_LICENSE_KEY", "Licencia no válida o no registrada.")
            try:
                licensing.assert_subscription_valid(company)
                licensing.register_device(
                    db,
                    company,
                    device_uuid,
                    platform=request.headers.get("X-Device-Platform"),
                    app_version=request.headers.get("X-App-Version"),
                    throttle=True,
                )
                db.commit()
            except LicenseError as exc:
                db.rollback()
                return _error(exc.status_code, exc.code, exc.message, exc.detail)
            request.state.license_company_id = str(company.id)
            return None
        finally:
            db.close()
