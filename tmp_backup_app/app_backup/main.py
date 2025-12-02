import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from app.config.settings import settings
from app.routers import api
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title=settings.APP_NAME)

# Static origins for local development
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Dynamic origins from environment
extra_origins_env = os.getenv("ALLOWED_ORIGINS", "")
extra_origins = [o.strip() for o in extra_origins_env.split(",") if o.strip()]

# Final explicit allowed list
ALLOWED_ORIGINS = list(set(DEFAULT_ORIGINS + extra_origins))

# --- IMPORTANT FIX: sslip.io wildcard handled via regex ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r".*(sslip\.io|nip\.io|tre-link\.com)(:\d+)?$",
    # allow any sslip.io or nip.io subdomain with optional port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create /api router and include sub-routers
api_router = APIRouter(prefix="/api")
api_router.include_router(api)
app.include_router(api_router)

@app.get("/health")
def health():
    return {"ok": True}
