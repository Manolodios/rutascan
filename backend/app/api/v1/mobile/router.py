"""Mobile endpoints: manifest, heartbeat, live scan, atomic batch sync, PoD."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from pathlib import Path
from typing import Literal

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import MobileContext, get_mobile_context
from app.core.config import get_settings
from app.core.geo import utcnow
from app.core.security import create_grace_token
from app.db.session import get_db
from app.models.delivery import DeliveryLog
from app.models.enums import Role
from app.schemas.auth import HeartbeatResponse, LicenseStatusOut
from app.schemas.common import Message
from app.schemas.mobile import (
    PodAttachRequest,
    PodUploadResponse,
    ScanRequest,
    ScanResponse,
    SyncBatchRequest,
    SyncBatchResponse,
    SyncItemResult,
)
from app.services import licensing
from app.services.audit import persist_security_events
from app.services.manifest import build_today_manifest
from app.services.scans import ScanError, process_scan, process_scan_batch

router = APIRouter(prefix="/mobile", tags=["mobile"])

ALLOWED_POD_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}


def _ensure_field_role(ctx: MobileContext) -> None:
    if ctx.user.role not in (Role.DRIVER, Role.WAREHOUSE):
        raise HTTPException(
            status_code=403,
            detail={
                "detail": "La app móvil es exclusiva para conductores y bodega.",
                "code": "FORBIDDEN_ROLE",
            },
        )


# ------------------------------------------------------------------ session --
@router.post("/heartbeat", response_model=HeartbeatResponse)
def heartbeat(
    ctx: MobileContext = Depends(get_mobile_context), db: Session = Depends(get_db)
) -> HeartbeatResponse:
    """Online heartbeat: renews the cached grace token (offline permit)."""
    company = ctx.company
    grace_token, grace_expires = create_grace_token(
        str(company.id), company.license_key, company.name, company.max_trucks
    )
    return HeartbeatResponse(
        server_time_utc=utcnow(),
        license=LicenseStatusOut(**licensing.license_snapshot(db, company)),
        grace_token=grace_token,
        grace_expires_at=grace_expires,
    )


@router.get("/routes/today")
def today_route(
    ctx: MobileContext = Depends(get_mobile_context), db: Session = Depends(get_db)
) -> dict:
    """Driver manifest for today (route + per-item delivery status)."""
    return build_today_manifest(db, ctx.company.id, ctx.user)


# ----------------------------------------------------------------- scanning --
@router.post("/deliveries/scan", response_model=ScanResponse)
def scan(
    payload: ScanRequest,
    ctx: MobileContext = Depends(get_mobile_context),
    db: Session = Depends(get_db),
) -> ScanResponse:
    """Live scan: validates manifest membership, updates status, logs event."""
    _ensure_field_role(ctx)
    try:
        with db.begin_nested():
            outcome = process_scan(
                db,
                company=ctx.company,
                driver=ctx.user,
                device_uuid=ctx.device_uuid,
                payload=payload,
            )
        persist_security_events(db, ctx.company.id, outcome.security_events)
        db.commit()
    except ScanError as exc:
        # Savepoint already rolled back; persist the audit trail, then report.
        persist_security_events(db, ctx.company.id, exc.security_events)
        db.commit()
        raise
    except sa.exc.IntegrityError:
        # Raced duplicate scan_uuid -> idempotent success.
        db.rollback()
        return ScanResponse(
            accepted=True,
            duplicate=True,
            code="ALREADY_SYNCED",
            message="Escaneo ya sincronizado previamente (idempotente).",
        )

    return ScanResponse(
        accepted=True,
        duplicate=outcome.result == "DUPLICATE",
        code=None if outcome.result == "ACCEPTED" else "ALREADY_SYNCED",
        message=outcome.message,
        product_description=outcome.product_description,
        detail_status=outcome.detail_status.value,
        route_completed=outcome.route_completed,
        flags=outcome.flags or None,
    )


@router.post("/deliveries/sync-batch", response_model=SyncBatchResponse)
def sync_batch(
    payload: SyncBatchRequest,
    ctx: MobileContext = Depends(get_mobile_context),
    db: Session = Depends(get_db),
) -> SyncBatchResponse:
    """Flush an offline queue: one atomic transaction, per-item savepoints."""
    _ensure_field_role(ctx)
    try:
        batch, results = process_scan_batch(
            db,
            company=ctx.company,
            driver=ctx.user,
            device_uuid=ctx.device_uuid,
            items=payload.items,
            batch_reference=payload.batch_reference,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return SyncBatchResponse(
        batch_id=batch.id,
        received=batch.received_count,
        accepted=batch.accepted_count,
        rejected=batch.rejected_count,
        duplicates=batch.duplicate_count,
        results=[
            SyncItemResult(
                scan_uuid=r.scan_uuid,
                qr_code=r.qr_code,
                accepted=r.accepted,
                duplicate=r.duplicate,
                code=r.code,
                message=r.message,
                product_description=r.product_description,
                detail_status=r.detail_status,
                route_completed=r.route_completed,
            )
            for r in results
        ],
    )


# ---------------------------------------------------------- proof of delivery -
@router.post("/pod", response_model=PodUploadResponse)
async def upload_pod(
    kind: Literal["signature", "photo"] = Form(...),
    file: UploadFile = File(...),
    ctx: MobileContext = Depends(get_mobile_context),
) -> PodUploadResponse:
    """Store a PoD artifact (signature PNG or evidence photo) and return its URL."""
    settings = get_settings()
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail={
                "detail": f"Archivo excede {settings.max_upload_mb} MB.",
                "code": "FILE_TOO_LARGE",
            },
        )
    if len(data) < 32:
        raise HTTPException(
            status_code=422, detail={"detail": "Archivo vacío o corrupto.", "code": "EMPTY_FILE"}
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    extension = ALLOWED_POD_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(
            status_code=415,
            detail={
                "detail": f"Tipo no soportado: {content_type or 'desconocido'}. Use PNG/JPEG/WEBP.",
                "code": "UNSUPPORTED_MEDIA_TYPE",
            },
        )

    digest = hashlib.sha256(data).hexdigest()
    target_dir = Path(settings.upload_dir) / str(ctx.company.id) / kind
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = (
        f"{kind}_{utcnow().strftime('%Y%m%dT%H%M%S')}_{digest[:12]}_{secrets.token_hex(6)}{extension}"
    )
    (target_dir / filename).write_bytes(data)

    url = f"/uploads/{ctx.company.id}/{kind}/{filename}"
    return PodUploadResponse(
        url=url, kind=kind, size_bytes=len(data), sha256=digest
    )


@router.post("/deliveries/pod-attach", response_model=Message)
def attach_pod(
    payload: PodAttachRequest,
    ctx: MobileContext = Depends(get_mobile_context),
    db: Session = Depends(get_db),
) -> Message:
    """Attach signature/photo URLs to an already-synced scan (by scan_uuid)."""
    _ensure_field_role(ctx)
    for url in (payload.pod_signature_url, payload.pod_photo_url):
        # Solo rutas internas de /uploads: evita que un cliente guarde URLs
        # externas o esquemas peligrosos que luego se muestren en el panel.
        if url and not url.startswith("/uploads/"):
            raise HTTPException(
                status_code=422,
                detail={"detail": "URL de evidencia no válida.", "code": "INVALID_POD_URL"},
            )
    log = db.scalar(
        sa.select(DeliveryLog).where(
            DeliveryLog.scan_uuid == payload.scan_uuid,
            DeliveryLog.company_id == ctx.company.id,
        )
    )
    if log is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Escaneo no encontrado para adjuntar evidencia.", "code": "SCAN_NOT_FOUND"},
        )
    if payload.pod_signature_url:
        log.pod_signature_url = payload.pod_signature_url
    if payload.pod_photo_url:
        log.pod_photo_url = payload.pod_photo_url
    db.commit()
    return Message(detail="Evidencia de entrega adjuntada.", code="POD_ATTACHED")
