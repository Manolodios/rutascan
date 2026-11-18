"""PoD evidence is stored in the database, not on Render's ephemeral disk."""

from __future__ import annotations

import asyncio
import io
import uuid

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw
from starlette.datastructures import Headers

from app.api.deps import MobileContext
from app.api.v1.mobile.router import attach_pod, upload_pod
from app.api.v1.pod import get_pod_file
from app.core.geo import utcnow
from app.models import DeliveryLog, PodFile, ScanAction
from app.schemas.mobile import PodAttachRequest


def _png(width: int = 2400, height: int = 1800, *, transparent: bool = False) -> bytes:
    mode = "RGBA" if transparent else "RGB"
    color = (255, 255, 255, 0) if transparent else (245, 245, 245)
    image = Image.new(mode, (width, height), color)
    draw = ImageDraw.Draw(image)
    for offset in range(0, width, 40):
        draw.line(
            (offset, 0, width - offset, height),
            fill=(offset % 255, 80, 140, 255) if transparent else (offset % 255, 80, 140),
            width=4,
        )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _ctx(tenant) -> MobileContext:
    return MobileContext(
        company=tenant.company,
        user=tenant.driver,
        device_uuid="TEST-DEVICE",
        device=None,  # type: ignore[arg-type]
    )


def _upload(db, tenant, data: bytes, *, kind: str, content_type: str = "image/png"):
    upload = UploadFile(
        filename=f"{kind}.png",
        file=io.BytesIO(data),
        headers=Headers({"content-type": content_type}),
    )
    return asyncio.run(upload_pod(kind=kind, file=upload, ctx=_ctx(tenant), db=db))


def test_photo_is_compressed_and_served_from_the_database(db, tenant):
    original = _png()
    response = _upload(db, tenant, original, kind="photo")

    assert response.url.startswith("/api/v1/pod/")
    file_id = uuid.UUID(response.url.rsplit("/", 1)[-1])
    pod = db.get(PodFile, file_id)
    assert pod is not None
    assert pod.company_id == tenant.company.id
    assert pod.kind == "photo"
    assert pod.content_type == "image/jpeg"
    assert pod.size_bytes == len(pod.data)
    # La foto se reduce a un máximo de 1600 px antes de tocar la base.
    stored = Image.open(io.BytesIO(pod.data))
    assert max(stored.size) <= 1600

    served = get_pod_file(file_id, db=db)
    assert served.body == pod.data
    assert served.media_type == "image/jpeg"
    assert served.headers["etag"] == pod.sha256


def test_signature_keeps_png_format(db, tenant):
    response = _upload(db, tenant, _png(1200, 600, transparent=True), kind="signature")

    pod = db.get(PodFile, uuid.UUID(response.url.rsplit("/", 1)[-1]))
    assert pod is not None
    assert pod.content_type == "image/png"


def test_upload_rejects_non_image_bytes(db, tenant):
    with pytest.raises(HTTPException) as exc:
        _upload(db, tenant, b"esto no es una imagen" * 10, kind="photo")

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "INVALID_POD_IMAGE"


def test_upload_rejects_unsupported_content_type(db, tenant):
    with pytest.raises(HTTPException) as exc:
        _upload(db, tenant, _png(), kind="photo", content_type="application/pdf")

    assert exc.value.status_code == 415
    assert exc.value.detail["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_attach_accepts_database_evidence_url(db, tenant):
    response = _upload(db, tenant, _png(800, 600), kind="photo")
    log = DeliveryLog(
        company_id=tenant.company.id,
        route_detail_id=tenant.detail_a.id,
        driver_id=tenant.driver.id,
        scan_uuid=f"pod-{uuid.uuid4()}",
        action=ScanAction.DELIVER,
        quantity=1,
        scan_timestamp_utc=utcnow(),
        server_timestamp_utc=utcnow(),
        latitude=10.399,
        longitude=-71.436,
        device_uuid="TEST-DEVICE",
    )
    db.add(log)
    db.commit()

    message = attach_pod(
        PodAttachRequest(scan_uuid=log.scan_uuid, pod_photo_url=response.url),
        ctx=_ctx(tenant),
        db=db,
    )

    assert message.code == "POD_ATTACHED"
    db.refresh(log)
    assert log.pod_photo_url == response.url


def test_attach_still_rejects_external_urls(db, tenant):
    log = DeliveryLog(
        company_id=tenant.company.id,
        route_detail_id=tenant.detail_a.id,
        driver_id=tenant.driver.id,
        scan_uuid=f"pod-{uuid.uuid4()}",
        action=ScanAction.DELIVER,
        quantity=1,
        scan_timestamp_utc=utcnow(),
        server_timestamp_utc=utcnow(),
        latitude=10.399,
        longitude=-71.436,
        device_uuid="TEST-DEVICE",
    )
    db.add(log)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        attach_pod(
            PodAttachRequest(
                scan_uuid=log.scan_uuid,
                pod_photo_url="https://evil.example/foto.jpg",
            ),
            ctx=_ctx(tenant),
            db=db,
        )

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "INVALID_POD_URL"
