"""Route assignment module: create routes, bulk-load manifests, dispatch."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_staff
from app.core.geo import utcnow
from app.db.session import get_db
from app.models.delivery import DeliveryLog
from app.models.enums import DetailStatus, Role, RouteStatus
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.truck import Truck
from app.models.user import User
from app.schemas.admin import (
    BulkAssignRequest,
    ImportResult,
    RouteCounts,
    RouteCreate,
    RouteDetailItem,
    RouteFullOut,
    RouteOut,
    TruckBrief,
    UserBrief,
)
from app.schemas.common import Message

router = APIRouter(prefix="/routes", tags=["admin:routes"])


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


def _get_tenant_route(db: Session, company_id: uuid.UUID, route_id: uuid.UUID) -> Route:
    route = db.scalar(
        sa.select(Route)
        .options(joinedload(Route.truck).joinedload(Truck.assigned_driver))
        .where(Route.id == route_id, Route.company_id == company_id)
    )
    if route is None:
        raise _error(404, "Ruta no encontrada.", "ROUTE_NOT_FOUND")
    return route


def _route_counts(db: Session, route_id: uuid.UUID) -> RouteCounts:
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
    counts = RouteCounts()
    for status, lines, assigned, delivered in rows:
        counts.lines += int(lines)
        counts.assigned_units += int(assigned)
        counts.delivered_units += int(delivered)
        if status == DetailStatus.REJECTED:
            counts.rejected_lines += int(lines)
        elif status == DetailStatus.IN_TRUCK:
            counts.in_truck_lines += int(lines)
    counts.completion_pct = (
        round(counts.delivered_units / counts.assigned_units * 100, 1)
        if counts.assigned_units
        else 0.0
    )
    return counts


def _route_out(route: Route, counts: RouteCounts) -> RouteOut:
    truck = route.truck
    driver = truck.assigned_driver if truck else None
    return RouteOut(
        id=route.id,
        route_date=route.route_date,
        status=route.status,
        notes=route.notes,
        started_at=route.started_at,
        completed_at=route.completed_at,
        created_at=route.created_at,
        truck=(
            TruckBrief(
                id=truck.id, license_plate=truck.license_plate, model=truck.model, is_active=truck.is_active
            )
            if truck
            else None
        ),
        driver=(
            UserBrief(
                id=driver.id, user_cedula=driver.user_cedula, full_name=driver.full_name, role=driver.role
            )
            if driver
            else None
        ),
        counts=counts,
    )


# ------------------------------------------------------------------- listing --
@router.get("", response_model=list[RouteOut])
def list_routes(
    day: date | None = Query(default=None, description="Por defecto: hoy"),
    status: RouteStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> list[RouteOut]:
    stmt = (
        sa.select(Route)
        .options(joinedload(Route.truck).joinedload(Truck.assigned_driver))
        .where(Route.company_id == user.company_id, Route.route_date == (day or date.today()))
        .order_by(Route.created_at)
    )
    if status is not None:
        stmt = stmt.where(Route.status == status)
    routes = db.scalars(stmt).all()
    return [_route_out(r, _route_counts(db, r.id)) for r in routes]


@router.post("", response_model=RouteOut, status_code=201)
def create_route(
    payload: RouteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> RouteOut:
    truck = db.scalar(
        sa.select(Truck)
        .options(joinedload(Truck.assigned_driver))
        .where(Truck.id == payload.truck_id, Truck.company_id == user.company_id)
    )
    if truck is None:
        raise _error(404, "Camión no encontrado.", "TRUCK_NOT_FOUND")
    if not truck.is_active:
        raise _error(422, "El camión está desactivado.", "TRUCK_INACTIVE")

    if payload.driver_id is not None:
        driver = db.scalar(
            sa.select(User).where(
                User.id == payload.driver_id,
                User.company_id == user.company_id,
                User.role == Role.DRIVER,
                User.is_active.is_(True),
            )
        )
        if driver is None:
            raise _error(422, "Conductor inválido.", "INVALID_DRIVER")
        truck.assigned_driver_id = driver.id

    existing = db.scalar(
        sa.select(Route).where(
            Route.company_id == user.company_id,
            Route.truck_id == truck.id,
            Route.route_date == payload.route_date,
        )
    )
    if existing is not None:
        raise _error(
            409,
            f"El camión {truck.license_plate} ya tiene ruta el {payload.route_date.isoformat()}.",
            "ROUTE_EXISTS",
        )

    route = Route(
        company_id=user.company_id,
        truck_id=truck.id,
        route_date=payload.route_date,
        notes=(payload.notes or "").strip() or None,
        created_by_id=user.id,
    )
    db.add(route)
    db.commit()
    route = _get_tenant_route(db, user.company_id, route.id)
    return _route_out(route, _route_counts(db, route.id))


@router.get("/{route_id}", response_model=RouteFullOut)
def get_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> RouteFullOut:
    route = _get_tenant_route(db, user.company_id, route_id)
    counts = _route_counts(db, route.id)

    details = db.scalars(
        sa.select(RouteDetail)
        .options(joinedload(RouteDetail.product))
        .where(RouteDetail.route_id == route.id)
        .order_by(RouteDetail.created_at)
    ).all()

    last_scan: dict[uuid.UUID, object] = {}
    if details:
        rows = db.execute(
            sa.select(
                DeliveryLog.route_detail_id,
                sa.func.max(DeliveryLog.scan_timestamp_utc),
            )
            .where(DeliveryLog.route_detail_id.in_([d.id for d in details]))
            .group_by(DeliveryLog.route_detail_id)
        ).all()
        last_scan = {row[0]: row[1] for row in rows}

    base = _route_out(route, counts)
    return RouteFullOut(
        **base.model_dump(),
        details=[
            RouteDetailItem(
                id=d.id,
                product={
                    "id": d.product.id,
                    "barcode_qr": d.product.barcode_qr,
                    "description": d.product.description,
                    "unit": d.product.unit,
                    "weight": float(d.product.weight or 0),
                },
                status=d.status,
                assigned_quantity=d.assigned_quantity,
                delivered_quantity=d.delivered_quantity,
                return_required=d.return_required,
                rejection_reason=d.rejection_reason,
                last_scan_at=last_scan.get(d.id),
            )
            for d in details
        ],
    )


@router.delete("/{route_id}", response_model=Message)
def delete_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Message:
    route = _get_tenant_route(db, user.company_id, route_id)
    if route.status != RouteStatus.PENDING:
        raise _error(409, "Solo se pueden eliminar rutas PENDING.", "ROUTE_LOCKED")
    db.delete(route)
    db.commit()
    return Message(detail="Ruta eliminada.")


# ----------------------------------------------------------- manifest loading --
@router.post("/{route_id}/details", response_model=list[RouteDetailItem])
def bulk_assign(
    route_id: uuid.UUID,
    payload: BulkAssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> list[RouteDetailItem]:
    route = _get_tenant_route(db, user.company_id, route_id)
    if route.status != RouteStatus.PENDING:
        raise _error(409, "El manifiesto solo puede editarse mientras la ruta está PENDING.", "ROUTE_LOCKED")

    product_ids = [item.product_id for item in payload.items]
    products = {
        p.id: p
        for p in db.scalars(
            sa.select(Product).where(
                Product.company_id == user.company_id, Product.id.in_(product_ids)
            )
        ).all()
    }
    missing = [str(pid) for pid in product_ids if pid not in products]
    if missing:
        raise _error(422, f"Productos no encontrados: {', '.join(missing[:5])}", "PRODUCT_NOT_FOUND")

    existing = {
        d.product_id: d
        for d in db.scalars(
            sa.select(RouteDetail).where(
                RouteDetail.route_id == route.id, RouteDetail.product_id.in_(product_ids)
            )
        ).all()
    }
    for item in payload.items:
        detail = existing.get(item.product_id)
        if detail is None:
            db.add(
                RouteDetail(
                    company_id=user.company_id,
                    route_id=route.id,
                    product_id=item.product_id,
                    assigned_quantity=item.assigned_quantity,
                )
            )
        else:
            detail.assigned_quantity = item.assigned_quantity
    db.commit()
    return get_route(route_id, db, user).details


@router.delete("/{route_id}/details/{detail_id}", response_model=Message)
def remove_detail(
    route_id: uuid.UUID,
    detail_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Message:
    route = _get_tenant_route(db, user.company_id, route_id)
    if route.status != RouteStatus.PENDING:
        raise _error(409, "El manifiesto solo puede editarse mientras la ruta está PENDING.", "ROUTE_LOCKED")
    detail = db.scalar(
        sa.select(RouteDetail).where(
            RouteDetail.id == detail_id,
            RouteDetail.route_id == route.id,
            RouteDetail.company_id == user.company_id,
        )
    )
    if detail is None:
        raise _error(404, "Ítem no encontrado en el manifiesto.", "DETAIL_NOT_FOUND")
    db.delete(detail)
    db.commit()
    return Message(detail="Ítem eliminado del manifiesto.")


@router.post("/{route_id}/details/import", response_model=ImportResult)
async def import_manifest(
    route_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> ImportResult:
    """CSV with columns: barcode_qr, quantity."""
    route = _get_tenant_route(db, user.company_id, route_id)
    if route.status != RouteStatus.PENDING:
        raise _error(409, "El manifiesto solo puede editarse mientras la ruta está PENDING.", "ROUTE_LOCKED")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise _error(422, "CSV sin encabezados.", "IMPORT_PARSE_ERROR")
    headers = {h.strip().lower() for h in reader.fieldnames if h}
    if not {"barcode_qr", "quantity"}.issubset(headers):
        raise _error(422, "Encabezados requeridos: barcode_qr, quantity.", "IMPORT_PARSE_ERROR")

    parsed: list[tuple[str, int]] = []
    errors: list[str] = []
    for idx, row in enumerate(reader, start=2):
        cleaned = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        barcode = cleaned.get("barcode_qr", "")
        if not barcode:
            continue
        try:
            quantity = int(float(cleaned.get("quantity") or "0"))
            if quantity <= 0:
                raise ValueError
        except ValueError:
            errors.append(f"Fila {idx}: quantity inválido.")
            continue
        parsed.append((barcode, quantity))

    if not parsed:
        raise _error(422, "No hay filas válidas.", "IMPORT_EMPTY")

    products = {
        p.barcode_qr: p
        for p in db.scalars(
            sa.select(Product).where(
                Product.company_id == user.company_id,
                Product.barcode_qr.in_([b for b, _ in parsed]),
            )
        ).all()
    }

    created = updated = 0
    existing = {
        d.product_id: d
        for d in db.scalars(
            sa.select(RouteDetail).where(RouteDetail.route_id == route.id)
        ).all()
    }
    for barcode, quantity in parsed:
        product = products.get(barcode)
        if product is None:
            errors.append(f"Código no encontrado en catálogo: {barcode}")
            continue
        detail = existing.get(product.id)
        if detail is None:
            db.add(
                RouteDetail(
                    company_id=user.company_id,
                    route_id=route.id,
                    product_id=product.id,
                    assigned_quantity=quantity,
                )
            )
            created += 1
        else:
            detail.assigned_quantity = quantity
            updated += 1
    db.commit()
    return ImportResult(total_rows=len(parsed), created=created, updated=updated, errors=errors[:50])


@router.post("/{route_id}/dispatch", response_model=RouteOut)
def dispatch_route(
    route_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> RouteOut:
    """Warehouse finishes loading: PENDING -> IN_PROGRESS (driver can start)."""
    route = _get_tenant_route(db, user.company_id, route_id)
    if route.status != RouteStatus.PENDING:
        raise _error(409, "La ruta ya fue despachada.", "ROUTE_NOT_PENDING")
    counts = _route_counts(db, route.id)
    if counts.lines == 0:
        raise _error(422, "El manifiesto está vacío.", "EMPTY_MANIFEST")
    if route.truck is None or route.truck.assigned_driver_id is None:
        raise _error(422, "Asigne un conductor al camión antes de despachar.", "NO_DRIVER")

    route.status = RouteStatus.IN_PROGRESS
    route.started_at = route.started_at or utcnow()
    db.commit()
    route = _get_tenant_route(db, user.company_id, route.id)
    return _route_out(route, _route_counts(db, route.id))
