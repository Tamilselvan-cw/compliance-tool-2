#!/usr/bin/env bash
set -euo pipefail

# Usage examples:
#   ./scripts/migrate.sh rev "add user.last_login"            # autogenerate revision
#   ./scripts/migrate.sh up                                   # upgrade head
#   ./scripts/migrate.sh down -1                              # downgrade by 1
#   MODELS_PATH=app/modules/employees ./scripts/migrate.sh rev "only employee models"
#   MODELS_PATH=app/modules/employees/models.py ./scripts/migrate.sh rev "single file"
#
# Requires DB_URL env var. Example:
# export DB_URL="postgresql://user:pass@host:5432/dbname"

CMD="${1:-}"
MSG="${2:-}"
EXTRA="${3:-}"

if [[ -z "${DB_URL:-}" ]]; then
  echo "ERROR: DB_URL env var not set."
  echo 'Example: export DB_URL="postgresql://postgres:pass@localhost:5432/postgres"'
  exit 1
fi

case "$CMD" in
  rev|revision)
    if [[ -z "$MSG" ]]; then
      echo "Provide a message: ./scripts/migrate.sh rev \"add users table\""
      exit 1
    fi
    alembic revision --autogenerate -m "$MSG"
    ;;
  up|upgrade)
    alembic upgrade ${MSG:-head}
    ;;
  down|downgrade)
    alembic downgrade ${MSG:--1}
    ;;
  heads)
    alembic heads
    ;;
  current)
    alembic current
    ;;
  stamp)
    # stamp the db with a given revision (no SQL run)
    alembic stamp ${MSG:-head}
    ;;
  *)
    echo "Usage:"
    echo "  ./scripts/migrate.sh rev \"message\"            # generate revision (autogenerate)"
    echo "  ./scripts/migrate.sh up [rev]                  # upgrade (default head)"
    echo "  ./scripts/migrate.sh down [rev or -N]          # downgrade"
    echo "  ./scripts/migrate.sh heads                     # show heads"
    echo "  ./scripts/migrate.sh current                   # show current"
    echo "  ./scripts/migrate.sh stamp [rev]               # stamp without running"
    echo
    echo "Env:"
    echo "  DB_URL        - required"
    echo "  MODELS_PATH   - optional (dir or specific models.py)"
    exit 1
    ;;
esac
