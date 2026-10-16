"""Security-event collection helpers.

Scan processing runs inside savepoints; when a scan is rejected the savepoint
rolls back, so security events are accumulated as plain data on the exception /
outcome and persisted by the caller *after* the rollback decision. This keeps
the audit trail intact without violating transaction atomicity.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.enums import SecurityEventType
from app.models.security_event import SecurityEvent


@dataclass
class PendingSecurityEvent:
    event_type: SecurityEventType
    detail: dict | None = None
    user_id: uuid.UUID | None = None
    device_uuid: str | None = None
    latitude: float | None = None
    longitude: float | None = None


def persist_security_events(
    db: Session,
    company_id: uuid.UUID,
    events: list[PendingSecurityEvent] | None,
) -> int:
    if not events:
        return 0
    for event in events:
        db.add(
            SecurityEvent(
                company_id=company_id,
                event_type=event.event_type,
                user_id=event.user_id,
                device_uuid=event.device_uuid,
                latitude=event.latitude,
                longitude=event.longitude,
                detail=event.detail,
            )
        )
    return len(events)
