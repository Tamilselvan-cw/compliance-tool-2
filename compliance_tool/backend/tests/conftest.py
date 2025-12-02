# compliance_tool/backend/tests/conftest.py
# This sets all required environment variables BEFORE FastAPI app loads.

import os
import pytest

@pytest.fixture(scope="session", autouse=True)
def set_test_env_vars():
    os.environ.setdefault("APP_BASE_URL", "http://localhost")
    os.environ.setdefault("SUPABASE_URL", "https://example.com")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
    os.environ.setdefault("PG_DSN", "postgresql://user:password@localhost/db")
    os.environ.setdefault("SMTP_HOST", "smtp.example.com")
    os.environ.setdefault("SMTP_USERNAME", "user")
    os.environ.setdefault("SMTP_PASSWORD", "pass")
    os.environ.setdefault("EMAIL_FROM", "test@example.com")
    os.environ.setdefault("FERNET_KEY", "0" * 32)
    yield
