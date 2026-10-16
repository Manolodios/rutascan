"""Table creation + idempotent demo seed (auto-create migration strategy)."""

from __future__ import annotations

import logging
import secrets
import string
from datetime import date, timedelta
from decimal import Decimal

import sqlalchemy as sa

from app.core.geo import utcnow
from app.core.security import hash_pin
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Company,
    DeliveryLog,
    Product,
    Route,
    RouteDetail,
    Truck,
    User,
    DetailStatus,
    RejectionReasonCode,
    Role,
    RouteStatus,
    ScanAction,
)

logger = logging.getLogger("rutascan.init_db")

LICENSE_ALPHABET = string.ascii_uppercase + string.digits


def generate_license_key() -> str:
    groups = ["".join(secrets.choice(LICENSE_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "RUTA-" + "-".join(groups)


def create_tables() -> None:
    import app.models  # noqa: F401  (register all tables)

    Base.metadata.create_all(bind=engine)
    logger.info("Tables ensured (%d).", len(Base.metadata.tables))


# --------------------------------------------------------------- demo seed ---
DEMO_PRODUCTS = [
    ("PRD-0001", "Caja de leche entera 1L x12", "BOX", "12.500"),
    ("PRD-0002", "Agua mineral 600ml x24", "PACK", "14.400"),
    ("PRD-0003", "Arroz premium 5kg", "BAG", "5.000"),
    ("PRD-0004", "Aceite girasol 1L x15", "BOX", "13.900"),
    ("PRD-0005", "Azúcar refinada 2.5kg", "BAG", "2.500"),
    ("PRD-0006", "Café molido 500g x20", "BOX", "10.000"),
    ("PRD-0007", "Galletas surtidas x30", "BOX", "6.300"),
    ("PRD-0008", "Jabón de baño x48", "BOX", "8.700"),
]

DEMO_CREDENTIALS = [
    ("1000000001", "1234", "Ana Admin", Role.ADMIN),
    ("1000000002", "2345", "Wendy Bodega", Role.WAREHOUSE),
    ("1000000003", "3456", "Diego Conductor", Role.DRIVER),
]


def seed_demo() -> bool:
    """Creates a ready-to-play tenant. Returns True when data was seeded."""
    with SessionLocal() as db:
        existing = db.scalar(sa.select(sa.func.count()).select_from(Company))
        if existing:
            logger.info("Seed skipped: %d company(ies) already present.", existing)
            return False

        company = Company(
            name="Distribuidora Demo S.A.",
            tax_id="900123456-7",
            license_key="RUTA-DEMO-2026-0001",
            expiration_date=date.today() + timedelta(days=365),
            max_trucks=5,
        )
        db.add(company)
        db.flush()

        users: dict[str, User] = {}
        for cedula, pin, full_name, role in DEMO_CREDENTIALS:
            user = User(
                company_id=company.id,
                user_cedula=cedula,
                full_name=full_name,
                role=role,
                pin_hash=hash_pin(pin),
            )
            db.add(user)
            users[cedula] = user
        db.flush()

        driver = users["1000000003"]
        truck = Truck(
            company_id=company.id,
            license_plate="ABC-123",
            model="Chevrolet NHR 2024",
            assigned_driver_id=driver.id,
        )
        db.add(truck)
        db.flush()

        products: list[Product] = []
        for barcode, description, unit, weight in DEMO_PRODUCTS:
            product = Product(
                company_id=company.id,
                barcode_qr=barcode,
                description=description,
                unit=unit,
                weight=Decimal(weight),
            )
            db.add(product)
            products.append(product)
        db.flush()

        route = Route(
            company_id=company.id,
            truck_id=truck.id,
            route_date=date.today(),
            status=RouteStatus.IN_PROGRESS,
            started_at=utcnow() - timedelta(hours=4),
            created_by_id=users["1000000002"].id,
            notes="Ruta demo: 8 productos, 3 entregados, 1 rechazado.",
        )
        db.add(route)
        db.flush()

        details: list[RouteDetail] = []
        for product in products:
            detail = RouteDetail(
                company_id=company.id,
                route_id=route.id,
                product_id=product.id,
                assigned_quantity=2,
            )
            db.add(detail)
            details.append(detail)
        db.flush()

        now = utcnow()
        base_lat, base_lon = 4.6533, -74.0836  # Bogotá
        scans = [
            (0, ScanAction.LOAD, None),
            (1, ScanAction.LOAD, None),
            (2, ScanAction.DELIVER, None),
            (3, ScanAction.DELIVER, None),
            (4, ScanAction.REJECT, RejectionReasonCode.DAMAGED),
        ]
        for index, (position, action, rejection) in enumerate(scans):
            detail = details[position]
            scan_ts = now - timedelta(hours=3, minutes=20 - index * 18)
            lat = base_lat + 0.004 * (index + 1)
            lon = base_lon - 0.003 * (index + 1)
            if action == ScanAction.DELIVER:
                detail.delivered_quantity = detail.assigned_quantity
                detail.status = DetailStatus.DELIVERED
            elif action == ScanAction.REJECT:
                detail.status = DetailStatus.REJECTED
                detail.return_required = True
                detail.rejection_reason = rejection.value
            db.add(
                DeliveryLog(
                    company_id=company.id,
                    route_detail_id=detail.id,
                    driver_id=driver.id,
                    scan_uuid=secrets.token_hex(16),
                    action=action,
                    quantity=1,
                    scan_timestamp_utc=scan_ts,
                    server_timestamp_utc=scan_ts + timedelta(seconds=30),
                    latitude=lat,
                    longitude=lon,
                    gps_accuracy_m=6.5,
                    device_uuid="DEMO-DEVICE-0001",
                    synced_with_server=True,
                    via_offline_batch=index >= 3,
                    rejection_reason=rejection,
                )
            )
        db.commit()

        logger.info("=" * 62)
        logger.info("RutaScan demo data seeded.")
        logger.info("  LICENSE KEY : RUTA-DEMO-2026-0001")
        for cedula, pin, full_name, role in DEMO_CREDENTIALS:
            logger.info("  %-9s : cédula %s  PIN %s  (%s)", role.value, cedula, pin, full_name)
        logger.info("=" * 62)
        return True


def init_db(seed: bool = True) -> None:
    create_tables()
    if seed:
        seed_demo()


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    init_db(seed=True)
