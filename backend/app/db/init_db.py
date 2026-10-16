"""Table creation + idempotent demo seed (auto-create migration strategy)."""

from __future__ import annotations

import logging
import random
import secrets
import string
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.core.geo import utcnow
from app.core.security import hash_pin
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Company,
    DeliveryLog,
    Device,
    Product,
    Route,
    RouteDetail,
    SecurityEvent,
    Truck,
    User,
    DetailStatus,
    RejectionReasonCode,
    Role,
    RouteStatus,
    ScanAction,
    SecurityEventType,
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
DEMO_COMPANY_NAME = "Comercializadora Andina S.A.S."
DEMO_TAX_ID = "901.458.772-3"
DEMO_LICENSE_KEY = "RUTA-4F7Q-2MX9-BN38"
DEMO_MAX_TRUCKS = 12
DEMO_DEVICE_UUID = "DEMO-TABLET-0001"
DEMO_RANDOM_SEED = 20261016

DEMO_PRODUCTS = [
    ("7702001000019", "Leche entera UHT 1L x12", "BOX", "12.500"),
    ("7702001000026", "Agua mineral 600 ml x24", "PACK", "14.400"),
    ("7702001000033", "Arroz premium 5 kg", "BAG", "5.000"),
    ("7702001000040", "Aceite de girasol 1L x15", "BOX", "13.900"),
    ("7702001000057", "Azúcar refinada 2.5 kg x10", "BAG", "2.500"),
    ("7702001000064", "Café molido 500 g x20", "BOX", "10.000"),
    ("7702001000071", "Galletas surtidas x30", "BOX", "6.300"),
    ("7702001000088", "Jabón de baño x48", "BOX", "8.700"),
    ("7702001000095", "Detergente en polvo 900 g x12", "BOX", "9.800"),
    ("7702001000101", "Pasta dental 90 ml x24", "BOX", "7.400"),
    ("7702001000118", "Papel higiénico x24 rollos", "PACK", "11.200"),
    ("7702001000125", "Atún en aceite 170 g x24", "BOX", "8.900"),
]

DEMO_USERS = [
    ("1020456789", "1234", "Ana María Restrepo", Role.ADMIN),
    ("79458123", "2345", "Wendy Paola Gómez", Role.WAREHOUSE),
    ("52987641", "3456", "Diego Armando Ramírez", Role.DRIVER),
    ("1032459876", "4567", "Julián Esteban Torres", Role.DRIVER),
    ("71745238", "5678", "Carlos Andrés Muñoz", Role.DRIVER),
]

DEMO_TRUCKS = [
    ("WKL-482", "Chevrolet NHR 2024", "52987641"),
    ("SJR-116", "Renault Kangoo 2023", "1032459876"),
    ("TSM-907", "JAC X200 2025", "71745238"),
    ("PBN-245", "Toyota Hilux 2022", None),
]

DEMO_REJECTION_REASONS = [
    RejectionReasonCode.CLIENT_REJECTED,
    RejectionReasonCode.DAMAGED,
    RejectionReasonCode.NO_ONE_HOME,
    RejectionReasonCode.WRONG_ITEM,
]

# Bogotá (centro). Los desplazamientos reparten los escaneos por la ciudad.
BOGOTA_LAT = 4.6533
BOGOTA_LON = -74.0836


class _ScanClock:
    """Monotonic scan timestamps (4 minutes apart) + a GPS jitter counter."""

    def __init__(self, start: datetime) -> None:
        self._cursor = start
        self.index = 0

    def tick(self) -> datetime:
        value = self._cursor
        self._cursor += timedelta(minutes=4)
        self.index += 1
        return value


def _demo_scan(
    db: Session,
    *,
    detail: RouteDetail,
    driver_id: uuid.UUID,
    clock: _ScanClock,
    action: ScanAction,
    rejection: RejectionReasonCode | None = None,
) -> None:
    """Appends one DeliveryLog, mirroring what the mobile app writes (qty 1)."""
    when = clock.tick()
    offset = 0.0016 * (clock.index + 1)
    db.add(
        DeliveryLog(
            company_id=detail.company_id,
            route_detail_id=detail.id,
            driver_id=driver_id,
            scan_uuid=secrets.token_hex(16),
            action=action,
            quantity=1,
            scan_timestamp_utc=when,
            server_timestamp_utc=when + timedelta(seconds=45 if clock.index % 5 == 0 else 6),
            latitude=BOGOTA_LAT + offset,
            longitude=BOGOTA_LON - offset,
            gps_accuracy_m=round(4.5 + (clock.index % 5) * 1.6, 1),
            device_uuid=DEMO_DEVICE_UUID,
            synced_with_server=True,
            via_offline_batch=clock.index % 5 == 4,
            rejection_reason=rejection,
        )
    )


def _demo_route(
    db: Session,
    *,
    company_id: uuid.UUID,
    truck: Truck,
    driver: User,
    created_by: User,
    products: list[Product],
    route_date: date,
    status: RouteStatus,
    started_at: datetime | None,
    delivered: int,
    rejected: int,
    in_truck: int,
    catalogue_offset: int,
    notes: str | None = None,
) -> Route:
    """One manifest (assigned / delivered / rejected lines) + its scan trail."""
    total = delivered + rejected + in_truck
    if total > len(products):
        raise ValueError("demo route needs more products than the catalogue has")

    route = Route(
        company_id=company_id,
        truck_id=truck.id,
        route_date=route_date,
        status=status,
        started_at=started_at,
        completed_at=(
            started_at + timedelta(hours=2)
            if status == RouteStatus.COMPLETED and started_at is not None
            else None
        ),
        created_by_id=created_by.id,
        notes=notes,
    )
    db.add(route)
    db.flush()

    details: list[RouteDetail] = []
    for position in range(total):
        detail = RouteDetail(
            company_id=company_id,
            route_id=route.id,
            product_id=products[(catalogue_offset + position) % len(products)].id,
            assigned_quantity=1 + position % 2,
        )
        db.add(detail)
        details.append(detail)
    db.flush()

    if started_at is None:  # programmed route, nothing scanned yet
        return route

    clock = _ScanClock(started_at)
    for position, detail in enumerate(details):
        rejection: RejectionReasonCode | None = None
        if position < delivered:
            detail.status = DetailStatus.DELIVERED
            detail.delivered_quantity = detail.assigned_quantity
        elif position < delivered + rejected:
            detail.status = DetailStatus.REJECTED
            detail.return_required = True
            rejection = DEMO_REJECTION_REASONS[position % len(DEMO_REJECTION_REASONS)]
            detail.rejection_reason = rejection.value

        for _ in range(detail.assigned_quantity):
            _demo_scan(db, detail=detail, driver_id=driver.id, clock=clock, action=ScanAction.LOAD)
        if detail.status == DetailStatus.DELIVERED:
            for _ in range(detail.assigned_quantity):
                _demo_scan(
                    db, detail=detail, driver_id=driver.id, clock=clock, action=ScanAction.DELIVER
                )
        elif detail.status == DetailStatus.REJECTED:
            _demo_scan(
                db,
                detail=detail,
                driver_id=driver.id,
                clock=clock,
                action=ScanAction.REJECT,
                rejection=rejection,
            )
    return route


def seed_demo() -> bool:
    """Creates a ready-to-play tenant. Returns True when data was seeded."""
    with SessionLocal() as db:
        existing = db.scalar(sa.select(sa.func.count()).select_from(Company))
        if existing:
            logger.info("Seed skipped: %d company(ies) already present.", existing)
            return False

        company = Company(
            name=DEMO_COMPANY_NAME,
            tax_id=DEMO_TAX_ID,
            license_key=DEMO_LICENSE_KEY,
            expiration_date=date.today() + timedelta(days=365),
            max_trucks=DEMO_MAX_TRUCKS,
        )
        db.add(company)
        db.flush()

        users: dict[str, User] = {}
        for cedula, pin, full_name, role in DEMO_USERS:
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

        trucks: dict[str, Truck] = {}
        for plate, model, driver_cedula in DEMO_TRUCKS:
            truck = Truck(
                company_id=company.id,
                license_plate=plate,
                model=model,
                assigned_driver_id=users[driver_cedula].id if driver_cedula else None,
            )
            db.add(truck)
            trucks[plate] = truck
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

        created_by = users["79458123"]
        today = date.today()
        rng = random.Random(DEMO_RANDOM_SEED)

        # --- hoy --------------------------------------------------------------
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["WKL-482"],
            driver=users["52987641"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.IN_PROGRESS,
            started_at=utcnow() - timedelta(hours=2, minutes=20),
            delivered=3,
            rejected=1,
            in_truck=4,
            catalogue_offset=0,
            notes="Ruta Centro · 8 paradas, 3 entregas confirmadas, 1 rechazo.",
        )
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["SJR-116"],
            driver=users["1032459876"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.COMPLETED,
            started_at=utcnow() - timedelta(hours=9),
            delivered=5,
            rejected=1,
            in_truck=0,
            catalogue_offset=3,
            notes="Ruta Norte · jornada cerrada sin novedades.",
        )
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["TSM-907"],
            driver=users["71745238"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.PENDING,
            started_at=None,
            delivered=0,
            rejected=0,
            in_truck=6,
            catalogue_offset=6,
            notes="Ruta Sur · carga programada para la tarde.",
        )

        # --- 6 días anteriores (para reportes y gráficas) ----------------------
        for days_ago in range(1, 7):
            day = today - timedelta(days=days_ago)
            for slot, plate in enumerate(("WKL-482", "SJR-116")):
                cedula = "52987641" if slot == 0 else "1032459876"
                delivered = rng.randint(4, 7)
                rejected = rng.choice([0, 1, 1, 2])
                _demo_route(
                    db,
                    company_id=company.id,
                    truck=trucks[plate],
                    driver=users[cedula],
                    created_by=created_by,
                    products=products,
                    route_date=day,
                    status=RouteStatus.COMPLETED,
                    started_at=datetime(
                        day.year, day.month, day.day, 12, 30, tzinfo=timezone.utc
                    ),
                    delivered=delivered,
                    rejected=rejected,
                    in_truck=0,
                    catalogue_offset=(days_ago * 2 + slot) % len(products),
                    notes=None,
                )

        # --- dispositivo demo + bitácora de seguridad --------------------------
        now = utcnow()
        db.add(
            Device(
                company_id=company.id,
                device_uuid=DEMO_DEVICE_UUID,
                user_id=users["52987641"].id,
                platform="android",
                app_version="1.0.0",
                first_seen_at=now - timedelta(days=26),
                last_seen_at=now - timedelta(minutes=18),
                is_active=True,
            )
        )

        security_trail = [
            (SecurityEventType.MOCK_GPS, 95, {"motivo": "Ubicación simulada durante una entrega"}),
            (SecurityEventType.TIMESTAMP_SKEW, 610, {"desfase_segundos": 42}),
            (SecurityEventType.MANIFEST_MISMATCH, 1500, {"qr_escaneado": "7702001000999"}),
            (SecurityEventType.DUPLICATE_SCAN, 2900, {"intentos": 2}),
            (SecurityEventType.PIN_LOCKOUT, 4400, {"intentos_fallidos": 5}),
        ]
        for event_type, minutes_ago, payload in security_trail:
            db.add(
                SecurityEvent(
                    company_id=company.id,
                    event_type=event_type,
                    user_id=users["52987641"].id,
                    device_uuid=DEMO_DEVICE_UUID,
                    latitude=BOGOTA_LAT + 0.012,
                    longitude=BOGOTA_LON - 0.012,
                    detail=payload,
                    created_at=now - timedelta(minutes=minutes_ago),
                )
            )

        db.commit()

        logger.info("=" * 64)
        logger.info("Datos de demostración creados: %s", DEMO_COMPANY_NAME)
        logger.info("  Clave de licencia : %s", DEMO_LICENSE_KEY)
        for cedula, pin, full_name, role in DEMO_USERS:
            logger.info("  %-9s : cédula %s  PIN %s  (%s)", role.value, cedula, pin, full_name)
        logger.info("=" * 64)
        return True


def init_db(seed: bool = True) -> None:
    create_tables()
    if seed:
        seed_demo()


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    init_db(seed=True)
