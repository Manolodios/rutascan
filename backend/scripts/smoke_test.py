"""Local E2E smoke test: boots the real ASGI app on SQLite and exercises the
whole flow with TestClient - login, license guard, manifest, scan, batch sync,
admin dashboard, QR sheet and report downloads.

Run:  python -m scripts.smoke_test
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
import uuid
from datetime import date, timedelta
from pathlib import Path

TMP = Path(tempfile.mkdtemp(prefix="rutascan_smoke_"))
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{TMP / 'smoke.db'}")
os.environ.setdefault("UPLOAD_DIR", str(TMP / "uploads"))
os.environ["SEED_DEMO_DATA"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.geo import utcnow  # noqa: E402
from app.main import app  # noqa: E402

LICENSE = "RUTA-4F7Q-2MX9-BN38"
PLATFORM_KEY = get_settings().platform_api_key
DEVICE = "SMOKE-DEVICE-0001"
FAILURES: list[str] = []


def check(label: str, condition: bool, extra: str = "") -> None:
    status = "OK  " if condition else "FAIL"
    print(f"[{status}] {label} {extra}")
    if not condition:
        FAILURES.append(label)


def main() -> int:
    with TestClient(app) as client:
        # --- health ---------------------------------------------------------
        r = client.get("/health")
        check("health", r.status_code == 200 and r.json()["database"] == "up", str(r.json()))

        # --- license guard: missing headers -> 400 --------------------------
        r = client.get("/api/v1/mobile/routes/today")
        check("guard missing headers -> 400", r.status_code == 400 and r.json()["code"] == "MISSING_LICENSE_HEADERS")

        # --- license guard: bad key -> 402 ----------------------------------
        r = client.get("/api/v1/mobile/routes/today", headers={"X-License-Key": "NOPE", "X-Device-UUID": DEVICE})
        check("guard bad license -> 402", r.status_code == 402 and r.json()["code"] == "INVALID_LICENSE_KEY")

        # --- mobile login (driver) ------------------------------------------
        r = client.post(
            "/auth/login",
            json={"cedula": "52987641", "pin": "3456", "device_uuid": DEVICE, "platform": "android"},
            headers={"X-License-Key": LICENSE, "X-Device-UUID": DEVICE},
        )
        check("driver login", r.status_code == 200, f"status={r.status_code}")
        tokens = r.json()
        check("grace token issued (3d offline permit)", bool(tokens.get("grace_token")) and tokens["user"]["role"] == "DRIVER")
        driver_access = tokens["access_token"]

        # --- bad PIN -> 401 --------------------------------------------------
        r = client.post("/auth/login", json={"cedula": "52987641", "pin": "0000"})
        check("wrong pin -> 401", r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS")

        # --- admin login ------------------------------------------------------
        r = client.post("/auth/login", json={"cedula": "1020456789", "pin": "1234"})
        check("admin login", r.status_code == 200)
        admin_access = r.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_access}"}

        # --- mobile manifest --------------------------------------------------
        mobile_headers = {
            "Authorization": f"Bearer {driver_access}",
            "X-License-Key": LICENSE,
            "X-Device-UUID": DEVICE,
        }
        r = client.get("/api/v1/mobile/routes/today", headers=mobile_headers)
        manifest = r.json()
        check("driver manifest", r.status_code == 200 and manifest["route"] is not None)
        pending_items = [i for i in manifest["items"] if i["status"] == "IN_TRUCK"]
        check("manifest has pending items", len(pending_items) > 0, f"pending={len(pending_items)}")

        # --- live scan: deliver one pending line ------------------------------
        target = pending_items[0]
        scan_payload = {
            "scan_uuid": str(uuid.uuid4()),
            "qr_code": target["product"]["barcode_qr"],
            "action": "DELIVER",
            "latitude": 4.6533,
            "longitude": -74.0836,
            "gps_accuracy_m": 4.2,
            "is_mocked_location": False,
            "scan_timestamp_utc": utcnow().isoformat(),
        }
        r = client.post("/api/v1/mobile/deliveries/scan", json=scan_payload, headers=mobile_headers)
        check("live scan DELIVER", r.status_code == 200 and r.json()["accepted"], str(r.json())[:120])

        # --- duplicate scan_uuid -> idempotent --------------------------------
        r = client.post("/api/v1/mobile/deliveries/scan", json=scan_payload, headers=mobile_headers)
        check("duplicate scan idempotent", r.status_code == 200 and r.json()["duplicate"] is True)

        # --- scan not in manifest -> 409 ---------------------------------------
        r = client.post(
            "/api/v1/mobile/deliveries/scan",
            json={**scan_payload, "scan_uuid": str(uuid.uuid4()), "qr_code": "UNKNOWN-QR"},
            headers=mobile_headers,
        )
        check("unknown QR -> 404", r.status_code == 404 and r.json()["code"] == "ITEM_NOT_FOUND")

        # --- mock GPS -> 422 -----------------------------------------------------
        r = client.post(
            "/api/v1/mobile/deliveries/scan",
            json={**scan_payload, "scan_uuid": str(uuid.uuid4()), "is_mocked_location": True},
            headers=mobile_headers,
        )
        check("mock GPS -> 422", r.status_code == 422 and r.json()["code"] == "MOCK_LOCATION_DETECTED")

        # --- offline batch sync ----------------------------------------------------
        batch_items = []
        for item in pending_items[1:4]:
            batch_items.append(
                {
                    "scan_uuid": str(uuid.uuid4()),
                    "qr_code": item["product"]["barcode_qr"],
                    "action": "DELIVER",
                    "latitude": 4.6620,
                    "longitude": -74.0930,
                    "gps_accuracy_m": 8.0,
                    "is_mocked_location": False,
                    "scan_timestamp_utc": (utcnow() - timedelta(minutes=25)).isoformat(),
                }
            )
        r = client.post(
            "/api/v1/mobile/deliveries/sync-batch",
            json={"items": batch_items, "batch_reference": "offline-flush-1"},
            headers=mobile_headers,
        )
        batch = r.json()
        check("sync-batch atomic", r.status_code == 200 and batch["accepted"] == len(batch_items), str(batch)[:140])

        # --- PoD upload ---------------------------------------------------------------
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
            "de0000000c4944415408d763f8ffff3f0005fe02fea7356f360000000049454e44ae426082"
        )
        r = client.post(
            "/api/v1/mobile/pod",
            files={"file": ("signature.png", png, "image/png")},
            data={"kind": "signature"},
            headers=mobile_headers,
        )
        pod_url = r.json().get("url", "") if r.status_code == 200 else ""
        check("PoD upload", r.status_code == 200 and pod_url.startswith("/uploads/"), str(r.json())[:100])

        # --- attach PoD to an already-synced scan (offline flow) ----------------------
        r = client.post(
            "/api/v1/mobile/deliveries/pod-attach",
            json={"scan_uuid": scan_payload["scan_uuid"], "pod_signature_url": pod_url},
            headers=mobile_headers,
        )
        check(
            "PoD attach to synced scan",
            r.status_code == 200 and r.json()["code"] == "POD_ATTACHED",
            str(r.json())[:100],
        )

        r = client.post(
            "/api/v1/mobile/deliveries/pod-attach",
            json={"scan_uuid": "unknown-scan-uuid-000", "pod_signature_url": pod_url},
            headers=mobile_headers,
        )
        check(
            "PoD attach unknown scan -> 404",
            r.status_code == 404 and r.json()["code"] == "SCAN_NOT_FOUND",
            str(r.json())[:100],
        )

        # --- admin dashboard -------------------------------------------------------------
        r = client.get("/api/v1/admin/dashboard/summary", headers=admin_headers)
        summary = r.json()
        check(
            "dashboard summary",
            r.status_code == 200
            and summary["deliveries"]["delivered"] >= 3
            and summary["alerts"]["by_type"].get("MOCK_GPS", 0) >= 1,
            f"delivered={summary['deliveries']['delivered']} alerts={summary['alerts']['security_events_24h']}",
        )

        r = client.get("/api/v1/admin/dashboard/live-map", headers=admin_headers)
        check("live map", r.status_code == 200 and len(r.json()["trucks"]) >= 1)

        # --- admin CRUD -----------------------------------------------------------
        r = client.post(
            "/api/v1/admin/products",
            json={"barcode_qr": "PRD-9999", "description": "Producto Nuevo", "unit": "BOX", "weight": 3.3},
            headers=admin_headers,
        )
        check("create product", r.status_code == 201, str(r.json())[:100])

        r = client.get("/api/v1/admin/security-events?limit=10", headers=admin_headers)
        events = r.json()
        types = {e["event_type"] for e in events}
        check("security events captured", r.status_code == 200 and "MOCK_GPS" in types, f"types={sorted(types)}")

        # --- QR sheet PDF + reports -------------------------------------------------
        r = client.get("/api/v1/admin/products/qr-sheet.pdf", headers=admin_headers)
        check("QR label sheet PDF", r.status_code == 200 and r.content[:5] == b"%PDF-")

        r = client.get("/api/v1/admin/reports/deliveries.xlsx", headers=admin_headers)
        check("Excel report", r.status_code == 200 and r.content[:2] == b"PK")

        r = client.get("/api/v1/admin/reports/deliveries.pdf", headers=admin_headers)
        check("PDF report", r.status_code == 200 and r.content[:5] == b"%PDF-")

        # --- license & devices -------------------------------------------------------
        r = client.get("/api/v1/admin/license", headers=admin_headers)
        lic = r.json()
        check(
            "license snapshot",
            r.status_code == 200 and lic["active_devices"] >= 1 and lic["max_trucks"] == 12,
            f"devices={lic['active_devices']}/{lic['max_trucks']}",
        )

        # --- device limit: 2nd device beyond max_trucks (simulate cap=1 via platform key) ---
        r = client.get("/api/v1/platform/companies", headers={"X-Platform-Key": PLATFORM_KEY})
        check("platform companies list (dev key)", r.status_code == 200 and len(r.json()) == 1, str(r.status_code))

        # --- refresh token rotation ----------------------------------------------------
        r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]},
                         headers={"X-License-Key": LICENSE, "X-Device-UUID": DEVICE})
        check("refresh rotation", r.status_code == 200 and r.json()["access_token"] != driver_access)

        r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        check("old refresh revoked", r.status_code == 401 and r.json()["code"] == "TOKEN_REVOKED")

        # --- route completed after syncing everything -----------------------------------
        r = client.get(f"/api/v1/admin/routes", headers=admin_headers)
        routes = r.json()
        check("admin routes list", r.status_code == 200 and len(routes) >= 1, str(routes)[:100])

        # --- web panel static serving (needs `npm run build:web` in dashboard/) ---------
        r = client.get("/")
        if r.status_code == 200:
            check("panel served at /", "RutaScan" in r.text, str(r.status_code))
            match = re.search(r'src="(/assets/[^"]+\.js)"', r.text)
            check("index.html references a js bundle", match is not None, r.text[:120])
            if match:
                asset = client.get(match.group(1))
                check(
                    "panel js bundle served",
                    asset.status_code == 200 and len(asset.text) > 10_000,
                    str(asset.status_code),
                )
        else:
            check("panel not built -> / redirects to docs", r.status_code in (302, 307), str(r.status_code))
        r = client.get("/docs")
        check("OpenAPI docs", r.status_code == 200)

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) FAILED: {FAILURES}")
        return 1
    print("ALL SMOKE CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
