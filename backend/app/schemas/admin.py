"""Admin/web schemas: trucks, users, products, routes, devices, audit."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    DetailStatus,
    RejectionReasonCode,
    Role,
    RouteStatus,
    SecurityEventType,
    SubscriptionStatus,
)


# ------------------------------------------------------------------ shared ---
class TruckBrief(BaseModel):
    id: uuid.UUID
    license_plate: str
    model: str | None = None
    is_active: bool = True


class UserBrief(BaseModel):
    id: uuid.UUID
    user_cedula: str
    full_name: str
    role: Role


class ProductBrief(BaseModel):
    id: uuid.UUID
    barcode_qr: str
    description: str
    unit: str
    weight: float


# ------------------------------------------------------------------ trucks ---
class TruckCreate(BaseModel):
    license_plate: str = Field(min_length=2, max_length=20)
    model: str | None = Field(default=None, max_length=100)
    assigned_driver_id: uuid.UUID | None = None


class TruckUpdate(BaseModel):
    license_plate: str | None = Field(default=None, min_length=2, max_length=20)
    model: str | None = Field(default=None, max_length=100)
    assigned_driver_id: uuid.UUID | None = None
    is_active: bool | None = None


class TruckOut(TruckBrief):
    assigned_driver: UserBrief | None = None
    has_route_today: bool = False
    route_status_today: RouteStatus | None = None


# ------------------------------------------------------------------- users ---
class UserCreate(BaseModel):
    user_cedula: str = Field(min_length=3, max_length=32)
    full_name: str = Field(min_length=3, max_length=200)
    role: Role
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=200)
    role: Role | None = None
    is_active: bool | None = None


class PinResetRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class UserOut(UserBrief):
    model_config = ConfigDict(from_attributes=True)

    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


# ---------------------------------------------------------------- products ---
class ProductCreate(BaseModel):
    barcode_qr: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=300)
    unit: str = Field(default="UNIT", max_length=20)
    weight: float = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    barcode_qr: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1, max_length=300)
    unit: str | None = Field(default=None, max_length=20)
    weight: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ProductBrief):
    model_config = ConfigDict(from_attributes=True)

    is_active: bool
    created_at: datetime


class ImportResult(BaseModel):
    total_rows: int
    created: int
    updated: int
    errors: list[str] = []


# ------------------------------------------------------------------ routes ---
class RouteCreate(BaseModel):
    truck_id: uuid.UUID
    route_date: date
    driver_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)


class RouteCounts(BaseModel):
    lines: int = 0
    assigned_units: int = 0
    delivered_units: int = 0
    rejected_lines: int = 0
    in_truck_lines: int = 0
    completion_pct: float = 0.0


class RouteOut(BaseModel):
    id: uuid.UUID
    route_date: date
    status: RouteStatus
    notes: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    truck: TruckBrief | None = None
    driver: UserBrief | None = None
    counts: RouteCounts = RouteCounts()


class RouteDetailAssign(BaseModel):
    product_id: uuid.UUID
    assigned_quantity: int = Field(ge=1, le=100000)


class BulkAssignRequest(BaseModel):
    items: list[RouteDetailAssign] = Field(min_length=1, max_length=2000)


class RouteDetailItem(BaseModel):
    id: uuid.UUID
    product: ProductBrief
    status: DetailStatus
    assigned_quantity: int
    delivered_quantity: int
    return_required: bool = False
    rejection_reason: str | None = None
    last_scan_at: datetime | None = None


class RouteFullOut(RouteOut):
    details: list[RouteDetailItem] = []


# ----------------------------------------------------------------- devices ---
class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_uuid: str
    platform: str | None = None
    app_version: str | None = None
    is_active: bool
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    user: UserBrief | None = None


class LicenseOut(BaseModel):
    license_key: str
    company_name: str
    tax_id: str
    subscription_status: SubscriptionStatus
    expiration_date: str
    days_remaining: int
    expiring_soon: bool
    expired: bool
    max_trucks: int
    active_devices: int
    device_ttl_days: int
    devices: list[DeviceOut] = []


# --------------------------------------------------------------- security ----
class SecurityEventOut(BaseModel):
    id: uuid.UUID
    event_type: SecurityEventType
    created_at: datetime
    device_uuid: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    detail: dict | None = None
    user: UserBrief | None = None


# --------------------------------------------------------------- platform ----
class CompanyCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tax_id: str = Field(min_length=3, max_length=50)
    max_trucks: int = Field(default=5, ge=1, le=10000)
    expiration_date: date
    admin_cedula: str = Field(min_length=3, max_length=32)
    admin_full_name: str = Field(min_length=3, max_length=200)
    admin_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class CompanyCreatedOut(BaseModel):
    company_id: uuid.UUID
    name: str
    license_key: str
    expiration_date: date
    max_trucks: int
    admin_user_id: uuid.UUID


class CompanyLicenseUpdate(BaseModel):
    subscription_status: SubscriptionStatus | None = None
    expiration_date: date | None = None
    max_trucks: int | None = Field(default=None, ge=1, le=10000)
    is_active: bool | None = None


class CompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    tax_id: str
    license_key: str
    subscription_status: SubscriptionStatus
    expiration_date: date
    max_trucks: int
    is_active: bool
    created_at: datetime
    active_devices: int = 0
    users_count: int = 0
    trucks_count: int = 0


class RejectionCodeOut(BaseModel):
    code: RejectionReasonCode
    label: str
