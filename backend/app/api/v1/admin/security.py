"""Anti-fraud audit trail endpoints (security events)."""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_staff
from app.db.session import get_db
from app.models.enums import SecurityEventType
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.admin import SecurityEventOut, UserBrief

router = APIRouter(prefix="/security-events", tags=["admin:security"])


def _event_out(event: SecurityEvent) -> SecurityEventOut:
    return SecurityEventOut(
        id=event.id,
        event_type=event.event_type,
        created_at=event.created_at,
        device_uuid=event.device_uuid,
        latitude=event.latitude,
        longitude=event.longitude,
        detail=event.detail,
        user=(
            UserBrief(
                id=event.user.id,
                user_cedula=event.user.user_cedula,
                full_name=event.user.full_name,
                role=event.user.role,
            )
            if event.user
            else None
        ),
    )


@router.get("", response_model=list[SecurityEventOut])
def list_security_events(
    event_type: SecurityEventType | None = None,
    date_from: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> list[SecurityEventOut]:
    stmt = (
        sa.select(SecurityEvent)
        .options(joinedload(SecurityEvent.user))
        .where(SecurityEvent.company_id == user.company_id)
        .order_by(SecurityEvent.created_at.desc(), SecurityEvent.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if event_type is not None:
        stmt = stmt.where(SecurityEvent.event_type == event_type)
    if date_from is not None:
        stmt = stmt.where(SecurityEvent.created_at >= date_from)
    return [_event_out(e) for e in db.scalars(stmt).all()]
