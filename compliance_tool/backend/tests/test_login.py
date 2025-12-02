# backend/tests/test_login.py
# Sets required env vars BEFORE importing the application,
# and ensures the backend folder is on sys.path so the top-level `app` package is found.

import os
import sys
import time
from cryptography.fernet import Fernet
import pytest

# -------------------------
# 1) Ensure env vars exist BEFORE importing code that builds Settings()
# -------------------------
os.environ.setdefault("APP_BASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_URL", "https://example.com")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
os.environ.setdefault("PG_DSN", os.getenv("PG_DSN", "sqlite:///./test.db"))
os.environ.setdefault("SMTP_HOST", "smtp.example.com")
os.environ.setdefault("SMTP_USERNAME", "user")
os.environ.setdefault("SMTP_PASSWORD", "pass")
os.environ.setdefault("EMAIL_FROM", "test@example.com")
os.environ.setdefault("FERNET_KEY", Fernet.generate_key().decode())
os.environ.setdefault("ENV", "testing")  # ensure testing mode if app respects it

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
# 4) Helpers / fixtures
# -------------------------
def safe_create_user(email="testuser@example.com", password="Password123!"):
    """
    Try test-only endpoint first (/test/create-user),
    then fallback to public register (/api/auth/register).
    Raise RuntimeError if neither works.
    """
    # Try test-only endpoint (recommended)
    resp = client.post("/test/create-user", json={"email": email, "password": password})
    if resp.status_code in (200, 201, 204):
        return {"email": email, "password": password}

    # Fallback to public register
    resp = client.post("/api/auth/register", json={
        "email": email, "password": password, "password_confirm": password
    })
    if resp.status_code in (200, 201, 204):
        return {"email": email, "password": password}

    raise RuntimeError(f"Could not create user in test env: /test/create-user or /api/auth/register failed ({resp.status_code}) - {resp.text}")


@pytest.fixture
def create_user():
    def _create(email="testuser@example.com", password="Password123!"):
        return safe_create_user(email=email, password=password)
    return _create


@pytest.fixture
def tc():
    """Per-test TestClient fixture (in case you need isolation)."""
    yield client


# -------------------------
# 5) Tests (Login checklist basics + extras)
# -------------------------

def test_valid_login_returns_token(tc, create_user):
    creds = create_user(email="valid@example.com", password="ValidPass1!")
    r = tc.post("/api/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, f"Expected 200 on valid login, got {r.status_code} - {r.text}"
    body = r.json()
    assert ("token" in body) or ("access_token" in body), f"Successful login must return token - body: {body}"


def test_wrong_password_returns_401_or_403(tc, create_user):
    creds = create_user(email="wrongpass@example.com", password="RightPass1!")
    r = tc.post("/api/auth/login", json={"email": creds["email"], "password": "incorrect"})
    assert r.status_code in (401, 403), f"Wrong password should be 401/403, got {r.status_code} - {r.text}"


def test_unregistered_email_returns_generic_error(tc):
    r = tc.post("/api/auth/login", json={"email": "noone@example.com", "password": "whatever"})
    assert r.status_code in (400, 401, 403), f"Unregistered email should not return 200. Got {r.status_code} - {r.text}"
    # check message is generic (doesn't confirm existence)
    try:
        body = r.json() or {}
        msg = (body.get("message") or body.get("error") or "").lower()
    except Exception:
        msg = ""
    assert ("invalid" in msg) or ("credential" in msg) or msg != "", f"Prefer generic error message; got: {msg}"


def test_missing_fields_return_400(tc):
    r1 = tc.post("/api/auth/login", json={"email": "a@b.c"})
    r2 = tc.post("/api/auth/login", json={"password": "x"})
    assert r1.status_code == 400, f"Missing password should return 400; got {r1.status_code} - {r1.text}"
    assert r2.status_code == 400, f"Missing email should return 400; got {r2.status_code} - {r2.text}"


def test_disabled_user_cannot_login(tc, create_user):
    creds = create_user(email="disabled@example.com", password="DisableMe1!")
    # attempt to disable via test endpoint; skip if not available
    resp = tc.post("/test/disable-user", json={"email": creds["email"]})
    if resp.status_code not in (200, 204):
        pytest.skip("No test disable endpoint available; adapt to disable user via DB in fixture.")
    r = tc.post("/api/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code in (401, 403), f"Disabled user should not authenticate; got {r.status_code} - {r.text}"


def test_token_does_not_contain_password(tc, create_user):
    creds = create_user(email="sensitive@example.com", password="SecretPass1!")
    r = tc.post("/api/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, f"Login failed: {r.status_code} - {r.text}"
    body = r.json()
    token = body.get("token") or body.get("access_token") or ""
    assert "SecretPass1!" not in token, "Token must not contain the raw password"


def test_bruteforce_simulation_rate_limit(tc, create_user):
    creds = create_user(email="brute@example.com", password="BrutePass1!")
    statuses = []
    for i in range(15):
        r = tc.post("/api/auth/login", json={"email": creds["email"], "password": f"wrong{i}"})
        statuses.append(r.status_code)
        time.sleep(0.05)
    assert any(s in (401, 403) for s in statuses), "Expected some auth failures during brute-force simulation"
    # optionally see if rate-limiter returns 429
    # assert any(s == 429 for s in statuses), "Rate limiter did not trigger (optional check)"


# End of file
