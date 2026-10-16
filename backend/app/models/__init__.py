"""Model registry - importing this package registers all tables on Base.metadata."""

from app.models.company import Company
from app.models.delivery import DeliveryLog, SyncBatch
from app.models.device import Device
from app.models.enums import (
    DetailStatus,
    RejectionReasonCode,
    Role,
    RouteStatus,
    ScanAction,
    SecurityEventType,
    SubscriptionStatus,
)
from app.models.product import Product
from app.models.route import Route, RouteDetail
from app.models.security_event import SecurityEvent
from app.models.truck import Truck
from app.models.user import User

__all__ = [
    "Company",
    "DeliveryLog",
    "SyncBatch",
    "Device",
    "Product",
    "Route",
    "RouteDetail",
    "SecurityEvent",
    "Truck",
    "User",
    "DetailStatus",
    "RejectionReasonCode",
    "Role",
    "RouteStatus",
    "ScanAction",
    "SecurityEventType",
    "SubscriptionStatus",
]
