"""Application configuration (pydantic-settings, .env aware)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores placeholder que vienen de caja. Nunca se permiten en producción.
_PLACEHOLDER_SECRETS = {
    "dev-secret-key-change-me-in-production-0000",
    "platform-dev-key-change-me",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- App -------------------------------------------------------
    app_name: str = "RutaScan API"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # --- Infrastructure --------------------------------------------
    database_url: str = "postgresql+psycopg2://rutascan:rutascan@localhost:5432/rutascan"
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth / tokens ---------------------------------------------
    secret_key: str = "dev-secret-key-change-me-in-production-0000"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480          # 8h - covers a full driver shift
    refresh_token_days: int = 60
    grace_token_days: int = 3                # offline grace window (mobile)

    # --- Licensing / anti-piracy -----------------------------------
    platform_api_key: str = "platform-dev-key-change-me"
    device_ttl_days: int = 14
    pin_max_attempts: int = 5
    pin_lockout_minutes: int = 15
    # Limite por conexion (no por cedula) para frenar el barrido de muchas
    # cuentas desde una misma IP. Solo cuentan los intentos fallidos.
    login_ip_max_attempts: int = 40
    max_timestamp_future_minutes: int = 10
    max_offline_age_days: int = 7
    max_implied_speed_kmh: float = 200.0

    # --- Uploads ----------------------------------------------------
    upload_dir: str = "uploads"
    max_upload_mb: int = 12

    # --- Web / CORS -------------------------------------------------
    web_dir: str = ""                        # if set, static dashboard is mounted at "/"
    cors_origins: str = "*"

    # --- Reporting ---------------------------------------------------
    report_timezone: str = "America/Caracas"  # IANA tz for report date math/display

    # --- Demo data --------------------------------------------------
    seed_demo_data: bool = True
    # Move the demo tenant's dates to "today" on every startup. Only touches the
    # demo licence (DEMO_LICENSE_KEY); a real customer's data is never modified.
    demo_auto_refresh: bool = False

    # ------------------------------------------------------------------
    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins or self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    @model_validator(mode="after")
    def _refuse_weak_secrets_in_production(self) -> "Settings":
        """En producción no se arranca con los secretos placeholder de caja.

        Un SECRET_KEY placeholder permitiría forjar tokens JWT y suplantar a
        cualquier usuario; un PLATFORM_API_KEY placeholder abriría la API de
        plataforma. Preferimos bloquear el arranque antes de servir un request.
        No exigimos longitud mínima para no tumbar despliegues válidos ya en
        marcha; lo ideal es usar claves largas y aleatorias.
        """
        if not self.is_production:
            return self
        weak: list[str] = []
        if not self.secret_key or self.secret_key in _PLACEHOLDER_SECRETS:
            weak.append("SECRET_KEY")
        if not self.platform_api_key or self.platform_api_key in _PLACEHOLDER_SECRETS:
            weak.append("PLATFORM_API_KEY")
        if weak:
            raise ValueError(
                "Configuración insegura: en producción no se permite el secreto "
                "por defecto de caja. Define una variable de entorno fuerte para: "
                + ", ".join(weak) + "."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
