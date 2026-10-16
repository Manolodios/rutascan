"""Bulk product import from CSV or Excel (warehouse/admin)."""

from __future__ import annotations

import csv
import io
from decimal import Decimal, InvalidOperation

from openpyxl import load_workbook

REQUIRED_HEADERS = {"barcode_qr", "description"}
OPTIONAL_HEADERS = {"unit", "weight", "is_active"}


class ImportError_(Exception):
    """Raised when the uploaded file cannot be parsed at all."""


def parse_products_file(filename: str, content: bytes) -> list[dict]:
    """Returns normalized rows: [{barcode_qr, description, unit, weight}]."""
    name = (filename or "").lower()
    if name.endswith((".xlsx", ".xlsm")):
        return _parse_xlsx(content)
    return _parse_csv(content)


def _normalize_row(raw: dict, row_number: int) -> dict:
    barcode = str(raw.get("barcode_qr") or raw.get("barcode") or raw.get("codigo") or "").strip()
    description = str(raw.get("description") or raw.get("descripcion") or "").strip()
    if not barcode:
        raise ValueError(f"Fila {row_number}: barcode_qr vacío.")
    if not description:
        raise ValueError(f"Fila {row_number}: description vacía.")
    unit = str(raw.get("unit") or raw.get("unidad") or "UNIT").strip() or "UNIT"
    weight_raw = raw.get("weight") or raw.get("peso") or 0
    try:
        weight = Decimal(str(weight_raw).replace(",", ".") or "0")
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Fila {row_number}: weight inválido ({weight_raw!r}).") from exc
    return {
        "barcode_qr": barcode[:255],
        "description": description[:300],
        "unit": unit[:20].upper(),
        "weight": weight,
    }


def _parse_csv(content: bytes) -> list[dict]:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover
        raise ImportError_("No se pudo decodificar el archivo CSV.")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ImportError_("El CSV no tiene encabezados.")

    headers = {h.strip().lower() for h in reader.fieldnames if h}
    if not REQUIRED_HEADERS.issubset(headers):
        raise ImportError_(
            f"Encabezados requeridos: {sorted(REQUIRED_HEADERS)}. Recibidos: {sorted(headers)}."
        )

    rows: list[dict] = []
    for idx, raw in enumerate(reader, start=2):
        cleaned = {(k or "").strip().lower(): v for k, v in raw.items()}
        if not any((v or "").strip() for v in cleaned.values() if isinstance(v, str)):
            continue
        rows.append(_normalize_row(cleaned, idx))
    return rows


def _parse_xlsx(content: bytes) -> list[dict]:
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise ImportError_(f"No se pudo leer el archivo Excel: {exc}") from exc
    sheet = workbook.active
    iterator = sheet.iter_rows(values_only=True)
    try:
        header_row = next(iterator)
    except StopIteration as exc:
        raise ImportError_("El archivo Excel está vacío.") from exc

    headers = [str(h or "").strip().lower() for h in header_row]
    if not REQUIRED_HEADERS.issubset(set(headers)):
        raise ImportError_(
            f"Encabezados requeridos: {sorted(REQUIRED_HEADERS)}. Recibidos: {headers}."
        )

    rows: list[dict] = []
    for idx, values in enumerate(iterator, start=2):
        if values is None or all(v in (None, "") for v in values):
            continue
        raw = {headers[i]: values[i] for i in range(min(len(headers), len(values)))}
        rows.append(_normalize_row(raw, idx))
    return rows


CSV_TEMPLATE = (
    "barcode_qr,description,unit,weight\n"
    "PRD-0001,Caja de leche 1L x12,BOX,12.5\n"
    "PRD-0002,Agua mineral 600ml x24,PACK,14.4\n"
)
