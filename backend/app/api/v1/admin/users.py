"""User management: create staff, reset PINs, activate/deactivate (ADMIN)."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_staff
from app.core.security import hash_pin
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User
from app.schemas.admin import PinResetRequest, UserBrief, UserCreate, UserOut, UserUpdate
from app.schemas.common import Message

router = APIRouter(prefix="/users", tags=["admin:users"])


def _error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"detail": message, "code": code})


def _get_tenant_user(db: Session, company_id: uuid.UUID, user_id: uuid.UUID) -> User:
    target = db.scalar(
        sa.select(User).where(User.id == user_id, User.company_id == company_id)
    )
    if target is None:
        raise _error(404, "Usuario no encontrado.", "USER_NOT_FOUND")
    return target


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), user: User = Depends(get_current_admin)
) -> list[User]:
    return list(
        db.scalars(
            sa.select(User)
            .where(User.company_id == user.company_id)
            .order_by(User.role, User.full_name)
        ).all()
    )


@router.get("/drivers", response_model=list[UserBrief])
def list_drivers(
    db: Session = Depends(get_db), user: User = Depends(get_current_staff)
) -> list[User]:
    """Lightweight driver list for assignment UIs (warehouse can read it too)."""
    return list(
        db.scalars(
            sa.select(User)
            .where(
                User.company_id == user.company_id,
                User.role == Role.DRIVER,
                User.is_active.is_(True),
            )
            .order_by(User.full_name)
        ).all()
    )


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> User:
    cedula = payload.user_cedula.strip()
    duplicate = db.scalar(sa.select(User).where(User.user_cedula == cedula))
    if duplicate is not None:
        raise _error(409, f"La cédula {cedula} ya está registrada.", "CEDULA_EXISTS")

    new_user = User(
        company_id=user.company_id,
        user_cedula=cedula,
        full_name=payload.full_name.strip(),
        role=payload.role,
        pin_hash=hash_pin(payload.pin),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> User:
    target = _get_tenant_user(db, user.company_id, user_id)
    data = payload.model_dump(exclude_unset=True)

    if data.get("is_active") is False and target.id == user.id:
        raise _error(422, "No puede desactivar su propio usuario.", "CANNOT_DISABLE_SELF")

    if "full_name" in data and data["full_name"]:
        target.full_name = data["full_name"].strip()
    if "role" in data and data["role"] is not None:
        if target.id == user.id and data["role"] != user.role:
            raise _error(422, "No puede cambiar su propio rol.", "CANNOT_CHANGE_OWN_ROLE")
        target.role = data["role"]
    if "is_active" in data and data["is_active"] is not None:
        target.is_active = data["is_active"]

    db.commit()
    db.refresh(target)
    return target


@router.post("/{user_id}/reset-pin", response_model=Message)
def reset_pin(
    user_id: uuid.UUID,
    payload: PinResetRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Message:
    target = _get_tenant_user(db, user.company_id, user_id)
    target.pin_hash = hash_pin(payload.pin)
    db.commit()
    return Message(detail=f"PIN restablecido para {target.full_name}.")
