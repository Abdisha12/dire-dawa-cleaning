#!/bin/bash
# scripts/db-health-check.sh — PostgreSQL + PostGIS health check
# Usage: ./scripts/db-health-check.sh

set -euo pipefail

# Configuration
DB_CONTAINER="${1:-ddcms_db}"
DB_NAME="${2:-dire_dawa_cleaning}"
DB_USER="${3:-ddcms}"

echo "=== PostgreSQL + PostGIS Health Check ==="
echo "Checking container: ${DB_CONTAINER}"
echo "Database: ${DB_NAME}"
echo "User: ${DB_USER}"
echo ""

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "✗ Container ${DB_CONTAINER} not running"
  exit 1
fi

echo "✓ Container ${DB_CONTAINER} is running"
echo ""

# Check PostgreSQL connectivity
echo "--- PostgreSQL Connectivity ---"
HEALTH_OUTPUT=$(docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" 2>&1)
echo "$HEALTH_OUTPUT"

# Check PostGIS extension
echo ""
echo "--- PostGIS Extension ---"
POSTGIS_RESULT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT POSTGIS_Version()" 2>/dev/null | xargs)
if [ -n "$POSTGIS_RESULT" ]; then
  echo "✓ PostGIS version: ${POSTGIS_RESULT}"
else
  echo "✗ PostGIS version check failed"
fi

# Check required extensions
echo ""
echo "--- Required Extensions ---"
EXT_RESULT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','postgis_legacy','uuid-ossp');" 2>/dev/null | xargs)
echo "$EXT_RESULT"

# Check spatial indexes exist on key tables
echo ""
echo "--- Spatial Index Verification ---"
for idx in idx_kebele_boundary idx_zone_boundary idx_business_location idx_inspection_location idx_worker_location; do
  COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_class WHERE relname = '$idx';" 2>/dev/null | xargs)
  if [ "$COUNT" = "1" ]; then
    echo "✓ Spatial index ${idx} exists"
  else
    echo "✗ Spatial index ${idx} missing"
  fi
done

# Check critical table indexes
echo ""
echo "--- Critical Table Indexes ---"
for idx in idx_kebele_collector idx_sz_kebele idx_payments_year_month_status idx_attendance_worker_date; do
  COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_class WHERE relname = '$idx';" 2>/dev/null | xargs)
  if [ "$COUNT" = "1" ]; then
    echo "✓ Index ${idx} exists"
  else
    echo "✗ Index ${idx} missing"
  fi
done

# Check enums are correct
echo ""
echo "--- Role Enum Validation ---"
ROLE_RESULT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT enum_range(NULL::user_role);" 2>/dev/null | xargs)
echo "user_role enum: ${ROLE_RESULT}"

echo ""
echo "=== Health Check Complete ==="
