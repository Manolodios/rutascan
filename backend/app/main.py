"""FastAPI application factory: middleware, exception handlers, routing, mounts."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.api.v1 import api_router
from app.api.v1.auth import router as auth_router
from app.core.cache import cache
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.middleware.license import LicenseGuardMiddleware
from app.services.licensing import LicenseError
from app.services.scans import ScanError

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("rutascan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cache.init(settings.redis_url)
    try:
        from app.db.init_db import init_db  # local import: avoids engine work at import time

        init_db(seed=settings.seed_demo_data)
    except Exception:
        logger.exception("DB initialization failed - check DATABASE_URL / connectivity")
        if settings.is_production:
            raise
    yield


def _json_error(status_code: int, message: str, code: str | None = None, **extra) -> JSONResponse:
    content: dict = {"detail": message}
    if code:
        content["code"] = code
    content.update(extra)
    return JSONResponse(status_code=status_code, content=content)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "RutaScan - B2B cargo tracking SaaS.Offline-first driver app, "
            "warehouse scanning and server-side license enforcement."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )

    # --- middleware (order matters: last added runs first) --------------------
    app.add_middleware(LicenseGuardMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=settings.cors_origin_list != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    # --- exception handlers: uniform {detail, code} envelope -------------------
    @app.exception_handler(LicenseError)
    async def _license_error(_request, exc: LicenseError):
        return _json_error(exc.status_code, exc.message, exc.code, **exc.detail)

    @app.exception_handler(ScanError)
    async def _scan_error(_request, exc: ScanError):
        return _json_error(exc.status_code, exc.message, exc.code, **exc.detail)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_request, exc: StarletteHTTPException):
        if isinstance(exc.detail, dict):
            content = {"detail": exc.detail.get("detail", "Error")}
            content.update({k: v for k, v in exc.detail.items() if k != "detail"})
            return JSONResponse(status_code=exc.status_code, content=jsonable_encoder(content), headers=exc.headers)
        return JSONResponse(
            status_code=exc.status_code, content={"detail": str(exc.detail)}, headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request, exc: RequestValidationError):
        errors = exc.errors()
        first = errors[0] if errors else {}
        location = ".".join(str(part) for part in first.get("loc", []) if part not in ("body", "query"))
        message = f"Datos inválidos ({location}): {first.get('msg', 'error')}"
        return JSONResponse(
            status_code=422,
            content={"detail": message, "code": "VALIDATION_ERROR", "errors": jsonable_encoder(errors[:10])},
        )

    # --- routes ---------------------------------------------------------------
    app.include_router(auth_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        db_ok = True
        try:
            with SessionLocal() as db:
                db.execute(sa.text("SELECT 1"))
        except Exception:
            db_ok = False
        return {
            "status": "ok" if db_ok else "degraded",
            "version": __version__,
            "database": "up" if db_ok else "down",
            "cache_backend": cache.backend,
            "environment": settings.environment,
        }

    # --- static mounts ---------------------------------------------------------
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    web_path = Path(settings.web_dir) if settings.web_dir else Path(__file__).resolve().parents[2] / "web"
    if web_path.is_dir():
        app.mount("/", StaticFiles(directory=str(web_path), html=True), name="web")
    else:
        @app.get("/", include_in_schema=False)
        def root() -> RedirectResponse:
            return RedirectResponse(url="/docs")

    return app


app = create_app()
