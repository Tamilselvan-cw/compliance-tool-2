from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "Auth API"
    APP_BASE_URL: str  # e.g. http://localhost:8000

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # service role (for privileged DB ops)
    SUPABASE_ANON_KEY: str | None = None

    # --- Database ---
    PG_DSN: str  # e.g. postgres://user:pass@host:5432/db

    # --- Email (SMTP) ---
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str
    EMAIL_FROM_NAME: str = "Your App"

    # --- Security ---
    FERNET_KEY: str  # generate with: Fernet.generate_key().decode()

    # --- CORS (optional, from .env) ---
    ALLOWED_ORIGINS: str | None = None  # 👈 this matches your .env key

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # 👈 don't crash on any other unexpected env vars
    )

settings = Settings()