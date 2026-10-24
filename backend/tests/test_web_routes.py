"""Public web layout: landing at "/" and the React panel at "/app/"."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_root_serves_landing_not_panel():
    client = TestClient(create_app())
    response = client.get("/")
    assert response.status_code == 200
    assert "/styles.css" in response.text
    assert "/app/assets/" not in response.text
    assert "wa.me/584121640277" in response.text


def test_panel_is_served_under_app():
    client = TestClient(create_app())
    response = client.get("/app/")
    assert response.status_code == 200
    assert "/app/assets/" in response.text
    assert '<div id="root">' in response.text


def test_app_without_slash_redirects():
    client = TestClient(create_app())
    response = client.get("/app", follow_redirects=False)
    assert response.status_code in (307, 308)
    assert response.headers["location"].endswith("/app/")
