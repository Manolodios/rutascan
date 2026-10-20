"""Trucks CRUD + driver assignment (ADMIN / WAREHOUSE)."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_staff
from app.core.geo import local_today
from app.db.session import get_db
from app.models.enums import Role, RouteStatus
from app.models.route import Route
from app.models.truck import Truck
from app.models.user import User
from app.schemas.admin import TruckCreate, TruckOut, TruckUpdate, UserBrief
from app.schemas.common import Message

router = APIRouter(prefix="/trucks", tags=["admin:trucks"])


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


def _validate_driver(db: Session, company_id: uuid.UUID, driver_id: uuid.UUID) -> User:
    driver = db.scalar(
        sa.select(User).where(
            User.id == driver_id,
            User.company_id == company_id,
            User.role == Role.DRIVER,
            User.is_active.is_(True),
        )
    )
    if driver is None:
        raise _error(422, "Conductor inválido o inactivo.", "INVALID_DRIVER")
    return driver


def _truck_out(truck: Truck, today_status: dict[uuid.UUID, RouteStatus]) -> TruckOut:
    return TruckOut(
        id=truck.id,
        license_plate=truck.license_plate,
        model=truck.model,
        is_active=truck.is_active,
        assigned_driver=(
            UserBrief(
                id=truck.assigned_driver.id,
                user_cedula=truck.assigned_driver.user_cedula,
                full_name=truck.assigned_driver.full_name,
                role=truck.assigned_driver.role,
            )
            if truck.assigned_driver
            else None
        ),
        has_route_today=truck.id in today_status,
        route_status_today=today_status.get(truck.id),
    )


def _today_status_map(db: Session, company_id: uuid.UUID) -> dict:
    rows = db.execute(
        sa.select(Route.truck_id, Route.status).where(
            Route.company_id == company_id, Route.route_date == local_today()
        )
    ).all()
    return {truck_id: status for truck_id, status in rows}


@router.get("", response_model=list[TruckOut])
def list_trucks(
    db: Session = Depends(get_db), user: User = Depends(get_current_staff)
) -> list[TruckOut]:
    trucks = db.scalars(
        sa.select(Truck)
        .options(joinedload(Truck.assigned_driver))
        .where(Truck.company_id == user.company_id)
        .order_by(Truck.license_plate)
    ).all()
    status_map = _today_status_map(db, user.company_id)
    return [_truck_out(t, status_map) for t in trucks]


@router.post("", response_model=TruckOut, status_code=201)
def create_truck(
    payload: TruckCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> TruckOut:
    plate = payload.license_plate.strip().upper()
    duplicate = db.scalar(
        sa.select(Truck).where(
            Truck.company_id == user.company_id, Truck.license_plate == plate
        )
    )
    if duplicate is not None:
        raise _error(409, f"Ya existe un camión con placa {plate}.", "PLATE_EXISTS")

    if payload.assigned_driver_id is not None:
        _validate_driver(db, user.company_id, payload.assigned_driver_id)

    truck = Truck(
        company_id=user.company_id,
        license_plate=plate,
        model=(payload.model or "").strip() or None,
        assigned_driver_id=payload.assigned_driver_id,
    )
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return _truck_out(truck, _today_status_map(db, user.company_id))


@router.patch("/{truck_id}", response_model=TruckOut)
def update_truck(
    truck_id: uuid.UUID,
    payload: TruckUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> TruckOut:
    truck = db.scalar(
        sa.select(Truck).where(Truck.id == truck_id, Truck.company_id == user.company_id)
    )
    if truck is None:
        raise _error(404, "Camión no encontrado.", "TRUCK_NOT_FOUND")

    data = payload.model_dump(exclude_unset=True)

    if "license_plate" in data and data["license_plate"]:
        plate = data["license_plate"].strip().upper()
        duplicate = db.scalar(
            sa.select(Truck).where(
                Truck.company_id == user.company_id,
                Truck.license_plate == plate,
                Truck.id != truck.id,
            )
        )
        if duplicate is not None:
            raise _error(409, f"Ya existe un camión con placa {plate}.", "PLATE_EXISTS")
        truck.license_plate = plate

    if "model" in data:
        truck.model = (data["model"] or "").strip() or None

    if "assigned_driver_id" in data:
        if data["assigned_driver_id"] is not None:
            _validate_driver(db, user.company_id, data["assigned_driver_id"])
        truck.assigned_driver_id = data["assigned_driver_id"]

    if "is_active" in data and data["is_active"] is not None:
        truck.is_active = data["is_active"]

    db.commit()
    db.refresh(truck)
    return _truck_out(truck, _today_status_map(db, user.company_id))


@router.delete("/{truck_id}", response_model=Message)
def deactivate_truck(
    truck_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Message:
    truck = db.scalar(
        sa.select(Truck).where(Truck.id == truck_id, Truck.company_id == user.company_id)
    )
    if truck is None:
        raise _error(404, "Camión no encontrado.", "TRUCK_NOT_FOUND")
    truck.is_active = False
    db.commit()
    return Message(detail=f"Camión {truck.license_plate} desactivado.")
