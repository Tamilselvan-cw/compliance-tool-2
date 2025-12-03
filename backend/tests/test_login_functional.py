# backend/tests/test_login_functional.py
import os
import uuid
import pytest
import httpx
import time

BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
LOGIN_ENDPOINT = os.getenv("LOGIN_ENDPOINT", "/api/auth/login")
REGISTER_ENDPOINT = os.getenv("REGISTER_ENDPOINT", "/api/auth/register")

CI_EMAIL = os.getenv("TEST_LOGIN_EMAIL")
CI_PASSWORD = os.getenv("TEST_LOGIN_PASSWORD")

def random_email():
    return f"ci_{uuid.uuid4().hex[:8]}@example.com"

@pytest.fixture
def client():
    with httpx.Client(base_url=BASE_URL, timeout=20.0) as c:
        yield c

def assert_generic_auth_error(resp):
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code} {resp.text}"

def test_valid_login(client):
    email = CI_EMAIL or os.getenv("DEV_TEST_EMAIL")
    password = CI_PASSWORD or os.getenv("DEV_TEST_PASSWORD")
    if not email or not password:
        pytest.skip("No TEST_LOGIN_EMAIL/TEST_LOGIN_PASSWORD provided; skipping success test")
    r = client.post(LOGIN_ENDPOINT, json={"email": email, "password": password})
    assert r.status_code == 200, f"Expected 200, got {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data or "token" in data, "No access token returned"

def test_wrong_password(client):
    email = CI_EMAIL or os.getenv("DEV_TEST_EMAIL")
    if not email:
        payload = {"email": random_email(), "password": "wrongpass"}
        r = client.post(LOGIN_ENDPOINT, json=payload)
        assert_generic_auth_error(r)
        return
    r = client.post(LOGIN_ENDPOINT, json={"email": email, "password": "WRONG_PASSWORD_!!"})
    assert_generic_auth_error(r)

def test_unregistered_email_returns_generic_error(client):
    payload = {"email": random_email(), "password": "whatever"}
    r = client.post(LOGIN_ENDPOINT, json=payload)
    assert_generic_auth_error(r)

def test_missing_fields_validation(client):
    r = client.post(LOGIN_ENDPOINT, json={"email": "a@b.com"})
    assert r.status_code in (400, 422)
    r2 = client.post(LOGIN_ENDPOINT, json={"password": "x"})
    assert r2.status_code in (400, 422)

def test_invalid_email_format(client):
    r = client.post(LOGIN_ENDPOINT, json={"email": "not-an-email", "password": "x"})
    assert r.status_code in (400, 422)

def test_long_credentials_do_not_crash(client):
    long_email = f"user_{'x'*5000}@example.com"
    long_pass = "p" * 10000
    r = client.post(LOGIN_ENDPOINT, json={"email": long_email, "password": long_pass})
    assert r.status_code < 500

def test_sql_injection_attempt(client):
    inj = "' OR 1=1 --"
    r = client.post(LOGIN_ENDPOINT, json={"email": inj, "password": inj})
    assert_generic_auth_error(r)

def test_xss_payload(client):
    xss = "<script>alert('x')</script>"
    r = client.post(LOGIN_ENDPOINT, json={"email": xss, "password": xss})
    assert_generic_auth_error(r)

def test_unicode_emoji_handling(client):
    email = f"user{uuid.uuid4().hex}🙂@example.com"
    r = client.post(LOGIN_ENDPOINT, json={"email": email, "password": "p"})
    assert r.status_code < 500
