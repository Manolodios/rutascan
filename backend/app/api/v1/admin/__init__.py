"""Admin API aggregation (/api/v1/admin/*)."""

from fastapi import APIRouter

from app.api.v1.admin import (
    dashboard,
    license,
    products,
    reports,
    routes,
    security,
    trucks,
    users,
)

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(dashboard.router)
router.include_router(trucks.router)
router.include_router(users.router)
router.include_router(products.router)
router.include_router(routes.router)
router.include_router(license.router)
router.include_router(reports.router)
router.include_router(security.router)

__all__ = ["router"]
