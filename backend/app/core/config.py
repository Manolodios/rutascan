"""Application configuration (pydantic-settings, .env aware)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    report_timezone: str = "America/Bogota"  # IANA tz for report date math/display

    # --- Demo data --------------------------------------------------
    seed_demo_data: bool = True

    # ------------------------------------------------------------------
    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins or self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()
