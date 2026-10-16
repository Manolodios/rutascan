"""Integration tests for scan processing + atomic offline batch sync."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.core.geo import utcnow
from app.models import DeliveryLog, DetailStatus, RouteDetail, RouteStatus, SyncBatch
from app.schemas.mobile import ScanRequest
from app.services.scans import ScanError, process_scan, process_scan_batch

DEVICE = "TEST-DEVICE-UUID-0001"


def make_scan(**overrides) -> ScanRequest:
    data = dict(
        scan_uuid=f"scan-{utcnow().timestamp()}-{overrides.get('qr_code', 'QR-A')}",
        qr_code="QR-A",
        action="DELIVER",
        latitude=4.6533,
        longitude=-74.0836,
        gps_accuracy_m=5.0,
        is_mocked_location=False,
        scan_timestamp_utc=utcnow(),
    )
    data.update(overrides)
    return ScanRequest(**data)


def test_deliver_updates_manifest_and_logs(db, tenant):
    payload = make_scan(scan_uuid="flow-deliver-0001")
    outcome = process_scan(
        db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
    )
    db.commit()

    assert outcome.result == "ACCEPTED"
    assert outcome.detail_status == DetailStatus.DELIVERED
    log = db.scalar(select(DeliveryLog).where(DeliveryLog.scan_uuid == "flow-deliver-0001"))
    assert log is not None
    assert log.synced_with_server is True
    assert log.via_offline_batch is False

    # Route auto-started on first scan.
    route = db.get(RouteDetail, tenant.detail_a.id).route
    assert route.status == RouteStatus.IN_PROGRESS
    assert route.started_at is not None


def test_duplicate_scan_uuid_is_idempotent(db, tenant):
    payload = make_scan(scan_uuid="dup-scan-0001")
    process_scan(db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload)
    db.commit()

    again = process_scan(
        db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
    )
    db.commit()
    assert again.result == "DUPLICATE"
    count = db.scalar(
        select(func.count()).select_from(DeliveryLog).where(DeliveryLog.scan_uuid == "dup-scan-0001")
    )
    assert count == 1


def test_item_not_in_manifest_raises_with_audit(db, tenant):
    payload = make_scan(scan_uuid="mismatch-0001", qr_code="QR-B")  # in catalog, not in route
    with pytest.raises(ScanError) as excinfo:
        process_scan(
            db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
        )
    assert excinfo.value.code == "ITEM_NOT_IN_MANIFEST"
    assert len(excinfo.value.security_events) == 1
    assert excinfo.value.security_events[0].event_type.value == "MANIFEST_MISMATCH"


def test_unknown_qr_not_found(db, tenant):
    payload = make_scan(scan_uuid="unknown-0001", qr_code="DOES-NOT-EXIST")
    with pytest.raises(ScanError) as excinfo:
        process_scan(
            db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
        )
    assert excinfo.value.code == "ITEM_NOT_FOUND"


def test_mock_gps_hard_rejected(db, tenant):
    payload = make_scan(scan_uuid="mock-0001", is_mocked_location=True)
    with pytest.raises(ScanError) as excinfo:
        process_scan(
            db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
        )
    assert excinfo.value.code == "MOCK_LOCATION_DETECTED"
    assert excinfo.value.security_events[0].event_type.value == "MOCK_GPS"


def test_reject_requires_reason_and_sets_return(db, tenant):
    payload = make_scan(scan_uuid="reject-0001", action="REJECT")
    with pytest.raises(ScanError) as excinfo:
        process_scan(
            db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload
        )
    assert excinfo.value.code == "REJECTION_REASON_REQUIRED"

    payload_ok = make_scan(scan_uuid="reject-0002", action="REJECT", rejection_reason="DAMAGED")
    outcome = process_scan(
        db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=payload_ok
    )
    db.commit()
    assert outcome.detail_status == DetailStatus.REJECTED
    detail = db.get(RouteDetail, tenant.detail_a.id)
    assert detail.return_required is True
    assert detail.rejection_reason == "DAMAGED"


def test_batch_sync_is_atomic_with_per_item_results(db, tenant):
    items = [
        make_scan(scan_uuid="batch-ok-1"),                     # delivers QR-A
        make_scan(scan_uuid="batch-again-1"),                  # QR-A already delivered
        make_scan(scan_uuid="batch-mismatch-1", qr_code="QR-B"),  # catalog, not in route
        make_scan(scan_uuid="batch-unknown-1", qr_code="NOPE"),   # not in catalog
        make_scan(scan_uuid="batch-ok-1"),                     # in-batch duplicate uuid
    ]

    batch, results = process_scan_batch(
        db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, items=items
    )
    db.commit()

    assert isinstance(batch, SyncBatch)
    assert batch.received_count == 5
    assert batch.accepted_count == 1          # batch-ok-1
    assert batch.rejected_count == 3          # already delivered + mismatch + unknown
    assert batch.duplicate_count == 1         # in-batch repeat of batch-ok-1

    accepted = [r for r in results if r.accepted]
    rejected = [r for r in results if not r.accepted]
    assert len(accepted) == 2
    assert len(rejected) == 3
    assert rejected[0].code == "ALREADY_DELIVERED"
    assert rejected[1].code == "ITEM_NOT_IN_MANIFEST"
    assert rejected[2].code == "ITEM_NOT_FOUND"

    logs = db.scalars(select(DeliveryLog).where(DeliveryLog.via_offline_batch.is_(True))).all()
    assert len(logs) == 1
    assert logs[0].sync_batch_id == batch.id


def test_multi_unit_line_needs_all_scans_and_completes_route(db, tenant):
    first = make_scan(scan_uuid="multi-a-1", qr_code="QR-A")
    outcome_a = process_scan(
        db, company=tenant.company, driver=tenant.driver, device_uuid=DEVICE, payload=first
    )
    assert outcome_a.detail_status == DetailStatus.DELIVERED
    assert outcome_a.route_completed is False  # C still open

    c1 = process_scan(
        db,
        company=tenant.company,
        driver=tenant.driver,
        device_uuid=DEVICE,
        payload=make_scan(scan_uuid="multi-c-1", qr_code="QR-C"),
    )
    assert c1.detail_status == DetailStatus.IN_TRUCK  # 1 of 2 units

    c2 = process_scan(
        db,
        company=tenant.company,
        driver=tenant.driver,
        device_uuid=DEVICE,
        payload=make_scan(scan_uuid="multi-c-2", qr_code="QR-C"),
    )
    db.commit()
    assert c2.detail_status == DetailStatus.DELIVERED
    assert c2.route_completed is True

    detail_c = db.get(RouteDetail, tenant.detail_c.id)
    assert detail_c.delivered_quantity == 2
    assert db.get(type(tenant.route), tenant.route.id).status == RouteStatus.COMPLETED
