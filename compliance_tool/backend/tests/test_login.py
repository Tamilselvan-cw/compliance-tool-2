# compliance_tool/backend/tests/test_login.py
import os
import uuid
import pytest

# If TEST_BASE_URL is set we will use httpx against a real server (CI secrets can set this).
BASE_URL = os.getenv("TEST_BASE_URL")

# Try to import TestClient and the FastAPI app from possible locations
TestClient = None
_fastapi_app = None

try:
    from fastapi.testclient import TestClient as _TC  # type: ignore
    TestClient = _TC
except Exception:
    TestClient = None

# Try several possible import paths for the app (keeps test resilient to package layout)
APP_IMPORT_TRIES = [
    "app.main",                               # common: app/main.py
    "compliance_tool.backend.app.main",       # another possible layout
    "compliance_tool.backend.main",           # alternative
    "compliance_tool.backend.app",            # alternative
]

for modpath in APP_IMPORT_TRIES:
    try:
        module = __import__(modpath, fromlist=["app"])
        # find attribute named 'app' in module or submodules
        if hasattr(module, "app"):
            _fastapi_app = getattr(module, "app")
            break
        # else, maybe module has attribute 'application' or 'create_app'
        if hasattr(module, "application"):
            _fastapi_app = getattr(module, "application")
            break
        if hasattr(module, "create_app"):
            _fastapi_app = getattr(module, "create_app")()
            break
    except Exception:
        _fastapi_app = _fastapi_app  # continue trying

# If we still don't have app but TestClient exists and app import failed,
# later when TestClient is required we will raise assert explaining missing import.

@pytest.fixture
def client():
    # If user set TEST_BASE_URL we want to hit a running server (optional)
    if BASE_URL:
        import httpx
        with httpx.Client(base_url=BASE_URL, timeout=20.0) as c:
            yield c
        return

    # Otherwise run in-process with FastAPI TestClient
    assert TestClient is not None, "fastapi.TestClient not available; add fastapi to test deps"
    assert _fastapi_app is not None, (
        "Could not import FastAPI 'app' from expected locations. "
        "Check your package layout or set TEST_BASE_URL for an external server."
    )
    with TestClient(_fastapi_app) as c:
        yield c
