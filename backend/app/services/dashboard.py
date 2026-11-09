"""Dashboard analytics: KPIs, live map and activity feed."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import sqlalchemy as sa
from sqlalchemy.orm import Session, joinedload

from app.core.geo import ensure_utc, local_today, utcnow
from app.models.company import Company
from app.models.delivery import DeliveryLog
from app.models.enums import DetailStatus, Role, RouteStatus
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.security_event import SecurityEvent
from app.models.truck import Truck
from app.models.user import User


def _route_ids_for_day(db: Session, company_id: uuid.UUID, day: date) -> list[uuid.UUID]:
    return list(
        db.scalars(
            sa.select(Route.id).where(
                Route.company_id == company_id, Route.route_date == day
            )
        ).all()
    )


def dashboard_summary(db: Session, company: Company, day: date | None = None) -> dict:
    day = day or local_today()
    company_id = company.id

    route_rows = db.execute(
        sa.select(Route.status, sa.func.count())
        .where(Route.company_id == company_id, Route.route_date == day)
        .group_by(Route.status)
    ).all()
    routes_by_status = {status.value: int(count) for status, count in route_rows}
    routes_total = sum(routes_by_status.values())

    route_ids = _route_ids_for_day(db, company_id, day)
    delivery_stats = {"assigned": 0, "delivered": 0, "rejected": 0, "in_truck": 0, "returns_pending": 0}
    if route_ids:
        rows = db.execute(
            sa.select(
                sa.func.coalesce(sa.func.sum(RouteDetail.assigned_quantity), 0),
                sa.func.coalesce(sa.func.sum(RouteDetail.delivered_quantity), 0),
                RouteDetail.status,
                sa.func.count(),
                sa.func.coalesce(sa.func.sum(sa.case((RouteDetail.return_required.is_(True), 1), else_=0)), 0),
            )
            .where(RouteDetail.route_id.in_(route_ids))
            .group_by(RouteDetail.status)
        ).all()
        for assigned, delivered, status, count, returns in rows:
            delivery_stats["assigned"] += int(assigned or 0)
            delivery_stats["delivered"] += int(delivered or 0)
            if status == DetailStatus.REJECTED:
                delivery_stats["rejected"] += int(count or 0)
                delivery_stats["returns_pending"] += int(returns or 0)
            elif status == DetailStatus.IN_TRUCK:
                delivery_stats["in_truck"] += int(count or 0)

    completion = (
        delivery_stats["delivered"] / delivery_stats["assigned"] * 100
        if delivery_stats["assigned"]
        else 0.0
    )

    trucks_total = int(
        db.scalar(
            sa.select(sa.func.count()).select_from(Truck).where(
                Truck.company_id == company_id, Truck.is_active.is_(True)
            )
        )
        or 0
    )
    active_trucks = routes_by_status.get(RouteStatus.IN_PROGRESS.value, 0)

    # First-run checklist: real counts so the panel can hide each completed step.
    products_total = int(
        db.scalar(
            sa.select(sa.func.count()).select_from(Product).where(
                Product.company_id == company_id, Product.is_active.is_(True)
            )
        )
        or 0
    )
    team_total = int(
        db.scalar(
            sa.select(sa.func.count()).select_from(User).where(
                User.company_id == company_id,
                User.is_active.is_(True),
                User.role != Role.ADMIN,
            )
        )
        or 0
    )
    routes_ever = int(
        db.scalar(
            sa.select(sa.func.count()).select_from(Route).where(
                Route.company_id == company_id
            )
        )
        or 0
    )
    setup_counts = {
        "trucks": trucks_total,
        "products": products_total,
        "team": team_total,
        "routes": routes_ever,
    }

    since = utcnow() - timedelta(hours=24)
    security_rows = db.execute(
        sa.select(SecurityEvent.event_type, sa.func.count())
        .where(SecurityEvent.company_id == company_id, SecurityEvent.created_at >= since)
        .group_by(SecurityEvent.event_type)
    ).all()
    alerts_by_type = {etype.value: int(count) for etype, count in security_rows}

    return {
        "date": day.isoformat(),
        "routes": {
            "total": routes_total,
            "pending": routes_by_status.get(RouteStatus.PENDING.value, 0),
            "in_progress": routes_by_status.get(RouteStatus.IN_PROGRESS.value, 0),
            "completed": routes_by_status.get(RouteStatus.COMPLETED.value, 0),
        },
        "trucks": {"total": trucks_total, "active_on_route": active_trucks},
        "deliveries": {**delivery_stats, "completion_pct": round(completion, 1)},
        "alerts": {
            "security_events_24h": sum(alerts_by_type.values()),
            "by_type": alerts_by_type,
        },
        "setup": {
            **setup_counts,
            "complete": all(value > 0 for value in setup_counts.values()),
        },
        "weekly": weekly_stats(db, company_id, days=7),
        "recent_activity": recent_activity(db, company_id, limit=12),
    }


def weekly_stats(db: Session, company_id: uuid.UUID, days: int = 7) -> list[dict]:
    since = utcnow() - timedelta(days=days - 1)
    rows = db.execute(
        sa.select(
            sa.func.date(DeliveryLog.server_timestamp_utc).label("day"),
            DeliveryLog.action,
            sa.func.count(),
        )
        .where(
            DeliveryLog.company_id == company_id,
            DeliveryLog.server_timestamp_utc >= since,
        )
        .group_by("day", DeliveryLog.action)
    ).all()
    buckets: dict[str, dict] = {}
    for offset in range(days - 1, -1, -1):
        d = (utcnow() - timedelta(days=offset)).date().isoformat()
        buckets[d] = {"date": d, "DELIVER": 0, "REJECT": 0, "LOAD": 0}
    for day_value, action, count in rows:
        key = day_value.isoformat() if hasattr(day_value, "isoformat") else str(day_value)
        if key in buckets:
            buckets[key][action.value] = int(count)
    return list(buckets.values())


def recent_activity(db: Session, company_id: uuid.UUID, limit: int = 15) -> list[dict]:
    stmt = (
        sa.select(DeliveryLog, Product, User)
        .join(RouteDetail, DeliveryLog.route_detail_id == RouteDetail.id)
        .join(Product, RouteDetail.product_id == Product.id)
        .join(User, DeliveryLog.driver_id == User.id)
        .where(DeliveryLog.company_id == company_id)
        .order_by(DeliveryLog.server_timestamp_utc.desc())
        .limit(limit)
    )
    activity = []
    for log, product, driver in db.execute(stmt).all():
        activity.append(
            {
                "id": str(log.id),
                "action": log.action.value,
                "product": product.description,
                "barcode": product.barcode_qr,
                "driver": driver.full_name,
                "at": log.server_timestamp_utc,
                "scan_at": log.scan_timestamp_utc,
                "offline": log.via_offline_batch,
                "flags": log.flags or {},
                "latitude": log.latitude,
                "longitude": log.longitude,
                "rejection_reason": log.rejection_reason.value if log.rejection_reason else None,
            }
        )
    return activity


def live_map(db: Session, company_id: uuid.UUID, day: date | None = None) -> dict:
    day = day or local_today()
    routes = db.scalars(
        sa.select(Route)
        .options(joinedload(Route.truck).joinedload(Truck.assigned_driver))
        .where(Route.company_id == company_id, Route.route_date == day)
        .order_by(Route.created_at)
    ).all()

    trucks: list[dict] = []
    for route in routes:
        detail_rows = db.execute(
            sa.select(RouteDetail.status, sa.func.count())
            .where(RouteDetail.route_id == route.id)
            .group_by(RouteDetail.status)
        ).all()
        counts = {status.value: int(count) for status, count in detail_rows}
        units = db.execute(
            sa.select(
                sa.func.coalesce(sa.func.sum(RouteDetail.assigned_quantity), 0),
                sa.func.coalesce(sa.func.sum(RouteDetail.delivered_quantity), 0),
            ).where(RouteDetail.route_id == route.id)
        ).one()
        assigned, delivered = int(units[0] or 0), int(units[1] or 0)

        last_log = db.scalar(
            sa.select(DeliveryLog)
            .join(RouteDetail, DeliveryLog.route_detail_id == RouteDetail.id)
            .where(RouteDetail.route_id == route.id)
            .order_by(DeliveryLog.server_timestamp_utc.desc())
            .limit(1)
        )
        last_position = None
        if last_log is not None:
            age_min = round(
                (utcnow() - ensure_utc(last_log.server_timestamp_utc)).total_seconds() / 60, 1
            )
            last_position = {
                "latitude": last_log.latitude,
                "longitude": last_log.longitude,
                "at": last_log.server_timestamp_utc,
                "action": last_log.action.value,
                "minutes_ago": age_min,
                "mock_gps": last_log.is_mocked_location,
            }

        trucks.append(
            {
                "route_id": str(route.id),
                "route_status": route.status.value,
                "truck": {
                    "id": str(route.truck.id) if route.truck else None,
                    "license_plate": route.truck.license_plate if route.truck else "—",
                    "model": route.truck.model if route.truck else None,
                },
                "driver": (
                    {
                        "id": str(route.truck.assigned_driver.id),
                        "full_name": route.truck.assigned_driver.full_name,
                    }
                    if route.truck and route.truck.assigned_driver
                    else None
                ),
                "counts": {
                    "in_truck": counts.get(DetailStatus.IN_TRUCK.value, 0),
                    "delivered": counts.get(DetailStatus.DELIVERED.value, 0),
                    "rejected": counts.get(DetailStatus.REJECTED.value, 0),
                },
                "assigned_units": assigned,
                "delivered_units": delivered,
                "completion_pct": round(delivered / assigned * 100, 1) if assigned else 0.0,
                "last_position": last_position,
            }
        )
    return {"date": day.isoformat(), "trucks": trucks}
