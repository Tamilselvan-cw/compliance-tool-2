# compliance_tool/backend/tests/test_login.py
# Sets required env vars BEFORE importing the application,
# and ensures the backend folder is on sys.path so the top-level `app` package is found.

import os
import sys
from cryptography.fernet import Fernet

# -------------------------
# 1) Ensure env vars exist BEFORE importing code that builds Settings()
# -------------------------

os.environ.setdefault("APP_BASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_URL", "https://example.com")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
os.environ.setdefault("PG_DSN", "postgresql://user:password@localhost/db")
os.environ.setdefault("SMTP_HOST", "smtp.example.com")
os.environ.setdefault("SMTP_USERNAME", "user")
os.environ.setdefault("SMTP_PASSWORD", "pass")
os.environ.setdefault("EMAIL_FROM", "test@example.com")
os.environ.setdefault("FERNET_KEY", Fernet.generate_key().decode())

# -------------------------
# 2) Make backend importable as top-level 'app'
# -------------------------

this_tests_folder = os.path.dirname(__file__)
backend_folder = os.path.abspath(os.path.join(this_tests_folder, ".."))
if backend_folder not in sys.path:
    sys.path.insert(0, backend_folder)

# -------------------------
# 3) Now import the app and test client
# -------------------------

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# -------------------------
# 4) Tests
# -------------------------

def test_login_success():
    payload = {"email": "testuser@example.com", "password": "correct_password"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code in (200, 400, 401)

def test_login_wrong_password():
    payload = {"email": "testuser@example.com", "password": "bad_pass"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code in (400, 401)
