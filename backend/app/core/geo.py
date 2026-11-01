"""Geospatial helpers + UTC time utilities (anti-fraud heuristics)."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.core.config import get_settings

EARTH_RADIUS_M = 6_371_000.0


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def local_today() -> date:
    """Fecha de hoy en la zona horaria de la empresa (America/Caracas)."""
    return datetime.now(ZoneInfo(get_settings().report_timezone)).date()


def local_date(value: datetime) -> date:
    """Fecha local (zona horaria de la empresa) de un instante UTC."""
    return ensure_utc(value).astimezone(ZoneInfo(get_settings().report_timezone)).date()


def local_day_start_utc(day: date | None = None) -> datetime:
    """Medianoche local de `day` expresada en UTC (para filtrar escaneos)."""
    tz = ZoneInfo(get_settings().report_timezone)
    start = datetime.combine(day or local_today(), time.min, tzinfo=tz)
    return start.astimezone(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    """Coerce a datetime to aware UTC. Naive values are assumed UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso_utc(value: datetime) -> str:
    return ensure_utc(value).isoformat().replace("+00:00", "Z")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters between two WGS-84 points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def implied_speed_kmh(distance_m: float, seconds: float) -> float:
    if seconds <= 0:
        return float("inf")
    return (distance_m / seconds) * 3.6


def valid_coordinates(lat: float, lon: float) -> bool:
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0
