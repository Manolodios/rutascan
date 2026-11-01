"""Demo auto-refresh: stale seed data moves to today without duplicate routes."""

from __future__ import annotations

from contextlib import nullcontext
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

import sqlalchemy as sa

from app.core.geo import local_date, local_today
from app.db import init_db
from app.models import (
    Company,
    DeliveryLog,
    Product,
    Role,
    Route,
    RouteDetail,
    RouteStatus,
    ScanAction,
    Truck,
    User,
)


def _seed_demo_tenant(db, *, old_day):
    company = Company(
        name="Demo Refresh Co",
        tax_id="J-DEMO-REFRESH",
        license_key=init_db.DEMO_LICENSE_KEY,
        expiration_date=old_day + timedelta(days=365),
        max_trucks=12,
    )
    db.add(company)
    db.flush()

    admin = User(
        company_id=company.id,
        user_cedula="A-REFRESH",
        full_name="Admin",
        role=Role.ADMIN,
        pin_hash="x",
    )
    driver = User(
        company_id=company.id,
        user_cedula="D-REFRESH",
        full_name="Driver",
        role=Role.DRIVER,
        pin_hash="x",
    )
    truck = Truck(
        company_id=company.id,
        license_plate=init_db.DEMO_PENDING_PLATE,
        model="Demo truck",
    )
    other_truck = Truck(company_id=company.id, license_plate="OTHER-1", model="Other")
    db.add_all([admin, driver, truck, other_truck])
    db.flush()

    products = [
        Product(
            company_id=company.id,
            barcode_qr=f"75920010000{index}",
            description=f"Producto {index}",
            unit="UNIT",
            weight=Decimal("1"),
        )
        for index in range(init_db.DEMO_PENDING_LINES)
    ]
    db.add_all(products)
    db.flush()

    old_route = Route(
        company_id=company.id,
        truck_id=truck.id,
        route_date=old_day,
        status=RouteStatus.IN_PROGRESS,
        created_by_id=admin.id,
    )
    db.add(old_route)
    db.flush()

    detail = RouteDetail(
        company_id=company.id,
        route_id=old_route.id,
        product_id=products[0].id,
        assigned_quantity=1,
    )
    db.add(detail)
    db.flush()

    scan_at = datetime.combine(old_day, time(12), tzinfo=timezone.utc)
    db.add(
        DeliveryLog(
            company_id=company.id,
            route_detail_id=detail.id,
            driver_id=driver.id,
            scan_uuid="scan-refresh-1",
            action=ScanAction.LOAD,
            quantity=1,
            scan_timestamp_utc=scan_at,
            server_timestamp_utc=scan_at + timedelta(seconds=5),
            latitude=10.4,
            longitude=-71.4,
            device_uuid="device-refresh",
            synced_with_server=True,
        )
    )

    # A route created by hand for today. It must not freeze the seed refresh.
    manual_today = Route(
        company_id=company.id,
        truck_id=other_truck.id,
        route_date=old_day + timedelta(days=9),
        status=RouteStatus.PENDING,
        created_by_id=admin.id,
    )
    db.add(manual_today)
    db.commit()
    return company, old_route, manual_today


def test_refresh_moves_stale_demo_dates_and_keeps_one_pending_route(db, monkeypatch):
    target = local_today()
    old_day = target - timedelta(days=9)
    company, old_route, manual_today = _seed_demo_tenant(db, old_day=old_day)

    monkeypatch.setattr(init_db, "SessionLocal", lambda: nullcontext(db))
    moved = init_db.refresh_demo_dates(target=target)

    assert moved == 9
    dates = list(
        db.scalars(
            sa.select(Route.route_date).where(Route.company_id == company.id)
        )
    )
    assert target in dates  # the old seed route lands today
    assert target + timedelta(days=1) in dates  # pending route for tomorrow
    assert target + timedelta(days=9) in dates  # manual route moved, not frozen

    scan = db.scalar(
        sa.select(DeliveryLog).where(DeliveryLog.company_id == company.id)
    )
    assert local_date(scan.scan_timestamp_utc) == target
    assert db.get(Route, old_route.id).route_date == target
    assert db.get(Route, manual_today.id).route_date == target + timedelta(days=9)

    # A second startup on the same day must not shift anything nor duplicate the
    # pending route.
    route_count = len(dates)
    assert init_db.refresh_demo_dates(target=target) == 0
    assert (
        len(
            list(
                db.scalars(
                    sa.select(Route.route_date).where(
                        Route.company_id == company.id
                    )
                )
            )
        )
        == route_count
    )
