"""Mobile API: guarded by LicenseGuardMiddleware (X-License-Key + X-Device-UUID)."""

from app.api.v1.mobile.router import router

__all__ = ["router"]
