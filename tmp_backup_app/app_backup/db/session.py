import psycopg2
from contextlib import contextmanager
from app.config.settings import settings

@contextmanager
def get_conn():
    conn = psycopg2.connect(settings.PG_DSN)
    try:
        yield conn
        conn.commit()
    except:
        conn.rollback()
        raise
    finally:
        conn.close()
