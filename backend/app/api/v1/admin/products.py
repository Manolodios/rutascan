"""Product catalog: CRUD, CSV/Excel bulk import, QR label sheets."""

from __future__ import annotations

import uuid
from decimal import Decimal

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_staff
from app.db.session import get_db
from app.models.product import Product
from app.models.route import Route
from app.models.truck import Truck
from app.models.user import User
from app.schemas.admin import ImportResult, ProductCreate, ProductOut, ProductUpdate
from app.schemas.common import Message
from app.services import imports
from app.services.qrpdf import generate_qr_label_sheet, qr_png_bytes

router = APIRouter(prefix="/products", tags=["admin:products"])

MAX_LABELS_PER_SHEET = 480


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


def _get_tenant_product(db: Session, company_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    product = db.scalar(
        sa.select(Product).where(Product.id == product_id, Product.company_id == company_id)
    )
    if product is None:
        raise _error(404, "Producto no encontrado.", "PRODUCT_NOT_FOUND")
    return product


@router.get("", response_model=list[ProductOut])
def list_products(
    q: str | None = Query(default=None, max_length=100),
    include_inactive: bool = False,
    limit: int = Query(default=200, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> list[Product]:
    stmt = sa.select(Product).where(Product.company_id == user.company_id)
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            sa.or_(
                Product.barcode_qr.ilike(pattern),
                Product.description.ilike(pattern),
            )
        )
    return list(
        db.scalars(
            stmt.order_by(Product.description, Product.id).limit(limit).offset(offset)
        ).all()
    )


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Product:
    barcode = payload.barcode_qr.strip()
    duplicate = db.scalar(
        sa.select(Product).where(
            Product.company_id == user.company_id, Product.barcode_qr == barcode
        )
    )
    if duplicate is not None:
        raise _error(409, f"El código {barcode} ya existe.", "BARCODE_EXISTS")
    product = Product(
        company_id=user.company_id,
        barcode_qr=barcode,
        description=payload.description.strip(),
        unit=(payload.unit or "UNIT").strip().upper()[:20],
        weight=Decimal(str(payload.weight)),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Product:
    product = _get_tenant_product(db, user.company_id, product_id)
    data = payload.model_dump(exclude_unset=True)

    if "barcode_qr" in data and data["barcode_qr"]:
        barcode = data["barcode_qr"].strip()
        duplicate = db.scalar(
            sa.select(Product).where(
                Product.company_id == user.company_id,
                Product.barcode_qr == barcode,
                Product.id != product.id,
            )
        )
        if duplicate is not None:
            raise _error(409, f"El código {barcode} ya existe.", "BARCODE_EXISTS")
        product.barcode_qr = barcode
    if "description" in data and data["description"]:
        product.description = data["description"].strip()
    if "unit" in data and data["unit"]:
        product.unit = data["unit"].strip().upper()[:20]
    if "weight" in data and data["weight"] is not None:
        product.weight = Decimal(str(data["weight"]))
    if "is_active" in data and data["is_active"] is not None:
        product.is_active = data["is_active"]

    db.commit()
    db.refresh(product)
    return product


# ------------------------------------------------------------------- import --
@router.get("/template.csv")
def download_template(user: User = Depends(get_current_staff)) -> Response:
    return Response(
        content=imports.CSV_TEMPLATE,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="rutascan_productos_plantilla.csv"'},
    )


@router.post("/import", response_model=ImportResult)
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> ImportResult:
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise _error(413, "Archivo mayor a 8 MB.", "FILE_TOO_LARGE")
    try:
        rows = imports.parse_products_file(file.filename or "products.csv", content)
    except imports.ImportError_ as exc:
        raise _error(422, str(exc), "IMPORT_PARSE_ERROR") from exc
    except ValueError as exc:
        raise _error(422, str(exc), "IMPORT_ROW_ERROR") from exc

    if not rows:
        raise _error(422, "El archivo no contiene filas válidas.", "IMPORT_EMPTY")

    existing = {
        p.barcode_qr: p
        for p in db.scalars(
            sa.select(Product).where(
                Product.company_id == user.company_id,
                Product.barcode_qr.in_([r["barcode_qr"] for r in rows]),
            )
        ).all()
    }

    created = updated = 0
    for row in rows:
        product = existing.get(row["barcode_qr"])
        if product is None:
            db.add(
                Product(
                    company_id=user.company_id,
                    barcode_qr=row["barcode_qr"],
                    description=row["description"],
                    unit=row["unit"],
                    weight=row["weight"],
                )
            )
            created += 1
        else:
            product.description = row["description"]
            product.unit = row["unit"]
            product.weight = row["weight"]
            product.is_active = True
            updated += 1
    db.commit()
    return ImportResult(
        total_rows=len(rows), created=created, updated=updated, errors=[]
    )


# ------------------------------------------------------------------ QR tools --
@router.get("/qr-sheet.pdf")
def qr_sheet(
    ids: str | None = Query(default=None, description="CSV de product_id; vacío = todo el catálogo"),
    copies: int = Query(default=1, ge=1, le=20),
    batch_route_id: uuid.UUID | None = Query(default=None, description="Agrega etiquetas MASTER de la ruta"),
    batch_copies: int = Query(default=1, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Response:
    stmt = sa.select(Product).where(
        Product.company_id == user.company_id, Product.is_active.is_(True)
    )
    if ids:
        try:
            wanted = [uuid.UUID(part.strip()) for part in ids.split(",") if part.strip()]
        except ValueError as exc:
            raise _error(422, "Lista de ids inválida.", "INVALID_IDS") from exc
        stmt = stmt.where(Product.id.in_(wanted))
    products = db.scalars(stmt.order_by(Product.description)).all()

    labels: list[dict] = []
    if batch_route_id is not None:
        route = db.scalar(
            sa.select(Route).where(
                Route.id == batch_route_id, Route.company_id == user.company_id
            )
        )
        if route is None:
            raise _error(404, "Ruta no encontrada.", "ROUTE_NOT_FOUND")
        truck = db.get(Truck, route.truck_id)
        master = {
            "payload": f"RUTA-BATCH:{route.id}",
            "title": f"MASTER RUTA {route.route_date.isoformat()}",
            "subtitle": f"Camion {truck.license_plate if truck else '—'}",
            "kind": "MASTER BATCH",
        }
        labels.extend([master] * batch_copies)

    for product in products:
        label = {
            "payload": product.barcode_qr,
            "title": product.description,
            "subtitle": f"{product.unit} · {float(product.weight):g} kg",
            "kind": "PRODUCT",
        }
        labels.extend([label] * copies)

    if not labels:
        raise _error(422, "No hay productos para generar etiquetas.", "NO_LABELS")
    if len(labels) > MAX_LABELS_PER_SHEET:
        raise _error(
            422,
            f"Máximo {MAX_LABELS_PER_SHEET} etiquetas por PDF ({len(labels)} solicitadas). Divida la selección.",
            "TOO_MANY_LABELS",
        )

    pdf_bytes = generate_qr_label_sheet(labels)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="rutascan_etiquetas_qr.pdf"'},
    )


@router.get("/{product_id}/qr.png")
def product_qr_png(
    product_id: uuid.UUID,
    size: int = Query(default=8, ge=2, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Response:
    product = _get_tenant_product(db, user.company_id, product_id)
    return Response(
        content=qr_png_bytes(product.barcode_qr, box_size=size),
        media_type="image/png",
    )
