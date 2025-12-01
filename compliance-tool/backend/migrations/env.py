# migrations/env.py
import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy import pool
import importlib
import os, sys, pathlib

# --- Paths ---
BASE_DIR = pathlib.Path(__file__).resolve().parents[1]
APP_DIR = BASE_DIR / "app"
sys.path.append(str(BASE_DIR))  # so "app.*" imports work

# --- Alembic config ---
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- DB URL via env (alembic.ini -> sqlalchemy.url = %(DB_URL)s) ---
DB_URL = os.environ.get("DB_URL")
if not DB_URL:
    raise RuntimeError("Set DB_URL env var, e.g. postgresql+asyncpg://user:pass@host:5432/dbname")

# If a sync driver was provided, upgrade it to async (for online mode)
if DB_URL.startswith("postgresql://"):
    DB_URL_ASYNC = DB_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DB_URL_ASYNC = DB_URL  # assume already async

def _import_models_from_path(models_path: pathlib.Path):
    """
    Import all models.py under the given path. Path may be a dir (recursive)
    or a single file models.py.
    """
    if models_path.is_file():
        # expecting .../models.py
        rel = models_path.relative_to(BASE_DIR).with_suffix("")
        module_name = ".".join(rel.parts)
        importlib.import_module(module_name)
        return

    # dir mode: walk for **/models.py
    for mp in models_path.rglob("models.py"):
        rel = mp.relative_to(BASE_DIR).with_suffix("")
        module_name = ".".join(rel.parts)
        importlib.import_module(module_name)

def import_all_models():
    """
    Default auto-discovery: app/modules/**/models.py
    Or override with MODELS_PATH (file or directory).
    """
    override = os.environ.get("MODELS_PATH")
    if override:
        p = (BASE_DIR / override).resolve()
        if not p.exists():
            raise RuntimeError(f"MODELS_PATH not found: {p}")
        _import_models_from_path(p)
        return

    # default: app/modules/**/models.py
    modules_dir = APP_DIR / "modules"
    if not modules_dir.exists():
        raise RuntimeError(f"Expected modules dir not found: {modules_dir}")
    for pkg in modules_dir.iterdir():
        if pkg.is_dir():
            mp = pkg / "models.py"
            if mp.exists():
                rel = mp.relative_to(BASE_DIR).with_suffix("")
                module_name = ".".join(rel.parts)
                importlib.import_module(module_name)

# import all models first, then get Base
import_all_models()

from app.db.base import Base  # must expose Base.metadata

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # safer for some dialects
    )
    with context.begin_transaction():
        context.run_migrations()

def _run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode (async)."""
    engine = create_async_engine(DB_URL_ASYNC, poolclass=pool.NullPool, future=True)
    async with engine.connect() as connection:
        await connection.run_sync(_run_migrations)
    await engine.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
