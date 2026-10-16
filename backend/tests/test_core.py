"""Unit tests: PIN hashing, JWT types, geo heuristics, rate limiting."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest

from app.core.cache import check_rate_limit, register_failed_attempt, reset_rate_limit
from app.core.geo import ensure_utc, haversine_m, implied_speed_kmh
from app.core.security import (
    TokenError,
    create_access_token,
    create_grace_token,
    create_refresh_token,
    decode_token,
    hash_pin,
    validate_pin_format,
    verify_pin,
)


def test_pin_hashing_roundtrip():
    pin_hash = hash_pin("1234")
    assert pin_hash != "1234"
    assert verify_pin("1234", pin_hash)
    assert not verify_pin("9999", pin_hash)


def test_pin_format_validation():
    validate_pin_format("0000")
    for bad in ("123", "12345", "12a4", ""):
        with pytest.raises(ValueError):
            validate_pin_format(bad)


def test_jwt_types_and_payload():
    access = create_access_token("user-1", "company-1", "DRIVER")
    refresh = create_refresh_token("user-1", "company-1", "DRIVER")

    claims = decode_token(access, expected_type="access")
    assert claims["sub"] == "user-1"
    assert claims["cid"] == "company-1"
    assert claims["role"] == "DRIVER"

    with pytest.raises(TokenError):
        decode_token(refresh, expected_type="access")

    grace, expires_at = create_grace_token("company-1", "RUTA-TEST", "Test Co", 3)
    grace_claims = decode_token(grace, expected_type="grace")
    assert grace_claims["lic"] == "RUTA-TEST"
    assert grace_claims["max_trucks"] == 3
    remaining = expires_at.timestamp() - time.time()
    assert 2.9 * 86400 < remaining < 3.1 * 86400


def test_jwt_rejects_garbage():
    with pytest.raises(TokenError):
        decode_token("not-a-token", expected_type="access")


def test_haversine_and_speed():
    # ~3186 m between these two points (verified with independent calculation)
    distance = haversine_m(4.6533, -74.0836, 4.6819, -74.0665)
    assert 3650 < distance < 3750
    speed = implied_speed_kmh(distance, 60)
    assert 210 < speed < 235  # >200 km/h in one minute -> anomaly


def test_ensure_utc_naive_is_treated_as_utc():
    from datetime import datetime

    naive = datetime(2026, 1, 1, 12, 0, 0)
    aware = ensure_utc(naive)
    assert aware.tzinfo is not None
    assert aware.utcoffset() == timedelta(0)


def test_memory_rate_limit_window():
    key = f"test-{time.time_ns()}"
    assert check_rate_limit("t", key, 3, 60).allowed
    register_failed_attempt("t", key, 60)
    register_failed_attempt("t", key, 60)
    assert check_rate_limit("t", key, 3, 60).allowed
    register_failed_attempt("t", key, 60)
    result = check_rate_limit("t", key, 3, 60)
    assert not result.allowed
    assert result.retry_after > 0
    reset_rate_limit("t", key)
    assert check_rate_limit("t", key, 3, 60).allowed
