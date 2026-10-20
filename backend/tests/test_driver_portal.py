"""Driver portal: own-data scoping, scan trail and history."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.core.geo import local_today, utcnow
from app.models.delivery import DeliveryLog
from app.models.enums import RouteStatus, ScanAction
from app.models.route import Route, RouteDetail
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


def test_today_reports_what_is_left_to_deliver(db, tenant):
    data = driver_portal.driver_today(db, tenant.company.id, tenant.driver)

    assert data["pending"] == {"lines": 2, "units": 3}
    remaining = {
        item["route_detail_id"]: item["remaining_quantity"] for item in data["items"]
    }
    assert remaining == {str(tenant.detail_a.id): 1, str(tenant.detail_c.id): 2}

    detail = driver_portal.driver_route_detail(
        db, tenant.company.id, tenant.driver.id, tenant.route.id
    )
    assert detail["pending"] == {"lines": 2, "units": 3}


def test_pending_routes_show_tomorrow_not_today(db, tenant):
    tomorrow = local_today() + timedelta(days=1)
    route_tomorrow = Route(
        company_id=tenant.company.id,
        truck_id=tenant.truck.id,
        route_date=tomorrow,
        status=RouteStatus.PENDING,
    )
    db.add(route_tomorrow)
    db.flush()
    db.add(
        RouteDetail(
            company_id=tenant.company.id,
            route_id=route_tomorrow.id,
            product_id=tenant.product_a.id,
            assigned_quantity=2,
        )
    )
    db.commit()

    data = driver_portal.driver_today(db, tenant.company.id, tenant.driver)
    ids = [route["id"] for route in data["pending_routes"]]

    # La ruta de hoy va en la tarjeta principal, no se repite en "por empezar".
    assert str(tenant.route.id) not in ids
    assert ids == [str(route_tomorrow.id)]
    assert data["pending_routes"][0]["counts"]["assigned_units"] == 2


def test_pending_routes_ignore_closed_routes(db, tenant):
    db.add(
        Route(
            company_id=tenant.company.id,
            truck_id=tenant.truck.id,
            route_date=local_today() + timedelta(days=2),
            status=RouteStatus.COMPLETED,
        )
    )
    db.add(
        Route(
            company_id=tenant.company.id,
            truck_id=tenant.truck.id,
            route_date=local_today() + timedelta(days=3),
            status=RouteStatus.COMPLETED,
        )
    )
    db.commit()

    routes = driver_portal.driver_pending_routes(db, tenant.company.id, tenant.driver.id)

    # Solo queda la ruta abierta de hoy: las completadas no cuentan.
    assert [route["id"] for route in routes] == [str(tenant.route.id)]


def test_history_ignores_future_routes(db, tenant):
    db.add(
        Route(
            company_id=tenant.company.id,
            truck_id=tenant.truck.id,
            route_date=local_today() + timedelta(days=1),
            status=RouteStatus.PENDING,
        )
    )
    db.commit()

    data = driver_portal.driver_history(db, tenant.company.id, tenant.driver.id, days=7)

    assert [route["route_date"] for route in data["routes"]] == [local_today().isoformat()]
