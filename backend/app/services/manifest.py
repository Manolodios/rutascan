"""Builds the driver's manifest payload (today's route + per-item status)."""

from __future__ import annotations

import uuid
from datetime import date

import sqlalchemy as sa
from sqlalchemy.orm import Session, joinedload

from app.models.delivery import DeliveryLog
from app.models.enums import DetailStatus, RouteStatus
from app.models.route import Route, RouteDetail
from app.models.truck import Truck
from app.models.user import User


def get_driver_truck(db: Session, company_id: uuid.UUID, driver_id: uuid.UUID) -> Truck | None:
    return db.scalar(
        sa.select(Truck).where(
            Truck.company_id == company_id,
            Truck.assigned_driver_id == driver_id,
            Truck.is_active.is_(True),
        )
    )


def get_driver_route(
    db: Session, company_id: uuid.UUID, driver_id: uuid.UUID, day: date | None = None
) -> Route | None:
    day = day or date.today()
    truck = get_driver_truck(db, company_id, driver_id)
    if truck is None:
        return None
    return db.scalar(
        sa.select(Route)
        .options(joinedload(Route.truck))
        .where(
            Route.company_id == company_id,
            Route.truck_id == truck.id,
            Route.route_date == day,
        )
    )


def build_today_manifest(
    db: Session, company_id: uuid.UUID, driver: User, day: date | None = None
) -> dict:
    day = day or date.today()
    route = get_driver_route(db, company_id, driver.id, day)

    if route is None:
        truck = get_driver_truck(db, company_id, driver.id)
        return {
            "route": None,
            "counts": {
                "lines": 0,
                "assigned_units": 0,
                "delivered_units": 0,
                "rejected_lines": 0,
                "in_truck_lines": 0,
                "completion_pct": 0.0,
            },
            "items": [],
            "truck": (
                {
                    "id": str(truck.id),
                    "license_plate": truck.license_plate,
                    "model": truck.model,
                }
                if truck
                else None
            ),
            "message": "No tiene ruta asignada para hoy.",
        }

    details = db.scalars(
        sa.select(RouteDetail)
        .options(joinedload(RouteDetail.product))
        .where(RouteDetail.route_id == route.id)
        .order_by(RouteDetail.created_at)
    ).all()

    detail_ids = [d.id for d in details]
    last_scan: dict[uuid.UUID, object] = {}
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

    items = []
    assigned_units = delivered_units = rejected_lines = in_truck_lines = 0
    for d in details:
        assigned_units += d.assigned_quantity
        delivered_units += d.delivered_quantity
        if d.status == DetailStatus.REJECTED:
            rejected_lines += 1
        elif d.status == DetailStatus.IN_TRUCK:
            in_truck_lines += 1
        items.append(
            {
                "route_detail_id": str(d.id),
                "status": d.status.value,
                "assigned_quantity": d.assigned_quantity,
                "delivered_quantity": d.delivered_quantity,
                "return_required": d.return_required,
                "rejection_reason": d.rejection_reason,
                "last_scan_at": last_scan.get(d.id),
                "product": {
                    "id": str(d.product.id),
                    "barcode_qr": d.product.barcode_qr,
                    "description": d.product.description,
                    "unit": d.product.unit,
                    "weight": float(d.product.weight) if d.product.weight is not None else 0.0,
                },
            }
        )

    completion = (delivered_units / assigned_units * 100.0) if assigned_units else 0.0
    return {
        "route": {
            "id": str(route.id),
            "route_date": route.route_date.isoformat(),
            "status": route.status.value,
            "started_at": route.started_at,
            "completed_at": route.completed_at,
            "notes": route.notes,
            "truck": {
                "id": str(route.truck.id),
                "license_plate": route.truck.license_plate,
                "model": route.truck.model,
            },
        },
        "counts": {
            "lines": len(items),
            "assigned_units": assigned_units,
            "delivered_units": delivered_units,
            "rejected_lines": rejected_lines,
            "in_truck_lines": in_truck_lines,
            "completion_pct": round(completion, 1),
        },
        "items": items,
        "truck": None,
        "message": None,
    }
