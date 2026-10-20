"""Driver self-service data for the web panel.

Read-only queries scoped to the signed-in driver: today's manifest plus scan
trail, recent route history and one route's detail. The driver only exists in
relation to the truck assigned to them (same rule the mobile app uses), so all
queries join through ``trucks.assigned_driver_id``.

The driver is a viewer, never a writer: everything here is a SELECT, and every
payload is limited to the driver's own truck, route or scan.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import sqlalchemy as sa
from sqlalchemy.orm import Session, joinedload

from app.core.geo import iso_utc, local_day_start_utc, local_today
from app.models.delivery import DeliveryLog
from app.models.enums import DetailStatus, RouteStatus
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.truck import Truck
from app.models.user import User
from app.services.manifest import build_today_manifest, get_driver_truck

SCAN_LIMIT = 30

# Lines that still have to be delivered (rejected ones go back to the truck).
PENDING_STATUSES = (DetailStatus.IN_TRUCK,)
PENDING_STATUS_VALUES = {status.value for status in PENDING_STATUSES}
OPEN_ROUTE_STATUSES = (RouteStatus.PENDING, RouteStatus.IN_PROGRESS)


def _iso(value) -> str | None:
    return iso_utc(value) if value is not None else None


def _detail_status(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _remaining(detail: RouteDetail) -> int:
    return max(detail.assigned_quantity - detail.delivered_quantity, 0)


def _counts(db: Session, route_id: uuid.UUID) -> dict:
    rows = db.execute(
        sa.select(
            RouteDetail.status,
            sa.func.count(),
            sa.func.coalesce(sa.func.sum(RouteDetail.assigned_quantity), 0),
            sa.func.coalesce(sa.func.sum(RouteDetail.delivered_quantity), 0),
        )
        .where(RouteDetail.route_id == route_id)
        .group_by(RouteDetail.status)
    ).all()
    return _aggregate_counts(rows)


def _counts_bulk(db: Session, route_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """Same aggregation as `_counts`, for many routes at once."""
    if not route_ids:
        return {}
    rows = db.execute(
        sa.select(
            RouteDetail.route_id,
            RouteDetail.status,
            sa.func.count(),
            sa.func.coalesce(sa.func.sum(RouteDetail.assigned_quantity), 0),
            sa.func.coalesce(sa.func.sum(RouteDetail.delivered_quantity), 0),
        )
        .where(RouteDetail.route_id.in_(route_ids))
        .group_by(RouteDetail.route_id, RouteDetail.status)
    ).all()

    grouped: dict[uuid.UUID, list[tuple]] = {}
    for route_id, status, count, quantity, delivered_quantity in rows:
        grouped.setdefault(route_id, []).append((status, count, quantity, delivered_quantity))

    return {route_id: _aggregate_counts(rows) for route_id, rows in grouped.items()}


def _aggregate_counts(rows: list[tuple]) -> dict:
    lines = assigned = delivered = rejected = in_truck = 0
    for status, count, quantity, delivered_quantity in rows:
        lines += int(count)
        assigned += int(quantity)
        delivered += int(delivered_quantity)
        if status == DetailStatus.REJECTED:
            rejected += int(count)
        elif status == DetailStatus.IN_TRUCK:
            in_truck += int(count)
    return {
        "lines": lines,
        "assigned_units": assigned,
        "delivered_units": delivered,
        "rejected_lines": rejected,
        "in_truck_lines": in_truck,
        "completion_pct": round(delivered / assigned * 100, 1) if assigned else 0.0,
    }


def _pending_summary(items: list[dict]) -> dict:
    pending = [item for item in items if item["status"] in PENDING_STATUS_VALUES]
    return {
        "lines": len(pending),
        "units": sum(int(item["remaining_quantity"]) for item in pending),
    }


def _route_payload(route: Route, counts: dict) -> dict:
    return {
        "id": str(route.id),
        "route_date": route.route_date.isoformat(),
        "status": _detail_status(route.status),
        "notes": route.notes,
        "started_at": _iso(route.started_at),
        "completed_at": _iso(route.completed_at),
        "truck": (
            {
                "id": str(route.truck.id),
                "license_plate": route.truck.license_plate,
                "model": route.truck.model,
            }
            if route.truck is not None
            else None
        ),
        "counts": counts,
    }


def recent_scans(
    db: Session,
    company_id: uuid.UUID,
    driver_id: uuid.UUID,
    day: date | None = None,
    limit: int = SCAN_LIMIT,
) -> list[dict]:
    """Scans sent by this driver on `day` (newest first)."""
    start = local_day_start_utc(day or local_today())
    rows = db.execute(
        sa.select(DeliveryLog, Product)
        .join(RouteDetail, DeliveryLog.route_detail_id == RouteDetail.id)
        .join(Product, RouteDetail.product_id == Product.id)
        .where(
            DeliveryLog.company_id == company_id,
            DeliveryLog.driver_id == driver_id,
            DeliveryLog.scan_timestamp_utc >= start,
        )
        .order_by(DeliveryLog.scan_timestamp_utc.desc())
        .limit(limit)
    ).all()

    return [
        {
            "id": str(log.id),
            "action": _detail_status(log.action),
            "product": product.description,
            "barcode": product.barcode_qr,
            "quantity": int(log.quantity),
            "at": iso_utc(log.scan_timestamp_utc),
            "synced_at": iso_utc(log.server_timestamp_utc),
            "offline": bool(log.via_offline_batch),
            "mock_gps": bool(log.is_mocked_location),
            "latitude": log.latitude,
            "longitude": log.longitude,
            "rejection_reason": (
                _detail_status(log.rejection_reason) if log.rejection_reason else None
            ),
            "flags": log.flags or {},
        }
        for log, product in rows
    ]


def driver_today(db: Session, company_id: uuid.UUID, driver: User) -> dict:
    """Today's manifest plus pending routes, scan trail and last position."""
    day = local_today()
    data = build_today_manifest(db, company_id, driver, day=day)

    route = data.get("route")
    items = data.get("items", [])
    if route:
        route["started_at"] = _iso(route.get("started_at"))
        route["completed_at"] = _iso(route.get("completed_at"))
        for item in items:
            item["last_scan_at"] = _iso(item.get("last_scan_at"))
            item["remaining_quantity"] = max(
                item["assigned_quantity"] - item["delivered_quantity"], 0
            )

    data["day"] = day.isoformat()
    data["pending"] = _pending_summary(items)
    data["pending_routes"] = driver_pending_routes(
        db, company_id, driver.id, exclude_route_id=route["id"] if route else None
    )
    data["scans"] = recent_scans(db, company_id, driver.id, day=day)
    data["last_position"] = next(
        (
            {
                "latitude": scan["latitude"],
                "longitude": scan["longitude"],
                "at": scan["at"],
                "action": scan["action"],
            }
            for scan in data["scans"]
            if scan["latitude"] is not None and scan["longitude"] is not None
        ),
        None,
    )
    return data


def driver_pending_routes(
    db: Session,
    company_id: uuid.UUID,
    driver_id: uuid.UUID,
    exclude_route_id: uuid.UUID | None = None,
    limit: int = 10,
) -> list[dict]:
    """Routes of the driver's truck that are still open (pending or on the road)."""
    truck = get_driver_truck(db, company_id, driver_id)
    if truck is None:
        return []

    routes = db.scalars(
        sa.select(Route)
        .options(joinedload(Route.truck))
        .where(
            Route.company_id == company_id,
            Route.truck_id == truck.id,
            Route.status.in_(OPEN_ROUTE_STATUSES),
            Route.route_date >= local_today(),
        )
        .order_by(Route.route_date.asc(), Route.created_at.asc())
        .limit(limit)
    ).all()

    counts_by_route = _counts_bulk(db, [route.id for route in routes])
    return [
        _route_payload(route, counts_by_route.get(route.id) or _counts(db, route.id))
        for route in routes
        if str(route.id) != str(exclude_route_id)
    ]


def driver_history(
    db: Session, company_id: uuid.UUID, driver_id: uuid.UUID, days: int = 14
) -> dict:
    """Routes already worked by the driver's current truck, newest first."""
    today = local_today()
    since = today - timedelta(days=max(1, days) - 1)
    routes = db.scalars(
        sa.select(Route)
        .join(Truck, Route.truck_id == Truck.id)
        .options(joinedload(Route.truck))
        .where(
            Route.company_id == company_id,
            Truck.assigned_driver_id == driver_id,
            Route.route_date >= since,
            Route.route_date <= today,
        )
        .order_by(Route.route_date.desc(), Route.created_at.desc())
    ).all()

    counts_by_route = _counts_bulk(db, [route.id for route in routes])

    payload = []
    total_assigned = total_delivered = 0
    for route in routes:
        counts = counts_by_route.get(route.id) or _counts(db, route.id)
        if counts["assigned_units"]:
            counts["completion_pct"] = round(
                counts["delivered_units"] / counts["assigned_units"] * 100, 1
            )
        total_assigned += counts["assigned_units"]
        total_delivered += counts["delivered_units"]
        payload.append(_route_payload(route, counts))

    truck = get_driver_truck(db, company_id, driver_id)
    return {
        "days": days,
        "since": since.isoformat(),
        "truck": (
            {
                "id": str(truck.id),
                "license_plate": truck.license_plate,
                "model": truck.model,
            }
            if truck is not None
            else None
        ),
        "routes": payload,
        "totals": {
            "routes": len(payload),
            "assigned_units": total_assigned,
            "delivered_units": total_delivered,
            "completion_pct": (
                round(total_delivered / total_assigned * 100, 1) if total_assigned else 0.0
            ),
        },
    }


def driver_route_detail(
    db: Session, company_id: uuid.UUID, driver_id: uuid.UUID, route_id: uuid.UUID
) -> dict | None:
    """One of the driver's routes with its manifest. None if it is not theirs."""
    route = db.scalar(
        sa.select(Route)
        .join(Truck, Route.truck_id == Truck.id)
        .options(joinedload(Route.truck))
        .where(
            Route.id == route_id,
            Route.company_id == company_id,
            Truck.assigned_driver_id == driver_id,
        )
    )
    if route is None:
        return None

    details = db.scalars(
        sa.select(RouteDetail)
        .options(joinedload(RouteDetail.product))
        .where(RouteDetail.route_id == route.id)
        .order_by(RouteDetail.created_at)
    ).all()

    last_scan: dict[uuid.UUID, object] = {}
    detail_ids = [detail.id for detail in details]
    if detail_ids:
        rows = db.execute(
            sa.select(
                DeliveryLog.route_detail_id,
                sa.func.max(DeliveryLog.scan_timestamp_utc),
            )
            .where(DeliveryLog.route_detail_id.in_(detail_ids))
            .group_by(DeliveryLog.route_detail_id)
        ).all()
        last_scan = {row[0]: row[1] for row in rows}

    items = [
        {
            "id": str(detail.id),
            "route_detail_id": str(detail.id),
            "status": _detail_status(detail.status),
            "assigned_quantity": detail.assigned_quantity,
            "delivered_quantity": detail.delivered_quantity,
            "remaining_quantity": _remaining(detail),
            "return_required": detail.return_required,
            "rejection_reason": detail.rejection_reason,
            "last_scan_at": _iso(last_scan.get(detail.id)),
            "product": {
                "id": str(detail.product.id),
                "barcode_qr": detail.product.barcode_qr,
                "description": detail.product.description,
                "unit": _detail_status(detail.product.unit),
                "weight": (
                    float(detail.product.weight) if detail.product.weight is not None else 0.0
                ),
            },
        }
        for detail in details
    ]

    counts = _counts(db, route.id)
    return {
        "route": _route_payload(route, counts),
        "counts": counts,
        "pending": _pending_summary(items),
        "items": items,
    }
