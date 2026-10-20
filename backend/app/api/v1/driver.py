"""Driver portal API (web panel, role DRIVER).

Every endpoint is read-only and scoped to the signed-in driver. It exists so a
driver can check their day from a browser when they do not have the phone app
at hand, without exposing the staff modules (which require ADMIN/WAREHOUSE).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_active_license, require_roles
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User
from app.services import driver_portal

router = APIRouter(
    prefix="/driver",
    tags=["driver"],
    dependencies=[Depends(require_active_license)],
)


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


@router.get("/today")
def today(
    user: User = Depends(require_roles(Role.DRIVER)),
    db: Session = Depends(get_db),
) -> dict:
    """Today's route, manifest, scan trail and last known position."""
    return driver_portal.driver_today(db, user.company_id, user)


@router.get("/history")
def history(
    days: int = Query(default=14, ge=1, le=60),
    user: User = Depends(require_roles(Role.DRIVER)),
    db: Session = Depends(get_db),
) -> dict:
    """Recent routes of the truck assigned to this driver."""
    return driver_portal.driver_history(db, user.company_id, user.id, days=days)


@router.get("/routes/{route_id}")
def route_detail(
    route_id: uuid.UUID,
    user: User = Depends(require_roles(Role.DRIVER)),
    db: Session = Depends(get_db),
) -> dict:
    """Manifest of one of the driver's own routes (404 if not theirs)."""
    data = driver_portal.driver_route_detail(db, user.company_id, user.id, route_id)
    if data is None:
        raise _error(404, "Ruta no encontrada.", "ROUTE_NOT_FOUND")
    return data
