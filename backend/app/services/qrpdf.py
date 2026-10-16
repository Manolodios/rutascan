"""QR label sheet generation (products, master batch and truck labels)."""

from __future__ import annotations

from io import BytesIO

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas


def qr_png_bytes(data: str, box_size: int = 8, border: int = 1) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_qr_label_sheet(items: list[dict], *, title: str = "RutaScan - Etiquetas QR") -> bytes:
    """Render an A4 sheet of labels.

    items: [{"payload": str, "title": str, "subtitle": str, "kind": str}]
    Layout: 3 columns x 8 rows, 63x33mm labels (standard sticker sheets).
    """
    buffer = BytesIO()
    pdf = pdf_canvas.Canvas(buffer, pagesize=A4)
    page_w, page_h = A4
    margin_x, margin_y = 12 * mm, 14 * mm
    label_w, label_h = 63 * mm, 33 * mm
    cols, rows = 3, 8
    qr_size = 26 * mm

    per_page = cols * rows
    for index, item in enumerate(items):
        slot = index % per_page
        if slot == 0:
            if index > 0:
                pdf.showPage()
            _draw_header(pdf, page_w, page_h, title, page_index=index // per_page + 1)
        col, row = slot % cols, slot // cols
        x = margin_x + col * label_w
        y = page_h - margin_y - (row + 1) * label_h + 2 * mm
        _draw_label(pdf, x, y, label_w, label_h, qr_size, item)

    if not items:
        _draw_header(pdf, page_w, page_h, title, page_index=1)
        pdf.setFont("Helvetica", 11)
        pdf.drawString(margin_x, page_h - 30 * mm, "No hay ítems seleccionados.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _draw_header(pdf, page_w: float, page_h: float, title: str, page_index: int) -> None:
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(12 * mm, page_h - 10 * mm, title)
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(page_w - 12 * mm, page_h - 10 * mm, f"Página {page_index}")
    pdf.setStrokeColorRGB(0.8, 0.8, 0.8)
    pdf.line(12 * mm, page_h - 12 * mm, page_w - 12 * mm, page_h - 12 * mm)


def _draw_label(pdf, x: float, y: float, w: float, h: float, qr_size: float, item: dict) -> None:
    pdf.setStrokeColorRGB(0.88, 0.9, 0.92)
    pdf.roundRect(x + 1 * mm, y + 1 * mm, w - 4 * mm, h - 3 * mm, 2 * mm, stroke=1, fill=0)

    payload = str(item.get("payload", ""))
    pdf.drawImage(
        ImageReader(BytesIO(qr_png_bytes(payload))),
        x + 3 * mm,
        y + 3.5 * mm,
        width=qr_size,
        height=qr_size,
    )

    text_x = x + qr_size + 5 * mm
    max_w = w - qr_size - 9 * mm
    kind = (item.get("kind") or "").upper()
    if kind:
        pdf.setFillColorRGB(0.42, 0.45, 0.5)
        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawString(text_x, y + h - 6 * mm, kind)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Courier-Bold", 8.5)
    pdf.drawString(text_x, y + h - 11 * mm, _clip(payload, 22))
    pdf.setFont("Helvetica", 8)
    title_lines = _wrap(str(item.get("title", "")), 24, 2)
    line_y = y + h - 16 * mm
    for line in title_lines:
        pdf.drawString(text_x, line_y, line)
        line_y -= 3.6 * mm
    subtitle = item.get("subtitle")
    if subtitle:
        pdf.setFillColorRGB(0.42, 0.45, 0.5)
        pdf.setFont("Helvetica-Oblique", 6.5)
        pdf.drawString(text_x, line_y, _clip(str(subtitle), 26))


def _clip(text: str, max_len: int) -> str:
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


def _wrap(text: str, width: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if not lines:
        lines = [""]
    return lines
