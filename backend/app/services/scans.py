"""Scan processing: live scans and atomic offline batch synchronization.

Business rules (driver flow):
  LOAD     confirm the item boarded the truck (route auto-starts)
  DELIVER  hand the item to the client -> DELIVERED
  REJECT   failed delivery -> REJECTED + return_required (inventory re-entry)

Anti-fraud:
  * mock GPS locations are hard-rejected and audited
  * device clock ahead of the server -> flagged TIMESTAMP_SKEW
  * scans older than MAX_OFFLINE_AGE_DAYS -> flagged STALE_SCAN
  * impossible travel between two scans of the same driver -> SPEED_ANOMALY
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.geo import ensure_utc, haversine_m, implied_speed_kmh, iso_utc, local_today, utcnow
from app.models.company import Company
from app.models.delivery import DeliveryLog, SyncBatch
from app.models.enums import (
    DetailStatus,
    RejectionReasonCode,
    RouteStatus,
    ScanAction,
    SecurityEventType,
)
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.truck import Truck
from app.models.user import User
from app.services.audit import PendingSecurityEvent, persist_security_events

TERMINAL_DETAIL_STATUSES = (DetailStatus.DELIVERED, DetailStatus.REJECTED)


class ScanError(Exception):
    """Validation failure for a single scan (recoverable, logged per item)."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        security_events: list[PendingSecurityEvent] | None = None,
        detail: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.security_events = security_events or []
        self.detail = detail or {}


@dataclass
class ScanOutcome:
    scan_uuid: str
    result: str  # "ACCEPTED" | "DUPLICATE"
    action: ScanAction
    detail_status: DetailStatus
    route_id: uuid.UUID
    route_detail_id: uuid.UUID
    product_barcode: str
    product_description: str
    message: str
    route_completed: bool = False
    flags: dict = field(default_factory=dict)
    security_events: list[PendingSecurityEvent] = field(default_factory=list)


# ------------------------------------------------------------------ routing --
def resolve_driver_route(
    db: Session,
    company_id: uuid.UUID,
    driver: User,
    route_id: uuid.UUID | None = None,
) -> Route:
    """The route a driver is operating right now (today's, for their truck)."""
    if route_id is not None:
        route = db.scalar(
            sa.select(Route).where(Route.id == route_id, Route.company_id == company_id)
        )
        if route is None:
            raise ScanError(404, "ROUTE_NOT_FOUND", "La ruta indicada no existe.")
        truck = db.get(Truck, route.truck_id)
        if truck is None or truck.assigned_driver_id != driver.id:
            raise ScanError(403, "NOT_YOUR_ROUTE", "La ruta no está asignada a este conductor.")
        return route

    truck = db.scalar(
        sa.select(Truck).where(
            Truck.company_id == company_id,
            Truck.assigned_driver_id == driver.id,
            Truck.is_active.is_(True),
        )
    )
    if truck is None:
        raise ScanError(409, "NO_TRUCK_ASSIGNED", "No tiene un camión asignado. Contacte a su central.")

    route = db.scalar(
        sa.select(Route).where(
            Route.company_id == company_id,
            Route.truck_id == truck.id,
            Route.route_date == local_today(),
        )
    )
    if route is None:
        raise ScanError(409, "NO_ROUTE_TODAY", "No tiene ruta asignada para hoy.")
    return route


# ------------------------------------------------------------------- scanning --
def process_scan(
    db: Session,
    *,
    company: Company,
    driver: User,
    device_uuid: str,
    payload,  # app.schemas.mobile.ScanRequest (avoid hard import cycle)
    via_offline_batch: bool = False,
    sync_batch_id: uuid.UUID | None = None,
) -> ScanOutcome:
    """Validate and apply one scan event inside the caller's transaction."""
    settings = get_settings()
    db.flush()  # make prior in-transaction writes visible to our queries

    # --- idempotency: same scan_uuid already processed -----------------------
    existing = db.scalar(
        sa.select(DeliveryLog).where(DeliveryLog.scan_uuid == payload.scan_uuid)
    )
    if existing is not None:
        if existing.company_id != company.id:
            raise ScanError(409, "SCAN_UUID_CONFLICT", "Conflicto de identificador de escaneo.")
        detail = db.get(RouteDetail, existing.route_detail_id)
        product = db.get(Product, detail.product_id) if detail else None
        return ScanOutcome(
            scan_uuid=payload.scan_uuid,
            result="DUPLICATE",
            action=existing.action,
            detail_status=detail.status if detail else DetailStatus.IN_TRUCK,
            route_id=detail.route_id if detail else uuid.uuid4(),
            route_detail_id=existing.route_detail_id,
            product_barcode=product.barcode_qr if product else payload.qr_code,
            product_description=product.description if product else "",
            message="Escaneo ya sincronizado previamente (idempotente).",
        )

    now = utcnow()
    flags: dict = {}
    events: list[PendingSecurityEvent] = []

    # --- anti-fraud: mock location ------------------------------------------
    if payload.is_mocked_location:
        events.append(
            PendingSecurityEvent(
                event_type=SecurityEventType.MOCK_GPS,
                user_id=driver.id,
                device_uuid=device_uuid,
                latitude=payload.latitude,
                longitude=payload.longitude,
                detail={"qr_code": payload.qr_code, "scan_uuid": payload.scan_uuid},
            )
        )
        raise ScanError(
            422,
            "MOCK_LOCATION_DETECTED",
            "Ubicación GPS falsa detectada. Desactive las apps de ubicación simulada.",
            security_events=events,
        )

    # --- timestamp sanity ----------------------------------------------------
    scan_ts = ensure_utc(payload.scan_timestamp_utc)
    future_tolerance_min = settings.max_timestamp_future_minutes
    skew_seconds = (scan_ts - now).total_seconds()
    if skew_seconds > future_tolerance_min * 60:
        flags["timestamp_future_minutes"] = round(skew_seconds / 60, 1)
        events.append(
            PendingSecurityEvent(
                event_type=SecurityEventType.TIMESTAMP_SKEW,
                user_id=driver.id,
                device_uuid=device_uuid,
                detail={"device_utc": iso_utc(scan_ts), "server_utc": iso_utc(now)},
            )
        )
    stale_limit_days = settings.max_offline_age_days
    if (now - scan_ts).total_seconds() > stale_limit_days * 86400:
        flags["stale_days"] = round((now - scan_ts).total_seconds() / 86400, 1)
        events.append(
            PendingSecurityEvent(
                event_type=SecurityEventType.STALE_SCAN,
                user_id=driver.id,
                device_uuid=device_uuid,
                detail={"device_utc": iso_utc(scan_ts), "server_utc": iso_utc(now)},
            )
        )

    # --- resolution ------------------------------------------------------------
    route = resolve_driver_route(db, company.id, driver, payload.route_id)
    if route.status == RouteStatus.COMPLETED:
        raise ScanError(409, "ROUTE_COMPLETED", "La ruta de hoy ya fue completada.")

    barcode = (payload.qr_code or "").strip()
    product = db.scalar(
        sa.select(Product).where(
            Product.company_id == company.id,
            Product.barcode_qr == barcode,
            Product.is_active.is_(True),
        )
    )
    if product is None:
        raise ScanError(404, "ITEM_NOT_FOUND", "Código no pertenece al catálogo de la empresa.")

    detail = db.scalar(
        sa.select(RouteDetail).where(
            RouteDetail.route_id == route.id, RouteDetail.product_id == product.id
        )
    )
    if detail is None:
        events.append(
            PendingSecurityEvent(
                event_type=SecurityEventType.MANIFEST_MISMATCH,
                user_id=driver.id,
                device_uuid=device_uuid,
                latitude=payload.latitude,
                longitude=payload.longitude,
                detail={"barcode": barcode, "route_id": str(route.id)},
            )
        )
        raise ScanError(
            409,
            "ITEM_NOT_IN_MANIFEST",
            "El producto no pertenece a su ruta asignada.",
            security_events=events,
        )

    # --- state machine ----------------------------------------------------------
    action: ScanAction = ScanAction(payload.action)
    if action == ScanAction.LOAD:
        if detail.status in TERMINAL_DETAIL_STATUSES:
            raise ScanError(
                409,
                "ITEM_ALREADY_FINALIZED",
                "El ítem ya fue entregado o rechazado.",
                security_events=events,
            )
    elif action == ScanAction.DELIVER:
        if detail.status == DetailStatus.DELIVERED:
            events.append(
                PendingSecurityEvent(
                    event_type=SecurityEventType.DUPLICATE_SCAN,
                    user_id=driver.id,
                    device_uuid=device_uuid,
                    detail={"barcode": barcode, "route_detail_id": str(detail.id)},
                )
            )
            raise ScanError(
                409, "ALREADY_DELIVERED", "Este ítem ya fue marcado como entregado.",
                security_events=events,
            )
        if detail.status == DetailStatus.REJECTED:
            raise ScanError(
                409, "ITEM_REJECTED", "El ítem fue rechazado; devuélvalo a la central."
            )
    else:  # REJECT
        if payload.rejection_reason is None:
            raise ScanError(
                422, "REJECTION_REASON_REQUIRED", "Debe indicar el motivo del rechazo."
            )
        if detail.status == DetailStatus.DELIVERED:
            raise ScanError(409, "ALREADY_DELIVERED", "Ítem ya entregado; no puede rechazarse.")
        if detail.status == DetailStatus.REJECTED:
            raise ScanError(409, "ITEM_ALREADY_REJECTED", "El ítem ya fue rechazado.")

    # --- teleport heuristic ------------------------------------------------------
    previous = db.scalar(
        sa.select(DeliveryLog)
        .where(DeliveryLog.driver_id == driver.id)
        .order_by(DeliveryLog.scan_timestamp_utc.desc())
        .limit(1)
    )
    if previous is not None:
        delta_s = (scan_ts - ensure_utc(previous.scan_timestamp_utc)).total_seconds()
        if delta_s > 0:
            distance_m = haversine_m(
                previous.latitude, previous.longitude, payload.latitude, payload.longitude
            )
            speed = implied_speed_kmh(distance_m, delta_s)
            if speed > settings.max_implied_speed_kmh:
                flags["implied_speed_kmh"] = round(speed, 1)
                events.append(
                    PendingSecurityEvent(
                        event_type=SecurityEventType.SPEED_ANOMALY,
                        user_id=driver.id,
                        device_uuid=device_uuid,
                        latitude=payload.latitude,
                        longitude=payload.longitude,
                        detail={
                            "implied_speed_kmh": round(speed, 1),
                            "distance_m": round(distance_m, 1),
                            "delta_seconds": round(delta_s, 1),
                        },
                    )
                )

    if payload.gps_accuracy_m is not None:
        flags["gps_accuracy_m"] = payload.gps_accuracy_m

    # --- apply mutations -----------------------------------------------------------
    if route.status == RouteStatus.PENDING:
        route.status = RouteStatus.IN_PROGRESS
        route.started_at = route.started_at or scan_ts

    if action == ScanAction.LOAD:
        pass  # manifest line stays IN_TRUCK (no state change)
    elif action == ScanAction.DELIVER:
        detail.delivered_quantity = min(
            detail.delivered_quantity + 1, detail.assigned_quantity
        )
        if detail.delivered_quantity >= detail.assigned_quantity:
            detail.status = DetailStatus.DELIVERED
    else:  # REJECT
        detail.status = DetailStatus.REJECTED
        detail.return_required = True
        detail.rejection_reason = payload.rejection_reason.value

    log = DeliveryLog(
        company_id=company.id,
        route_detail_id=detail.id,
        driver_id=driver.id,
        scan_uuid=payload.scan_uuid,
        action=action,
        quantity=1,
        scan_timestamp_utc=scan_ts,
        server_timestamp_utc=now,
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_accuracy_m=payload.gps_accuracy_m,
        device_uuid=device_uuid,
        is_mocked_location=bool(payload.is_mocked_location),
        synced_with_server=True,
        via_offline_batch=via_offline_batch,
        flags=flags or None,
        pod_signature_url=payload.pod_signature_url,
        pod_photo_url=payload.pod_photo_url,
        rejection_reason=payload.rejection_reason,
        rejection_notes=payload.rejection_notes,
        sync_batch_id=sync_batch_id,
    )
    db.add(log)
    db.flush()

    # --- route completion -----------------------------------------------------------
    route_completed = False
    open_details = db.scalar(
        sa.select(sa.func.count())
        .select_from(RouteDetail)
        .where(
            RouteDetail.route_id == route.id,
            RouteDetail.status.not_in([s.value for s in TERMINAL_DETAIL_STATUSES]),
        )
    )
    if int(open_details or 0) == 0:
        route.status = RouteStatus.COMPLETED
        route.completed_at = now
        route_completed = True

    return ScanOutcome(
        scan_uuid=payload.scan_uuid,
        result="ACCEPTED",
        action=action,
        detail_status=detail.status,
        route_id=route.id,
        route_detail_id=detail.id,
        product_barcode=product.barcode_qr,
        product_description=product.description,
        message="Escaneo registrado.",
        route_completed=route_completed,
        flags=flags,
        security_events=events,
    )


# --------------------------------------------------------------- batch sync ----
@dataclass
class BatchItemResult:
    scan_uuid: str
    qr_code: str
    accepted: bool
    duplicate: bool
    code: str | None
    message: str
    product_description: str | None = None
    detail_status: str | None = None
    route_completed: bool = False


def process_scan_batch(
    db: Session,
    *,
    company: Company,
    driver: User,
    device_uuid: str,
    items: list,
    batch_reference: str | None = None,
) -> tuple[SyncBatch, list[BatchItemResult]]:
    """Flush an offline queue atomically.

    The whole batch commits in ONE transaction; each item runs in a SAVEPOINT
    so a single invalid scan cannot poison the rest, yet nothing is visible
    unless the full batch commits. Idempotency via scan_uuid makes retries safe.
    """
    batch = SyncBatch(
        company_id=company.id,
        user_id=driver.id,
        device_uuid=device_uuid,
        received_count=len(items),
        accepted_count=0,
        rejected_count=0,
        duplicate_count=0,
    )
    db.add(batch)
    db.flush()

    results: list[BatchItemResult] = []
    seen_in_batch: set[str] = set()

    for item in items:
        if item.scan_uuid in seen_in_batch:
            batch.duplicate_count += 1
            results.append(
                BatchItemResult(
                    scan_uuid=item.scan_uuid,
                    qr_code=item.qr_code,
                    accepted=True,
                    duplicate=True,
                    code="DUPLICATE_IN_BATCH",
                    message="Ítem duplicado dentro del mismo lote.",
                )
            )
            continue
        seen_in_batch.add(item.scan_uuid)

        try:
            with db.begin_nested():  # SAVEPOINT per item
                outcome = process_scan(
                    db,
                    company=company,
                    driver=driver,
                    device_uuid=device_uuid,
                    payload=item,
                    via_offline_batch=True,
                    sync_batch_id=batch.id,
                )
        except ScanError as exc:
            batch.rejected_count += 1
            persist_security_events(db, company.id, exc.security_events)
            results.append(
                BatchItemResult(
                    scan_uuid=item.scan_uuid,
                    qr_code=item.qr_code,
                    accepted=False,
                    duplicate=False,
                    code=exc.code,
                    message=exc.message,
                )
            )
            continue
        except sa.exc.IntegrityError:
            # Unique violation on scan_uuid raced with another device -> idempotent.
            batch.duplicate_count += 1
            results.append(
                BatchItemResult(
                    scan_uuid=item.scan_uuid,
                    qr_code=item.qr_code,
                    accepted=True,
                    duplicate=True,
                    code="ALREADY_SYNCED",
                    message="Escaneo ya sincronizado previamente.",
                )
            )
            continue

        if outcome.result == "DUPLICATE":
            batch.duplicate_count += 1
        else:
            batch.accepted_count += 1

        persist_security_events(db, company.id, outcome.security_events)
        results.append(
            BatchItemResult(
                scan_uuid=item.scan_uuid,
                qr_code=item.qr_code,
                accepted=True,
                duplicate=outcome.result == "DUPLICATE",
                code=None if outcome.result == "ACCEPTED" else "ALREADY_SYNCED",
                message=outcome.message,
                product_description=outcome.product_description,
                detail_status=outcome.detail_status.value,
                route_completed=outcome.route_completed,
            )
        )

    db.flush()
    return batch, results
