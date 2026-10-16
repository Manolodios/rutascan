"""Auth schemas: cedula + PIN login, JWT pair, grace token, heartbeat."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Role, SubscriptionStatus


class LoginRequest(BaseModel):
    cedula: str = Field(min_length=3, max_length=32, description="Documento de identidad")
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$", description="PIN de 4 dígitos")
    device_uuid: str | None = Field(default=None, max_length=64)
    platform: str | None = Field(default=None, max_length=32)
    app_version: str | None = Field(default=None, max_length=32)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_cedula: str
    full_name: str
    role: Role
    is_active: bool


class CompanyPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    tax_id: str
    license_key: str


class LicenseStatusOut(BaseModel):
    license_key: str
    company_name: str
    subscription_status: SubscriptionStatus
    expiration_date: str
    days_remaining: int
    expiring_soon: bool
    expired: bool
    max_trucks: int
    active_devices: int
    device_ttl_days: int


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    user: UserPublic
    company: CompanyPublic | None = None
    license: LicenseStatusOut | None = None
    grace_token: str | None = Field(
        default=None, description="Signed offline permit for the mobile app"
    )
    grace_expires_at: datetime | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class HeartbeatResponse(BaseModel):
    server_time_utc: datetime
    license: LicenseStatusOut
    grace_token: str
    grace_expires_at: datetime
