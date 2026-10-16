"""Mobile API schemas: scans, offline batch sync and proof-of-delivery."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import RejectionReasonCode, ScanAction


class ScanRequest(BaseModel):
    """One physical scan event. scan_uuid is the client-side idempotency key."""

    scan_uuid: str = Field(min_length=8, max_length=64)
    qr_code: str = Field(min_length=1, max_length=255)
    action: ScanAction = ScanAction.DELIVER
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    gps_accuracy_m: float | None = Field(default=None, ge=0, le=10000)
    is_mocked_location: bool = Field(
        default=False,
        description="True when the OS reports a mock/fake GPS provider (Android API).",
    )
    scan_timestamp_utc: datetime = Field(
        description="Device capture time in UTC ISO-8601 (offline scans may be hours old)."
    )
    route_id: uuid.UUID | None = None
    rejection_reason: RejectionReasonCode | None = None
    rejection_notes: str | None = Field(default=None, max_length=500)
    pod_signature_url: str | None = Field(default=None, max_length=500)
    pod_photo_url: str | None = Field(default=None, max_length=500)

    @field_validator("scan_timestamp_utc")
    @classmethod
    def _ensure_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class ScanResponse(BaseModel):
    accepted: bool = True
    duplicate: bool = False
    code: str | None = None
    message: str
    product_description: str | None = None
    detail_status: str | None = None
    route_completed: bool = False
    flags: dict | None = None


class SyncBatchRequest(BaseModel):
    items: list[ScanRequest] = Field(min_length=1, max_length=500)
    batch_reference: str | None = Field(default=None, max_length=64)


class SyncItemResult(BaseModel):
    scan_uuid: str
    qr_code: str
    accepted: bool
    duplicate: bool
    code: str | None = None
    message: str
    product_description: str | None = None
    detail_status: str | None = None
    route_completed: bool = False


class SyncBatchResponse(BaseModel):
    batch_id: uuid.UUID
    received: int
    accepted: int
    rejected: int
    duplicates: int
    results: list[SyncItemResult]


class PodUploadResponse(BaseModel):
    url: str
    kind: str
    size_bytes: int
    sha256: str


class PodAttachRequest(BaseModel):
    """Attach PoD artifacts to an already-synced scan (by idempotency key)."""

    scan_uuid: str = Field(min_length=8, max_length=64)
    pod_signature_url: str | None = Field(default=None, max_length=500)
    pod_photo_url: str | None = Field(default=None, max_length=500)


class MobileProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    barcode_qr: str
    description: str
    unit: str
    weight: float
