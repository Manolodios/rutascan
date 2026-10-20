"""Driver portal: own-data scoping, scan trail and history."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.core.geo import local_today, utcnow
from app.models.delivery import DeliveryLog
from app.models.enums import ScanAction
from app.services import driver_portal


def _scan(db, tenant, *, driver_id, barcode_detail) -> DeliveryLog:
    now = utcnow()
    log = DeliveryLog(
        company_id=tenant.company.id,
        route_detail_id=barcode_detail.id,
        driver_id=driver_id,
        scan_uuid=f"test-{uuid4()}",
        action=ScanAction.DELIVER,
        quantity=1,
        scan_timestamp_utc=now,
        server_timestamp_utc=now,
        latitude=10.399,
        longitude=-71.436,
        device_uuid="TEST-DEVICE",
    )
    db.add(log)
    db.commit()
    return log


def test_today_manifest_and_scan_trail(db, tenant):
    _scan(db, tenant, driver_id=tenant.driver.id, barcode_detail=tenant.detail_a)

    data = driver_portal.driver_today(db, tenant.company.id, tenant.driver)

    assert data["route"]["id"] == str(tenant.route.id)
    assert data["route"]["truck"]["license_plate"] == "TST-001"
    assert data["day"] == local_today().isoformat()
    assert data["counts"]["assigned_units"] == 3
    assert len(data["items"]) == 2
    assert len(data["scans"]) == 1
    assert data["scans"][0]["action"] == "DELIVER"
    assert data["scans"][0]["at"].endswith("Z")
    assert data["last_position"]["latitude"] == 10.399


def test_today_without_truck_has_no_route(db, tenant):
    data = driver_portal.driver_today(db, tenant.company.id, tenant.admin)

    assert data["route"] is None
    assert data["counts"]["assigned_units"] == 0
    assert data["scans"] == []
    assert data["message"] == "No tiene ruta asignada para hoy."


def test_history_only_lists_own_routes(db, tenant):
    own = driver_portal.driver_history(db, tenant.company.id, tenant.driver.id, days=7)
    other = driver_portal.driver_history(db, tenant.company.id, tenant.admin.id, days=7)

    assert [route["id"] for route in own["routes"]] == [str(tenant.route.id)]
    assert own["totals"]["routes"] == 1
    assert own["totals"]["assigned_units"] == 3
    assert own["truck"]["license_plate"] == "TST-001"
    assert other["routes"] == []


def test_history_ignores_routes_older_than_window(db, tenant):
    tenant.route.route_date = local_today() - timedelta(days=40)
    db.commit()

    data = driver_portal.driver_history(db, tenant.company.id, tenant.driver.id, days=7)

    assert data["routes"] == []
    assert data["totals"]["routes"] == 0


def test_route_detail_is_scoped_to_the_driver(db, tenant):
    own = driver_portal.driver_route_detail(db, tenant.company.id, tenant.driver.id, tenant.route.id)
    foreign = driver_portal.driver_route_detail(
        db, tenant.company.id, tenant.admin.id, tenant.route.id
    )
    missing = driver_portal.driver_route_detail(
        db, tenant.company.id, tenant.driver.id, uuid4()
    )

    assert own is not None
    assert own["route"]["id"] == str(tenant.route.id)
    assert len(own["items"]) == 2
    assert {item["status"] for item in own["items"]} == {"IN_TRUCK"}
    assert foreign is None
    assert missing is None
