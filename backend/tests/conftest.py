"""Shared pytest fixtures: in-memory SQLite session + seeded tenant."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (register tables)
from app.core.geo import local_today
from app.db.base import Base
from app.models import (
    Company,
    DetailStatus,
    Product,
    Role,
    Route,
    RouteDetail,
    RouteStatus,
    Truck,
    User,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def tenant(db):
    """A company with an admin, a driver, a truck, products and today's route."""
    company = Company(
        name="Test Co",
        tax_id="TEST-1",
        license_key="RUTA-TEST-0001",
        expiration_date=date(2030, 1, 1),
        max_trucks=1,
    )
    db.add(company)
    db.flush()

    admin = User(
        company_id=company.id,
        user_cedula="A-1",
        full_name="Admin",
        role=Role.ADMIN,
        pin_hash="x",
    )
    driver = User(
        company_id=company.id,
        user_cedula="D-1",
        full_name="Driver",
        role=Role.DRIVER,
        pin_hash="x",
    )
    db.add_all([admin, driver])
    db.flush()

    truck = Truck(
        company_id=company.id,
        license_plate="TST-001",
        assigned_driver_id=driver.id,
    )
    product_a = Product(
        company_id=company.id,
        barcode_qr="QR-A",
        description="Producto A",
        unit="BOX",
        weight=Decimal("1.5"),
    )
    product_b = Product(
        company_id=company.id,
        barcode_qr="QR-B",
        description="Producto B (en catálogo, fuera de la ruta)",
        unit="UNIT",
        weight=Decimal("0"),
    )
    product_c = Product(
        company_id=company.id,
        barcode_qr="QR-C",
        description="Producto C",
        unit="BAG",
        weight=Decimal("2.0"),
    )
    db.add_all([truck, product_a, product_b, product_c])
    db.flush()

    route = Route(
        company_id=company.id,
        truck_id=truck.id,
        route_date=local_today(),
        status=RouteStatus.PENDING,
    )
    db.add(route)
    db.flush()

    # A: single unit line. C: multi-unit line (2 units -> 2 scans).
    detail_a = RouteDetail(
        company_id=company.id,
        route_id=route.id,
        product_id=product_a.id,
        assigned_quantity=1,
    )
    detail_c = RouteDetail(
        company_id=company.id,
        route_id=route.id,
        product_id=product_c.id,
        assigned_quantity=2,
    )
    db.add_all([detail_a, detail_c])
    db.commit()

    return SimpleNamespace(
        company=company,
        admin=admin,
        driver=driver,
        truck=truck,
        product_a=product_a,
        product_b=product_b,
        product_c=product_c,
        route=route,
        detail_a=detail_a,
        detail_c=detail_c,
        detail_status_in_truck=DetailStatus.IN_TRUCK,
    )
