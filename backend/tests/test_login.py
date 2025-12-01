# backend/tests/test_login.py
# Adjust the import below if your FastAPI app object is in a different module.
# Example alternatives: `from app.main import app` or `from main import app`
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_login_success():
    payload = {"email": "testuser@example.com", "password": "correct_password"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data or "token" in data

def test_login_wrong_password():
    payload = {"email": "testuser@example.com", "password": "bad_pass"}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code in (400, 401)
