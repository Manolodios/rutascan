"""Offset pagination for the security audit trail."""

from __future__ import annotations

from app.api.v1.admin.security import list_security_events
from app.models.enums import SecurityEventType
from app.models.security_event import SecurityEvent


def _seed_events(db, tenant, count: int) -> None:
    for index in range(count):
        db.add(
            SecurityEvent(
                company_id=tenant.company.id,
                event_type=SecurityEventType.MOCK_GPS,
                user_id=tenant.admin.id,
                detail={"index": index},
            )
        )
    db.commit()


def test_security_events_offset_walks_all_rows(db, tenant):
    _seed_events(db, tenant, 5)

    first = list_security_events(limit=2, offset=0, db=db, user=tenant.admin)
    second = list_security_events(limit=2, offset=2, db=db, user=tenant.admin)
    third = list_security_events(limit=2, offset=4, db=db, user=tenant.admin)

    assert [len(first), len(second), len(third)] == [2, 2, 1]
    ids = [event.id for event in first + second + third]
    assert len(ids) == len(set(ids)) == 5
