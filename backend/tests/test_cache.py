"""La URL de Redis nunca debe llegar a los logs con su contraseña."""

from __future__ import annotations

from app.core.cache import _redact_url


def test_redact_url_oculta_usuario_y_contrasena():
    safe = _redact_url(
        "rediss://default:super-secreta@hopeful-fish-236515.upstash.io:6379"
    )

    assert "super-secreta" not in safe
    assert "default" not in safe
    assert safe == "rediss://hopeful-fish-236515.upstash.io:6379"


def test_redact_url_sin_credenciales_no_cambia():
    assert _redact_url("redis://localhost:6379/0") == "redis://localhost:6379/0"


def test_redact_url_descarta_parametros_y_fragmentos():
    assert (
        _redact_url("redis://host:6379/0?password=secreta#frag")
        == "redis://host:6379/0"
    )


def test_redact_url_invalida_no_filtra_nada():
    assert _redact_url("no-es-una-url") == "redis (URL no válida)"
