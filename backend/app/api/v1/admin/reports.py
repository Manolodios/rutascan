"""Report exports: Excel + PDF (delivery events and per-route compliance)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_staff
from app.db.session import get_db
from app.models.user import User
from app.services import reports

router = APIRouter(prefix="/reports", tags=["admin:reports"])


def _validate_range(date_from: date, date_to: date) -> None:
    if date_to < date_from:
        raise HTTPException(
            status_code=422,
            detail={"detail": "date_to debe ser >= date_from.", "code": "INVALID_RANGE"},
        )
    if (date_to - date_from).days > 366:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Rango máximo: 366 días.", "code": "RANGE_TOO_WIDE"},
        )


@router.get("/deliveries.xlsx")
def deliveries_xlsx(
    date_from: date = Query(default_factory=lambda: date.today() - timedelta(days=6)),
    date_to: date = Query(default_factory=date.today),
    route_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Response:
    _validate_range(date_from, date_to)
    rows = reports.fetch_delivery_rows(db, user.company_id, date_from, date_to, route_id)
    summary = reports.fetch_route_summary(db, user.company_id, date_from, date_to)
    content = reports.build_deliveries_xlsx(rows, summary, user.company.name)
    filename = f"rutascan_entregas_{date_from}_{date_to}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/deliveries.pdf")
def deliveries_pdf(
    date_from: date = Query(default_factory=lambda: date.today() - timedelta(days=6)),
    date_to: date = Query(default_factory=date.today),
    route_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_staff),
) -> Response:
    _validate_range(date_from, date_to)
    rows = reports.fetch_delivery_rows(db, user.company_id, date_from, date_to, route_id)
    summary = reports.fetch_route_summary(db, user.company_id, date_from, date_to)
    content = reports.build_deliveries_pdf(
        rows, summary, user.company.name, date_from, date_to
    )
    filename = f"rutascan_entregas_{date_from}_{date_to}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
