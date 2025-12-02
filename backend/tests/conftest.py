# backend/tests/conftest.py
import pytest

# Replace the following imports/calls with your actual DB/user utilities.
# Example: from backend.models import User; from backend.database import SessionLocal
# The below is a safe placeholder — change to real calls if your project exposes them.
def create_test_user():
    """
    Implement user creation here if your application doesn't provide an in-test fixture.
    If you use SQLAlchemy, create the user via your DB session here.
    """
    # Example pseudo:
    # User.create(email="testuser@example.com", password=hash_password("correct_password"))
    return

@pytest.fixture(scope="module", autouse=True)
def ensure_test_user():
    try:
        create_test_user()
    except Exception:
        # if already exists or creation fails, continue — tests should handle auth failure cases.
        pass
    yield
    # optional teardown: delete user if needed
