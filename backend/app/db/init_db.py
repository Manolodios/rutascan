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
    SyncBatch,
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
DEMO_COMPANY_NAME = "Distribuidora Costa Oriental, C.A."
DEMO_TAX_ID = "J-30845672-1"
DEMO_LICENSE_KEY = "RUTA-4F7Q-2MX9-BN38"
DEMO_MAX_TRUCKS = 12
DEMO_DEVICE_UUID = "DEMO-TABLET-0001"
DEMO_RANDOM_SEED = 20261016

DEMO_PRODUCTS = [
    ("7592001000019", "Leche entera UHT 1L x12", "BOX", "12.500"),
    ("7592001000026", "Agua mineral 600 ml x24", "PACK", "14.400"),
    ("7592001000033", "Arroz premium 5 kg", "BAG", "5.000"),
    ("7592001000040", "Aceite de girasol 1L x15", "BOX", "13.900"),
    ("7592001000057", "Azúcar refinada 2.5 kg x10", "BAG", "2.500"),
    ("7592001000064", "Café molido 500 g x20", "BOX", "10.000"),
    ("7592001000071", "Galletas surtidas x30", "BOX", "6.300"),
    ("7592001000088", "Jabón de baño x48", "BOX", "8.700"),
    ("7592001000095", "Detergente en polvo 900 g x12", "BOX", "9.800"),
    ("7592001000101", "Harina de maíz precocida 1 kg x20", "BOX", "20.000"),
    ("7592001000118", "Papel higiénico x24 rollos", "PACK", "11.200"),
    ("7592001000125", "Atún en aceite 170 g x24", "BOX", "8.900"),
]

DEMO_USERS = [
    ("13598742", "1234", "Yasmín Bracho", Role.ADMIN),
    ("15874230", "2345", "Norkys Villalobos", Role.WAREHOUSE),
    ("20148379", "3456", "Jhonny Pirela", Role.DRIVER),
    ("18376452", "4567", "Ender Fuenmayor", Role.DRIVER),
    ("14209876", "5678", "Alcides Urdaneta", Role.DRIVER),
]

DEMO_TRUCKS = [
    ("P84LS6V", "Chevrolet NHR 2024", "20148379"),
    ("B23MC7V", "Renault Kangoo 2023", "18376452"),
    ("G56RD9V", "JAC X200 2025", "14209876"),
    ("A91FB4V", "Toyota Hilux 2022", None),
]

DEMO_REJECTION_REASONS = [
    RejectionReasonCode.CLIENT_REJECTED,
    RejectionReasonCode.DAMAGED,
    RejectionReasonCode.NO_ONE_HOME,
    RejectionReasonCode.WRONG_ITEM,
]

# Cabimas (Zulia). Los desplazamientos reparten los escaneos por la ciudad,
# tierra adentro: la costa del lago de Maracaibo queda al oeste, así que el
# demo avanza hacia el sureste (lat-, lon+) para no "navegar" sobre el agua.
CABIMAS_LAT = 10.3990
CABIMAS_LON = -71.4360


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
            latitude=CABIMAS_LAT - offset,
            longitude=CABIMAS_LON + offset,
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

        created_by = users["15874230"]
        today = date.today()
        rng = random.Random(DEMO_RANDOM_SEED)

        # --- hoy --------------------------------------------------------------
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["P84LS6V"],
            driver=users["20148379"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.IN_PROGRESS,
            started_at=utcnow() - timedelta(hours=2, minutes=20),
            delivered=3,
            rejected=1,
            in_truck=4,
            catalogue_offset=0,
            notes="Ruta Cabimas · 8 paradas, 3 entregas confirmadas, 1 rechazo.",
        )
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["B23MC7V"],
            driver=users["18376452"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.COMPLETED,
            started_at=utcnow() - timedelta(hours=9),
            delivered=5,
            rejected=1,
            in_truck=0,
            catalogue_offset=3,
            notes="Ruta Maracaibo · jornada cerrada sin novedades.",
        )
        _demo_route(
            db,
            company_id=company.id,
            truck=trucks["G56RD9V"],
            driver=users["14209876"],
            created_by=created_by,
            products=products,
            route_date=today,
            status=RouteStatus.PENDING,
            started_at=None,
            delivered=0,
            rejected=0,
            in_truck=6,
            catalogue_offset=6,
            notes="Ruta Costa Oriental · carga programada para la tarde.",
        )

        # --- 6 días anteriores (para reportes y gráficas) ----------------------
        for days_ago in range(1, 7):
            day = today - timedelta(days=days_ago)
            for slot, plate in enumerate(("P84LS6V", "B23MC7V")):
                cedula = "20148379" if slot == 0 else "18376452"
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
                user_id=users["20148379"].id,
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
            (SecurityEventType.MANIFEST_MISMATCH, 1320, {"qr_escaneado": "7592001000999"}),
            (SecurityEventType.DUPLICATE_SCAN, 2900, {"intentos": 2}),
            (SecurityEventType.PIN_LOCKOUT, 4400, {"intentos_fallidos": 5}),
        ]
        for event_type, minutes_ago, payload in security_trail:
            db.add(
                SecurityEvent(
                    company_id=company.id,
                    event_type=event_type,
                    user_id=users["20148379"].id,
                    device_uuid=DEMO_DEVICE_UUID,
                    latitude=CABIMAS_LAT - 0.012,
                    longitude=CABIMAS_LON + 0.012,
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


def _shift_dates(db: Session, company: Company, models: tuple, delta: timedelta) -> int:
    """Suma `delta` a todas las columnas de fecha del tenant demo."""
    rows = 0
    targets = [(Company, True)] + [(model, False) for model in models if hasattr(model, "company_id")]
    for model, single in targets:
        date_keys = [
            column.key
            for column in model.__table__.columns
            if isinstance(column.type, (sa.Date, sa.DateTime))
        ]
        if not date_keys:
            continue
        if single:
            query = sa.select(model).where(model.id == company.id)
        else:
            query = sa.select(model).where(model.company_id == company.id)
        for row in db.scalars(query):
            for key in date_keys:
                value = getattr(row, key)
                if value is not None:
                    setattr(row, key, value + delta)
            rows += 1
    return rows


def refresh_demo_dates(target: date | None = None) -> int:
    """Corre los datos de demostración hasta `target` (hoy por defecto).

    Mueve **todas** las fechas del tenant demo (rutas, escaneos, eventos de
    seguridad, dispositivos y la caducidad de la licencia) la misma cantidad de
    días, de modo que una demostración en vivo siempre se vea al día, sin tocar
    ids, cantidades ni los códigos QR ya impresos.

    Solo actúa sobre la empresa demo (`DEMO_LICENSE_KEY`): los datos de un
    cliente real nunca se tocan. Devuelve los días movidos (0 si ya estaba al día).
    """
    target = target or date.today()
    models = (
        Route,
        RouteDetail,
        DeliveryLog,
        SyncBatch,
        SecurityEvent,
        Device,
        User,
        Truck,
        Product,
    )

    with SessionLocal() as db:
        company = db.scalar(
            sa.select(Company).where(Company.license_key == DEMO_LICENSE_KEY)
        )
        if company is None:
            logger.info("Demo refresh omitido: no existe la empresa demo.")
            return 0

        latest = db.scalar(
            sa.select(sa.func.max(Route.route_date)).where(Route.company_id == company.id)
        )
        if latest is None:
            return 0

        days = (target - latest).days
        if days == 0:
            logger.info("Datos de demostración ya al día (%s).", latest.isoformat())
            return 0

        # Dos pasadas: primero todo muy lejos y después al destino. El orden de
        # los UPDATE es arbitrario, y UNIQUE(truck_id, route_date) se revisa
        # fila por fila: sin este rodeo, mover las fechas un solo día choca
        # contra una ruta que todavía no se había movido.
        move = timedelta(days=days)
        far = timedelta(days=9000 if days > 0 else -9000)
        _shift_dates(db, company, models, far)
        db.commit()
        rows = _shift_dates(db, company, models, move - far)
        db.commit()

        logger.info(
            "Datos de demostración movidos %d día(s) hasta %s (%d filas).",
            days,
            target.isoformat(),
            rows,
        )
        return days


def init_db(seed: bool = True, refresh_demo: bool = False) -> None:
    create_tables()
    if seed:
        seed_demo()
    if refresh_demo:
        refresh_demo_dates()


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    init_db(seed=True)
