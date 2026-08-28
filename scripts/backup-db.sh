#!/bin/bash
# scripts/backup-db.sh — PostgreSQL database backup script
# Usage:
#   ./scripts/backup-db.sh              # Full backup
#   ./scripts/backup-db.sh --verify     # Backup + verify restoration
#   ./scripts/backup-db.sh --restore FILE  # Restore from backup
#
# Environment variables:
#   DB_CONTAINER  — Container name (default: ddcms_db)
#   DB_NAME       — Database name (default: dire_dawa_cleaning)
#   DB_USER       — Database user (default: ddcms)
#   BACKUP_DIR    — Backup storage directory (default: ./backups)
#   RETENTION_DAYS — Days to keep backups (default: 30)

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-ddcms_db}"
DB_NAME="${DB_NAME:-dire_dawa_cleaning}"
DB_USER="${DB_USER:-ddcms}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Prerequisites ──────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || err "docker not found"
docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$" || err "Container ${DB_CONTAINER} not running"

# ── Full backup ────────────────────────────────────────────────
do_backup() {
  mkdir -p "$BACKUP_DIR"
  echo "Backing up ${DB_NAME} from ${DB_CONTAINER}..."
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
    | gzip > "$BACKUP_FILE"

  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup saved: ${BACKUP_FILE} (${SIZE})"
}

# ── Verify restoration ─────────────────────────────────────────
do_verify() {
  echo "Verifying backup restoration..."
  VERIFY_CONTAINER="ddcms_verify_$$"
  VERIFY_PORT=5433

  docker run -d --name "$VERIFY_CONTAINER" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD=verify_test \
    -e POSTGRES_DB="${DB_NAME}_verify" \
    -p ${VERIFY_PORT}:5432 \
    postgis/postgis:16-3.4 >/dev/null 2>&1

  sleep 15  # Wait for PostgreSQL to initialize

  # Restore backup
  gunzip -c "$BACKUP_FILE" | docker exec -i "$VERIFY_CONTAINER" \
    psql -U "$DB_USER" -d "${DB_NAME}_verify" >/dev/null 2>&1

  # Verify tables exist
  TABLE_COUNT=$(docker exec "$VERIFY_CONTAINER" \
    psql -U "$DB_USER" -d "${DB_NAME}_verify" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')

  docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1

  if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
    log "Verification passed: ${TABLE_COUNT} tables restored successfully"
  else
    err "Verification FAILED: no tables found after restoration"
  fi
}

# ── Restore from file ──────────────────────────────────────────
do_restore() {
  local RESTORE_FILE="$1"
  [ -f "$RESTORE_FILE" ] || err "Backup file not found: $RESTORE_FILE"

  warn "This will OVERWRITE the current database!"
  read -p "Type 'RESTORE' to confirm: " CONFIRM
  [ "$CONFIRM" = "RESTORE" ] || err "Aborted"

  echo "Restoring from ${RESTORE_FILE}..."
  gunzip -c "$RESTORE_FILE" | docker exec -i "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1
  log "Restore complete"
}

# ── Cleanup old backups ────────────────────────────────────────
do_cleanup() {
  DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
  [ "$DELETED" -gt 0 ] && log "Cleaned up ${DELETED} old backup(s)" || true
}

# ── CLI ────────────────────────────────────────────────────────
case "${1:-}" in
  --verify)
    do_backup
    do_verify
    ;;
  --restore)
    [ -z "${2:-}" ] && err "Usage: $0 --restore <backup_file>"
    do_restore "$2"
    ;;
  --cleanup)
    do_cleanup
    ;;
  *)
    do_backup
    do_cleanup
    ;;
esac
