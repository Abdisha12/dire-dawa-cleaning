#!/bin/bash
# database/postgresql/migrate-data.sh — Migrate data from MariaDB → PostgreSQL
# Requires: existing MariaDB dump OR running MariaDB container
#
# Option A: From MariaDB dump file (mysqldump output)
#   ./migrate-data.sh --from-dump /path/to/mariadb_dump.sql
#
# Option B: From running MariaDB container (live migration)
#   DB_CONTAINER=ddcms_db_old DB_PASSWORD=... ./migrate-data.sh --live
#
# Option C: Fresh install (no data to migrate, just apply schema)
#   psql -h localhost -U ddcms -d dire_dawa_cleaning -f database/postgresql/schema.sql
#   SEED_PASSWORD=... node database/seed.js
#
# This script handles type conversions:
#   TINYINT(1) → BOOLEAN, ENUM → TEXT/ENUM, DATETIME → TIMESTAMP,
#   AUTO_INCREMENT → SERIAL, JSON → JSONB
#
# For large datasets prefer pgloader:
#   pgloader mysql://user:pass@host/db postgresql://ddcms:pass@localhost/dire_dawa_cleaning

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMP_FILE=""
LIVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-dump) DUMP_FILE="$2"; shift 2 ;;
    --live) LIVE=true; shift ;;
    *) echo "Usage: $0 [--from-dump FILE] [--live]"; exit 1 ;;
  esac
done

echo "=== MariaDB → PostgreSQL Data Migration ==="
echo ""

if [[ -n "$DUMP_FILE" ]]; then
  [[ -f "$DUMP_FILE" ]] || { echo "✗ Dump file not found: $DUMP_FILE"; exit 1; }
  echo "▸ Converting dump: $DUMP_FILE"
  # Use pgloader if available (most accurate)
  if command -v pgloader >/dev/null 2>&1; then
    echo "  Using pgloader..."
    # pgloader handles type mapping automatically; minimal config needed
    cat > /tmp/pgloader_migrate.load <<LOAD
LOAD DATABASE
  FROM mysql://root:${DB_PASSWORD:-}@localhost/${DB_NAME:-dire_dawa_cleaning}
  INTO postgresql://ddcms:${DB_PASSWORD:-}@localhost:5432/${DB_NAME:-dire_dawa_cleaning}
  WITH include drop, create tables, no truncate,
       create indexes, reset sequences
  SET work_mem to '16MB', maintenance_work_mem to '64MB'
  CAST type tinyint when (= 1 tinyint) to boolean drop typemod,
       type datetime to timestamptz drop default using zero-dates-to-null,
       type json to jsonb;
LOAD
    pgloader /tmp/pgloader_migrate.load
    echo "✓ Migration via pgloader complete"
    exit 0
  fi
  # Fallback: manual conversion via sed + psql (for small dumps without pgloader)
  echo "  pgloader not found — falling back to sed conversion (limited)"
  echo "  For best results: sudo pacman -S pgloader  or  apt install pgloader"
  TMP_SQL="/tmp/mariadb_to_pg_$$.sql"
  sed -E \
    -e 's/`/"/g' \
    -e 's/ENGINE=InnoDB[^;]*;//g' \
    -e 's/AUTO_INCREMENT=[0-9]+//g' \
    -e 's/DEFAULT CURRENT_TIMESTAMP/DEFAULT NOW()/g' \
    -e 's/ON UPDATE CURRENT_TIMESTAMP//g' \
    -e 's/TINYINT\(1\)/BOOLEAN/g' \
    -e 's/DATETIME/TIMESTAMP/g' \
    -e "s/ENUM\(/VARCHAR(50) CHECK (/g" \
    "$DUMP_FILE" > "$TMP_SQL"
  echo "  Converted dump at: $TMP_SQL"
  echo "  Review then apply: psql -U ddcms -d dire_dawa_cleaning -f $TMP_SQL"

elif [[ "$LIVE" == true ]]; then
  SRC_CONTAINER="${DB_CONTAINER:-ddcms_db_old}"
  SRC_DB="${DB_NAME:-dire_dawa_cleaning}"
  echo "▸ Live migration from container: $SRC_CONTAINER"
  if ! docker ps --format '{{.Names}}' | grep -q "^${SRC_CONTAINER}$"; then
    echo "✗ Container $SRC_CONTAINER not running"
    echo "  Start old MariaDB: docker compose -f docker-compose.mariadb.yml up -d"
    exit 1
  fi
  DUMP_TMP="/tmp/mariadb_live_dump_$$.sql"
  echo "  Dumping MariaDB..."
  docker exec "$SRC_CONTAINER" mysqldump -u root -p"${DB_PASSWORD}" \
    --single-transaction --no-create-info --skip-triggers --compact \
    "$SRC_DB" > "$DUMP_TMP"
  echo "  Dump saved: $DUMP_TMP"
  echo "  Re-run with --from-dump $DUMP_TMP to convert"
else
  echo "No migration source specified. Options:"
  echo ""
  echo "  Fresh install (recommended if no production data):"
  echo "    docker compose up -d db"
  echo "    psql -h localhost -U ddcms -d dire_dawa_cleaning -f database/postgresql/schema.sql"
  echo "    SEED_PASSWORD=yourpassword node database/seed.js"
  echo ""
  echo "  From MariaDB dump:"
  echo "    ./database/postgresql/migrate-data.sh --from-dump backups/mariadb_dump.sql"
  echo ""
  echo "  Live from running MariaDB container:"
  echo "    ./database/postgresql/migrate-data.sh --live"
  echo ""
  echo "  With pgloader (recommended for large data):"
  echo "    pgloader mysql://root:pass@localhost/dire_dawa_cleaning \\"
  echo "             postgresql://ddcms:pass@localhost/dire_dawa_cleaning"
fi
