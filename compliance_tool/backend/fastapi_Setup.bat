@echo off
REM FastAPI App Setup Script

REM Step 1: Create a virtual environment (if not exists)
IF NOT EXIST ".venv" (
    python -m venv .venv
)

REM Step 2: Activate the virtual environment
CALL .venv\Scripts\activate

REM Step 3: Upgrade pip
python -m pip install --upgrade pip

REM Step 4: Install FastAPI dependencies
IF EXIST "pyproject.toml" (
    REM If poetry is used for pyproject.toml
    pip install poetry
    poetry install
) ELSE (
    REM Fallback: Install FastAPI, Uvicorn, and common deps manually
    pip install fastapi[all] uvicorn[standard] sqlalchemy alembic python-dotenv jinja2
)

REM Step 5: Show success message and next steps
echo.
echo === FastAPI environment setup complete! ===
echo To activate the environment later, run:
echo   .venv\Scripts\activate
echo To start development server, run: 
echo   uvicorn app.main:app --reload
echo.

pause
