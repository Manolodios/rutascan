"""Reporting: delivery exports in Excel (openpyxl) and PDF (reportlab)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone
from io import BytesIO
from zoneinfo import ZoneInfo

import sqlalchemy as sa
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.delivery import DeliveryLog
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.truck import Truck
from app.models.user import User


def _resolve_export_tz():
    try:
        return ZoneInfo(get_settings().report_timezone)
    except Exception:  # noqa: BLE001 - missing tzdata on some platforms
        return timezone.utc


EXPORT_TZ = _resolve_export_tz()


def _day_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    start = datetime.combine(date_from, time.min, tzinfo=EXPORT_TZ)
    end = datetime.combine(date_to, time.max, tzinfo=EXPORT_TZ)
    return start, end


def fetch_delivery_rows(
    db: Session,
    company_id: uuid.UUID,
    date_from: date,
    date_to: date,
    route_id: uuid.UUID | None = None,
) -> list[dict]:
    start, end = _day_bounds(date_from, date_to)
    stmt = (
        sa.select(DeliveryLog, RouteDetail, Product, Route, Truck, User)
        .join(RouteDetail, DeliveryLog.route_detail_id == RouteDetail.id)
        .join(Product, RouteDetail.product_id == Product.id)
        .join(Route, RouteDetail.route_id == Route.id)
        .join(Truck, Route.truck_id == Truck.id)
        .join(User, DeliveryLog.driver_id == User.id)
        .where(
            DeliveryLog.company_id == company_id,
            DeliveryLog.server_timestamp_utc >= start,
            DeliveryLog.server_timestamp_utc <= end,
        )
        .order_by(DeliveryLog.server_timestamp_utc.asc())
    )
    if route_id is not None:
        stmt = stmt.where(Route.id == route_id)

    rows: list[dict] = []
    for log, detail, product, route, truck, driver in db.execute(stmt).all():
        local_ts = log.scan_timestamp_utc.astimezone(EXPORT_TZ)
        rows.append(
            {
                "date": route.route_date.isoformat(),
                "route": str(route.id)[:8],
                "truck": truck.license_plate,
                "driver": driver.full_name,
                "barcode": product.barcode_qr,
                "product": product.description,
                "qty": log.quantity,
                "action": log.action.value,
                "detail_status": detail.status.value,
                "scan_utc": log.scan_timestamp_utc.isoformat(),
                "server_utc": log.server_timestamp_utc.isoformat(),
                "scan_local": local_ts.strftime("%Y-%m-%d %H:%M:%S"),
                "lat": round(log.latitude, 6),
                "lon": round(log.longitude, 6),
                "device": log.device_uuid[:12],
                "mock_gps": "SI" if log.is_mocked_location else "",
                "offline": "SI" if log.via_offline_batch else "",
                "flags": ", ".join(f"{k}={v}" for k, v in (log.flags or {}).items()),
                "rejection": log.rejection_reason.value if log.rejection_reason else "",
                "notes": log.rejection_notes or "",
            }
        )
    return rows


def fetch_route_summary(
    db: Session, company_id: uuid.UUID, date_from: date, date_to: date
) -> list[dict]:
    stmt = (
        sa.select(
            Route.route_date,
            Truck.license_plate,
            User.full_name,
            Route.status,
            sa.func.count(sa.distinct(RouteDetail.id)).label("lines"),
            sa.func.coalesce(sa.func.sum(RouteDetail.assigned_quantity), 0).label("assigned"),
            sa.func.coalesce(sa.func.sum(RouteDetail.delivered_quantity), 0).label("delivered"),
        )
        .join(RouteDetail, RouteDetail.route_id == Route.id, isouter=True)
        .join(Truck, Route.truck_id == Truck.id)
        .join(User, Truck.assigned_driver_id == User.id, isouter=True)
        .where(
            Route.company_id == company_id,
            Route.route_date >= date_from,
            Route.route_date <= date_to,
        )
        .group_by(Route.route_date, Truck.license_plate, User.full_name, Route.status, Route.id)
        .order_by(Route.route_date, Truck.license_plate)
    )
    summary = []
    for row in db.execute(stmt).all():
        assigned = int(row.assigned or 0)
        delivered = int(row.delivered or 0)
        summary.append(
            {
                "date": row.route_date.isoformat(),
                "truck": row.license_plate,
                "driver": row.full_name or "—",
                "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                "lines": int(row.lines or 0),
                "assigned": assigned,
                "delivered": delivered,
                "completion_pct": round(delivered / assigned * 100, 1) if assigned else 0.0,
            }
        )
    return summary


# ----------------------------------------------------------------- Excel ----
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value):
    """Evita inyección de fórmulas en Excel.

    openpyxl interpreta como fórmula cualquier texto que empiece por "=", así
    que un nombre de producto o una nota maliciosa se ejecutaría al abrir el
    reporte. Los números no se tocan (lat/lon negativas siguen siendo números).
    """
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


def build_deliveries_xlsx(rows: list[dict], summary: list[dict], company_name: str) -> bytes:
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1E293B")

    ws = wb.active
    ws.title = "Entregas"
    columns = [
        ("date", "Fecha"), ("truck", "Camión"), ("driver", "Conductor"),
        ("route", "Ruta"), ("barcode", "Código"), ("product", "Producto"),
        ("qty", "Cant."), ("action", "Acción"), ("detail_status", "Estado"),
        ("scan_local", "Escaneo (local)"), ("scan_utc", "Escaneo (UTC)"),
        ("lat", "Lat"), ("lon", "Lon"), ("device", "Dispositivo"),
        ("mock_gps", "GPS Falso"), ("offline", "Offline"), ("flags", "Señales"),
        ("rejection", "Rechazo"), ("notes", "Notas"),
    ]
    ws.append([c[1] for c in columns])
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    for row in rows:
        ws.append([_cell(row.get(c[0], "")) for c in columns])
    for idx, (key, label) in enumerate(columns, start=1):
        width = max(10, min(38, max([len(label)] + [len(str(r.get(key, ""))) for r in rows[:200]] or [10]) + 2))
        ws.column_dimensions[get_column_letter(idx)].width = width
    ws.freeze_panes = "A2"

    ws2 = wb.create_sheet("Resumen por ruta")
    cols2 = [
        ("date", "Fecha"), ("truck", "Camión"), ("driver", "Conductor"),
        ("status", "Estado"), ("lines", "Líneas"), ("assigned", "Asignadas"),
        ("delivered", "Entregadas"), ("completion_pct", "% Cumplimiento"),
    ]
    ws2.append([c[1] for c in cols2])
    for cell in ws2[1]:
        cell.font = header_font
        cell.fill = header_fill
    for row in summary:
        ws2.append([_cell(row.get(c[0], "")) for c in cols2])
    for idx, (key, label) in enumerate(cols2, start=1):
        ws2.column_dimensions[get_column_letter(idx)].width = 22

    ws3 = wb.create_sheet("Info")
    ws3.append(["Empresa", _cell(company_name)])
    ws3.append(["Generado (UTC)", datetime.utcnow().isoformat() + "Z"])
    ws3.append(["Total eventos", len(rows)])
    ws3.append(["Zona horaria reporte", str(EXPORT_TZ)])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


# ------------------------------------------------------------------ PDF -----
def build_deliveries_pdf(
    rows: list[dict],
    summary: list[dict],
    company_name: str,
    date_from: date,
    date_to: date,
) -> bytes:
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"RutaScan - Reporte de entregas {date_from} a {date_to}",
    )
    elements = [
        Paragraph(f"<b>RutaScan</b> · Reporte de entregas", styles["Title"]),
        Paragraph(
            f"{company_name} · {date_from.isoformat()} → {date_to.isoformat()} · "
            f"{len(rows)} eventos",
            styles["Normal"],
        ),
        Spacer(1, 6 * mm),
    ]

    summary_data = [["Fecha", "Camión", "Conductor", "Estado", "Líneas", "Asignadas", "Entregadas", "%"]]
    for s in summary[:40]:
        summary_data.append(
            [
                s["date"], s["truck"], s["driver"][:26], s["status"],
                s["lines"], s["assigned"], s["delivered"], f'{s["completion_pct"]}%',
            ]
        )
    if len(summary_data) == 1:
        summary_data.append(["—", "—", "—", "—", 0, 0, 0, "0%"])
    elements.append(Paragraph("<b>Cumplimiento por ruta</b>", styles["Heading3"]))
    elements.append(_styled_table(summary_data, header_bg=colors.HexColor("#0f172a")))
    elements.append(Spacer(1, 8 * mm))

    detail_data = [["Fecha", "Camión", "Producto", "Código", "Acción", "Hora (local)", "Lat", "Lon", "Señales"]]
    for r in rows[:600]:
        detail_data.append(
            [
                r["date"], r["truck"], r["product"][:30], r["barcode"][:18],
                r["action"], r["scan_local"][11:19], r["lat"], r["lon"], r["flags"][:26],
            ]
        )
    elements.append(Paragraph("<b>Detalle de escaneos</b>", styles["Heading3"]))
    elements.append(_styled_table(detail_data, header_bg=colors.HexColor("#1d4ed8")))
    if len(rows) > 600:
        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph(f"Mostrando 600 de {len(rows)} eventos. Use el export Excel para el detalle completo.", styles["Italic"]))

    doc.build(elements)
    return buffer.getvalue()


def _styled_table(data: list[list], header_bg: colors.Color) -> Table:
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_bg),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table
