"""Public delivery of proof-of-delivery artifacts stored in the database."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.pod import PodFile

router = APIRouter(prefix="/pod", tags=["pod"])


@router.get("/{file_id}")
def get_pod_file(file_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    """Serve a signature/photo by its unguessable UUID.

    No token is required because the panel renders it from an <img> tag. The
    UUID is the capability; there is no listing endpoint.
    """
    pod = db.get(PodFile, file_id)
    if pod is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Evidencia no encontrada.", "code": "POD_NOT_FOUND"},
        )
    return Response(
        content=pod.data,
        media_type=pod.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": pod.sha256,
        },
    )
