"""Admin API aggregation (/api/v1/admin/*)."""

from fastapi import APIRouter, Depends

from app.api.deps import require_active_license
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

# Licencia vencida/desactivada -> 402 en todo el panel operativo. `license` se
# monta sin el guardia a proposito: el cliente tiene que poder ver su estado.
_active = [Depends(require_active_license)]
router.include_router(dashboard.router, dependencies=_active)
router.include_router(trucks.router, dependencies=_active)
router.include_router(users.router, dependencies=_active)
router.include_router(products.router, dependencies=_active)
router.include_router(routes.router, dependencies=_active)
router.include_router(license.router)
router.include_router(reports.router, dependencies=_active)
router.include_router(security.router, dependencies=_active)

__all__ = ["router"]
