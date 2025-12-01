from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

LOGIN_PATCH_PATH = "app.modules.auth.router.login"

def test_login_success(monkeypatch):
    def fake_login(email, password, as_role):
        return ("fake-access", "user-1", email, "superadmin", ["*"], "fake-refresh")
    monkeypatch.setattr(LOGIN_PATCH_PATH, fake_login)

    payload = {"email": "ci-user@example.com", "password": "irrelevant"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["email"] == "ci-user@example.com"

def test_login_permission_error(monkeypatch):
    def fake_login_raise(email, password, as_role):
        raise PermissionError("invalid credentials")
    monkeypatch.setattr(LOGIN_PATCH_PATH, fake_login_raise)

    payload = {"email": "ci-user@example.com", "password": "wrong", "as_role": "user"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code == 403
