"""Admin routes: date-range listing and proof-of-delivery evidence."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.admin.routes import get_route, list_routes
from app.core.geo import local_today, utcnow
from app.models import DeliveryLog, ScanAction
from app.models.route import Route


def _delivery(
    db,
    tenant,
    *,
    detail,
    signature: str | None = None,
    photo: str | None = None,
    minutes: int = 0,
) -> DeliveryLog:
    """A delivery scan, optionally carrying signature/photo evidence."""
    stamp = utcnow() + timedelta(minutes=minutes)
    log = DeliveryLog(
        company_id=tenant.company.id,
        route_detail_id=detail.id,
        driver_id=tenant.driver.id,
        scan_uuid=f"pod-{uuid4()}",
        action=ScanAction.DELIVER,
        quantity=1,
        scan_timestamp_utc=stamp,
        server_timestamp_utc=stamp,
        latitude=10.399,
        longitude=-71.436,
        device_uuid="TEST-DEVICE",
        pod_signature_url=signature,
        pod_photo_url=photo,
    )
    db.add(log)
    db.commit()
    return log


def test_route_detail_exposes_latest_pod_evidence(db, tenant):
    """El panel muestra la firma/foto que el conductor capturó en la entrega."""
    _delivery(
        db,
        tenant,
        detail=tenant.detail_a,
        signature="/uploads/pod/firma-1.png",
        photo="/uploads/pod/foto-1.jpg",
    )
    # Un segundo escaneo con firma nueva: la firma más reciente gana, pero la
    # foto anterior sigue siendo la única evidencia fotográfica.
    _delivery(
        db,
        tenant,
        detail=tenant.detail_a,
        signature="/uploads/pod/firma-2.png",
        minutes=5,
    )

    full = get_route(tenant.route.id, db=db, user=tenant.admin)

    line = next(item for item in full.details if item.id == tenant.detail_a.id)
    assert line.pod_signature_url == "/uploads/pod/firma-2.png"
    assert line.pod_photo_url == "/uploads/pod/foto-1.jpg"


def test_route_detail_pod_is_null_without_evidence(db, tenant):
    full = get_route(tenant.route.id, db=db, user=tenant.admin)

    assert all(
        item.pod_signature_url is None and item.pod_photo_url is None
        for item in full.details
    )


def test_list_routes_filters_by_date_range(db, tenant):
    """Reportes pide todas las rutas del rango, no solo las de dos días sueltos."""
    today = local_today()
    for offset in (1, 2, 10):
        db.add(
            Route(
                company_id=tenant.company.id,
                truck_id=tenant.truck.id,
                route_date=today + timedelta(days=offset),
            )
        )
    db.commit()

    in_range = list_routes(
        date_from=today, date_to=today + timedelta(days=2), db=db, user=tenant.admin
    )
    assert sorted(route.route_date for route in in_range) == [
        today,
        today + timedelta(days=1),
        today + timedelta(days=2),
    ]

    # Solo el extremo superior: incluye las rutas de hoy hacia atrás.
    up_to_today = list_routes(
        date_from=None, date_to=today, db=db, user=tenant.admin
    )
    assert [route.route_date for route in up_to_today] == [today]


def test_list_routes_rejects_inverted_range(db, tenant):
    today = local_today()

    with pytest.raises(HTTPException) as exc:
        list_routes(
            date_from=today, date_to=today - timedelta(days=1), db=db, user=tenant.admin
        )

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "INVALID_DATE_RANGE"
