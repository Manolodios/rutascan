"""First-run setup counts exposed by the dashboard summary."""

from __future__ import annotations

from app.services.dashboard import dashboard_summary


def test_setup_counts_for_configured_company(db, tenant):
    setup = dashboard_summary(db, tenant.company)["setup"]

    assert setup["trucks"] == 1
    assert setup["products"] == 3
    assert setup["team"] == 1  # the driver; the admin does not count as team
    assert setup["routes"] == 1
    assert setup["complete"] is True


def test_setup_is_incomplete_without_team(db, tenant):
    tenant.driver.is_active = False
    db.commit()

    setup = dashboard_summary(db, tenant.company)["setup"]

    assert setup["team"] == 0
    assert setup["complete"] is False
