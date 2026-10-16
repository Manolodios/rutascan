"""Dashboard endpoints: KPIs, live map and activity feed."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_staff
from app.db.session import get_db
from app.models.user import User
from app.services import dashboard

router = APIRouter(prefix="/dashboard", tags=["admin:dashboard"])


@router.get("/summary")
def summary(
    day: date | None = Query(default=None, description="Por defecto: hoy"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> dict:
    company = user.company
    return dashboard.dashboard_summary(db, company, day)


@router.get("/live-map")
def live_map(
    day: date | None = Query(default=None, description="Por defecto: hoy"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> dict:
    return dashboard.live_map(db, user.company_id, day)


@router.get("/activity")
def activity(
    limit: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> list[dict]:
    return dashboard.recent_activity(db, user.company_id, limit)
