# Database Backup & Restore

## Overview

The Dire Dawa Cleaning system stores all operational data in MariaDB. Regular backups are
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
1. Runs `mysqldump` inside the MariaDB container
2. Compresses with gzip
3. Saves to `./backups/`
4. Cleans up backups older than 30 days

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_CONTAINER` | `ddcms_db` | Docker container name |
| `DB_NAME` | `dire_dawa_cleaning` | Database name |
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
# Decompress
gunzip backups/dire_dawa_cleaning_20260828_143000.sql.gz

# Restore
docker exec -i ddcms_db mysql -u root -p"$DB_ROOT_PASSWORD" dire_dawa_cleaning \
  < backups/dire_dawa_cleaning_20260828_143000.sql

# Recompress (optional)
gzip backups/dire_dawa_cleaning_20260828_143000.sql
```

## Backup Verification

The backup script includes a verification mode that tests restoration in an isolated container:

```bash
./scripts/backup-db.sh --verify
```

This:
1. Creates a temporary MariaDB container on port 3307
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

## Cron Schedule (Production)

```bash
# Daily backup at 2:00 AM
0 2 * * * /path/to/scripts/backup-db.sh >> /var/log/ddcms-backup.log 2>&1

# Weekly verification (Sunday 3:00 AM)
0 3 * * 0 /path/to/scripts/backup-db.sh --verify >> /var/log/ddcms-backup.log 2>&1
```

## What Gets Backed Up

- All 16 tables (users, sessions, kebeles, safer_zones, businesses, payments, etc.)
- Schema structure (CREATE TABLE)
- Stored routines (procedures, functions)
- Triggers
- Event scheduler definitions

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
