"""Enumerations shared across models, schemas and services."""

from __future__ import annotations

import enum


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    WAREHOUSE = "WAREHOUSE"
    DRIVER = "DRIVER"


class RouteStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class DetailStatus(str, enum.Enum):
    IN_TRUCK = "IN_TRUCK"
    DELIVERED = "DELIVERED"
    REJECTED = "REJECTED"


class ScanAction(str, enum.Enum):
    LOAD = "LOAD"        # driver confirms item boarded the truck
    DELIVER = "DELIVER"  # item handed to the client
    REJECT = "REJECT"    # failed delivery / damaged -> inventory re-entry


class RejectionReasonCode(str, enum.Enum):
    DAMAGED = "DAMAGED"
    WRONG_ITEM = "WRONG_ITEM"
    CLIENT_REJECTED = "CLIENT_REJECTED"
    NO_ONE_HOME = "NO_ONE_HOME"
    ADDRESS_NOT_FOUND = "ADDRESS_NOT_FOUND"
    OTHER = "OTHER"


class SecurityEventType(str, enum.Enum):
    MOCK_GPS = "MOCK_GPS"                  # mock/fake location detected
    SPEED_ANOMALY = "SPEED_ANOMALY"        # impossible travel between scans
    TIMESTAMP_SKEW = "TIMESTAMP_SKEW"      # device clock ahead of server
    STALE_SCAN = "STALE_SCAN"              # scanned offline for too long
    PIN_LOCKOUT = "PIN_LOCKOUT"            # brute-force protection triggered
    DEVICE_LIMIT = "DEVICE_LIMIT"          # max_trucks device cap hit
    CROSS_TENANT = "CROSS_TENANT"          # license/user tenant mismatch
    MANIFEST_MISMATCH = "MANIFEST_MISMATCH"  # scanned item not in manifest
    DUPLICATE_SCAN = "DUPLICATE_SCAN"      # idempotent replay attempted
    OTHER = "OTHER"
