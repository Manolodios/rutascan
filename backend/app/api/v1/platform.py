"""Platform (SaaS operator) endpoints - protected by X-Platform-Key.

Used to provision tenant companies, issue license keys and manage
subscriptions (renew / suspend / change truck cap).
"""

from __future__ import annotations

import secrets
import string
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_pin
from app.db.session import get_db
from app.models.company import Company
from app.models.enums import Role
from app.models.truck import Truck
from app.models.user import User
from app.schemas.admin import (
    CompanyCreateRequest,
    CompanyCreatedOut,
    CompanyLicenseUpdate,
    CompanyOut,
)
from app.services import licensing

router = APIRouter(prefix="/platform", tags=["platform"])

LICENSE_ALPHABET = string.ascii_uppercase + string.digits


def require_platform_key(request: Request) -> None:
    settings = get_settings()
    provided = request.headers.get("X-Platform-Key", "")
    if not provided or not secrets.compare_digest(provided, settings.platform_api_key):
        raise HTTPException(
            status_code=403,
            detail={"detail": "Clave de plataforma inválida.", "code": "INVALID_PLATFORM_KEY"},
        )


def _generate_license_key(db: Session) -> str:
    for _ in range(20):
        groups = ["".join(secrets.choice(LICENSE_ALPHABET) for _ in range(4)) for _ in range(3)]
        key = "RUTA-" + "-".join(groups)
        if db.scalar(sa.select(Company).where(Company.license_key == key)) is None:
            return key
    raise HTTPException(500, detail={"detail": "No se pudo generar licencia.", "code": "LICENSE_GEN_FAILED"})


@router.post("/companies", response_model=CompanyCreatedOut, status_code=201,
             dependencies=[Depends(require_platform_key)])
def create_company(payload: CompanyCreateRequest, db: Session = Depends(get_db)) -> CompanyCreatedOut:
    if db.scalar(sa.select(Company).where(Company.tax_id == payload.tax_id.strip())) is not None:
        raise HTTPException(
            409, detail={"detail": "Ya existe una empresa con ese RIF.", "code": "TAX_ID_EXISTS"}
        )
    if db.scalar(sa.select(User).where(User.user_cedula == payload.admin_cedula.strip())) is not None:
        raise HTTPException(
            409, detail={"detail": "La cédula del admin ya está registrada.", "code": "CEDULA_EXISTS"}
        )

    company = Company(
        name=payload.name.strip(),
        tax_id=payload.tax_id.strip(),
        license_key=_generate_license_key(db),
        expiration_date=payload.expiration_date,
        max_trucks=payload.max_trucks,
    )
    db.add(company)
    db.flush()

    admin = User(
        company_id=company.id,
        user_cedula=payload.admin_cedula.strip(),
        full_name=payload.admin_full_name.strip(),
        role=Role.ADMIN,
        pin_hash=hash_pin(payload.admin_pin),
    )
    db.add(admin)
    db.commit()

    return CompanyCreatedOut(
        company_id=company.id,
        name=company.name,
        license_key=company.license_key,
        expiration_date=company.expiration_date,
        max_trucks=company.max_trucks,
        admin_user_id=admin.id,
    )


@router.get("/companies", response_model=list[CompanyOut],
            dependencies=[Depends(require_platform_key)])
def list_companies(db: Session = Depends(get_db)) -> list[CompanyOut]:
    companies = db.scalars(sa.select(Company).order_by(Company.created_at.desc())).all()
    result: list[CompanyOut] = []
    for company in companies:
        users_count = int(
            db.scalar(sa.select(sa.func.count()).select_from(User).where(User.company_id == company.id)) or 0
        )
        trucks_count = int(
            db.scalar(sa.select(sa.func.count()).select_from(Truck).where(Truck.company_id == company.id)) or 0
        )
        result.append(
            CompanyOut(
                id=company.id,
                name=company.name,
                tax_id=company.tax_id,
                license_key=company.license_key,
                subscription_status=company.subscription_status,
                expiration_date=company.expiration_date,
                max_trucks=company.max_trucks,
                is_active=company.is_active,
                created_at=company.created_at,
                active_devices=licensing.count_active_devices(db, company.id),
                users_count=users_count,
                trucks_count=trucks_count,
            )
        )
    return result


@router.patch("/companies/{company_id}/license", response_model=CompanyOut,
              dependencies=[Depends(require_platform_key)])
def update_license(
    company_id: uuid.UUID, payload: CompanyLicenseUpdate, db: Session = Depends(get_db)
) -> CompanyOut:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, detail={"detail": "Empresa no encontrada.", "code": "COMPANY_NOT_FOUND"})

    data = payload.model_dump(exclude_unset=True)
    if data.get("subscription_status") is not None:
        company.subscription_status = data["subscription_status"]
    if data.get("expiration_date") is not None:
        company.expiration_date = data["expiration_date"]
    if data.get("max_trucks") is not None:
        company.max_trucks = data["max_trucks"]
    if data.get("is_active") is not None:
        company.is_active = data["is_active"]
    db.commit()
    db.refresh(company)

    users_count = int(
        db.scalar(sa.select(sa.func.count()).select_from(User).where(User.company_id == company.id)) or 0
    )
    trucks_count = int(
        db.scalar(sa.select(sa.func.count()).select_from(Truck).where(Truck.company_id == company.id)) or 0
    )
    return CompanyOut(
        id=company.id,
        name=company.name,
        tax_id=company.tax_id,
        license_key=company.license_key,
        subscription_status=company.subscription_status,
        expiration_date=company.expiration_date,
        max_trucks=company.max_trucks,
        is_active=company.is_active,
        created_at=company.created_at,
        active_devices=licensing.count_active_devices(db, company.id),
        users_count=users_count,
        trucks_count=trucks_count,
    )
