"""Middleware package."""

from app.middleware.license import LicenseGuardMiddleware

__all__ = ["LicenseGuardMiddleware"]
