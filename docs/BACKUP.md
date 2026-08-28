# Database Backup & Restore

## Overview

The Dire Dawa Cleaning system stores all operational data in PostgreSQL + PostGIS. Regular backups are
critical for disaster recovery. This document describes backup procedures, restoration, and
retention policies.

## Backup Location

Backups are stored in `./backups/` (relative to project root). This directory is NOT
committed to git. Add it to `.gitignore` if not already present.

```
backups/
  dire_dawa_cleaning_20260828_143000.sql.gz   (~50-200KB compressed)
```

## Manual Backup

```bash
# Full backup (recommended)
./scripts/backup-db.sh

# Output: backups/dire_dawa_cleaning_YYYYMMDD_HHMMSS.sql.gz
```

The script:
1. Runs `pg_dump` inside the PostgreSQL container (`--no-owner --no-acl --clean --if-exists`)
2. Compresses with gzip
3. Saves to `./backups/`
4. Cleans up backups older than 30 days

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_CONTAINER` | `ddcms_db` | Docker container name |
| `DB_NAME` | `dire_dawa_cleaning` | Database name |
| `DB_USER` | `ddcms` | Database user |
| `BACKUP_DIR` | `./backups` | Backup storage directory |
| `RETENTION_DAYS` | `30` | Days to keep backups |

## Restore Procedure

```bash
# 1. List available backups
ls -la backups/

# 2. Restore (interactive confirmation required)
./scripts/backup-db.sh --restore backups/dire_dawa_cleaning_20260828_143000.sql.gz

# 3. Type 'RESTORE' when prompted
```

### Manual Restore

```bash
# Restore directly with psql
gunzip -c backups/dire_dawa_cleaning_20260828_143000.sql.gz | \
  docker exec -i ddcms_db psql -U ddcms -d dire_dawa_cleaning

# Recompress (optional)
gzip backups/dire_dawa_cleaning_20260828_143000.sql
```

## Backup Verification

The backup script includes a verification mode that tests restoration in an isolated container:

```bash
./scripts/backup-db.sh --verify
```

This:
1. Creates a temporary PostgreSQL + PostGIS container on port 5433
2. Restores the backup into it
3. Verifies tables exist
4. Cleans up the temporary container

**Run this after initial backup setup to confirm backups are restorable.**

## Retention Policy

| Backup Age | Action |
|---|---|
| 0-7 days | Keep all daily backups |
| 8-30 days | Keep (auto-cleaned after 30 days) |
| 30+ days | Deleted by `--cleanup` |

For production, consider:
- Weekly full backups retained for 90 days
- Monthly backups retained for 1 year
- Off-site backup storage (S3, external drive)
- Point-in-time recovery via WAL archiving (`archive_mode = on`)

## Cron Schedule (Production)

```bash
# Daily backup at 2:00 AM
0 2 * * * /path/to/scripts/backup-db.sh >> /var/log/ddcms-backup.log 2>&1

# Weekly verification (Sunday 3:00 AM)
0 3 * * 0 /path/to/scripts/backup-db.sh --verify >> /var/log/ddcms-backup.log 2>&1
```

## What Gets Backed Up

- All 16 tables (users, sessions, kebeles, safer_zones, businesses, payments, etc.)
- Schema structure (CREATE TABLE, ENUM types, PostGIS extension)
- Spatial indexes (GIST)
- Triggers (`updated_at`)
- Data (seed + operational)

`pg_dump --clean --if-exists` includes DROP statements so restores are idempotent.

## What Is NOT Backed Up

- `uploads/` directory (inspection photos, documents) — back up separately
- Docker volumes (use `docker volume` commands)
- Environment configuration (`.env` files)

### Backing Up Uploads

```bash
# Backup uploads volume
docker run --rm -v ddcms_backend_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz -C /data .

# Restore uploads
docker run --rm -v ddcms_backend_uploads_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/uploads_backup_20260828.tar.gz -C /data
```

## Emergency Recovery

If the database is corrupted:

1. Stop the backend: `docker compose stop backend`
2. Restore from latest backup: `./scripts/backup-db.sh --restore backups/LATEST.sql.gz`
3. Restart: `docker compose start backend`
4. Verify: `curl http://localhost:5000/api/health`
