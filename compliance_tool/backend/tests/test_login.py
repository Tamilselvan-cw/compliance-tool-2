import os
import uuid
import pytest
import httpx

BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
LOGIN_ENDPOINT = "/api/auth/login"

TEST_EMAIL = os.getenv("TEST_LOGIN_EMAIL", "shibhu.codewents@gmail.com")
TEST_PASSWORD = os.getenv("TEST_LOGIN_PASSWORD", "NVMptqVht_CUctnf")

@pytest.fixture
def client():
    with httpx.Client(base_url=BASE_URL, timeout=20.0) as c:
        yield c

def assert_generic_auth_error(resp):
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code} {resp.text}"

def test_login_success(client):
    payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    r = client.post(LOGIN_ENDPOINT, json=payload)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "user_id" in data
    assert "email" in data
    assert "role" in data
    assert "permissions" in data and isinstance(data["permissions"], list)

def test_login_wrong_password(client):
    payload = {"email": TEST_EMAIL, "password": "WRONG_PASSWORD_123"}
    r = client.post(LOGIN_ENDPOINT, json=payload)
    assert_generic_auth_error(r)

def test_login_unregistered_email(client):
    payload = {"email": f"no_user_{uuid.uuid4().hex}@gmail.com", "password": "whatever"}
    r = client.post(LOGIN_ENDPOINT, json=payload)
    assert_generic_auth_error(r)
