"""API routes: /api/v1 (mobile, driver, admin, platform) + /auth at the root."""

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.driver import router as driver_router
from app.api.v1.mobile import router as mobile_router
from app.api.v1.platform import router as platform_router

api_router = APIRouter()
api_router.include_router(mobile_router)
api_router.include_router(driver_router)
api_router.include_router(admin_router)
api_router.include_router(platform_router)

__all__ = ["api_router"]
