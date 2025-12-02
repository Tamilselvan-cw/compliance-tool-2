# app/logging_config.py
import logging, sys

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
logging.basicConfig(
    level=logging.INFO,                   # or DEBUG
    format=LOG_FORMAT,
    handlers=[logging.StreamHandler(sys.stdout)],
)

# optional: turn up library logs while debugging
logging.getLogger("uvicorn.error").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # -> DEBUG when troubleshooting Supabase calls
