# Disaster Recovery Plan — Dire Dawa Cleaning Department

## Overview
This document describes the disaster recovery procedures for the Dire Dawa Cleaning Department system. It covers database loss, server loss, corrupted deployment, failed migration, accidental deletion, compromised credentials, failed release, storage failure, and application outage.

## Recovery Time Objectives (RTO)
- **Database restoration**: 30–60 minutes (depends on backup size, verify step)
- **Full server restoration**: 60–90 minutes (db + backend + frontend)
- **Application outage**: 15–30 minutes (if healthy backups exist, rollforward)
- **Credential rotation**: 10–20 minutes

## Recovery Point Objectives (RPO)
- **Database backup**: Up to 24 hours (backups run daily at discretion; retention is 30 days)
- **Configuration drift**: Not applicable — all configuration via environment variables
- **Session data**: Sessions are short-lived (8-hour expiry); re-authentication required after restore

## Assumptions
- Backups are stored locally at `./backups/` (created on first run of `scripts/backup-db.sh`)
- Docker is available for containerized restoration
- The `postgres` superuser role is not required for restore
- The `ddcms` role has sufficient privileges (CONNECT + USAGE + DML-only + sequences)
- No data has been modified since the last backup without being captured in the backup

## Disaster Scenarios & Recovery Sequences

### 1. Database Loss
**Recovery Sequence**:
1. Provision a new server and install Docker
2. Start the docker-compose stack: `docker-compose up -d`
3. The `db` service initializes from the `schema.sql` init script
4. Restore from the latest backup: `./scripts/backup-db.sh --restore ./backups/dire_dawa_cleaning_YYYYMMDD_HHMMSS.sql.gz`
5. Verify restoration: `./scripts/backup-db.sh --verify`
6. Restart the backend and frontend: `docker-compose up -d`
7. Verify authentication, authorization, and critical business flows
8. Record the event and corrective action

**RPO**: Up to 24 hours | **RTO**: 30–60 minutes

### 2. Server Loss (Backend + Frontend)
**Recovery Sequence**:
1. Provision a new server or spin up new containers
2. The `docker-compose.yml` defines the full stack with persistent volumes (`db_data`, `uploads_data`, `logs_data`)
3. Restart the stack: `docker-compose up -d`
4. The database service will be healthy (pre-seeded with `schema.sql` on first run, or restored from backup if data was on a separate volume)
5. The backend service will connect to the database and start serving
6. The frontend will proxy to the backend via nginx
7. Verify health: `curl http://localhost:80/api/health`
8. Verify authentication: `curl -b <session> http://localhost:80/api/auth/me` (with valid session)
9. Verify critical business flows

**RPO**: Zero (volumes persist data) | **RTO**: 15–30 minutes

### 3. Corrupted Deployment
**Recovery Sequence**:
1. Identify the scope of corruption (frontend, backend, database)
2. If repairable without data loss: `docker-compose down` and redeploy previous version
3. If data is affected: follow Database Loss scenario (step 1)
4. Once service is restored, verify: health, auth, critical business flows
5. Document the root cause and corrective action

**RPO**: Zero (rolled forward from known-good state) or up to 24 hours (if restoring from backup) | **RTO**: 15–45 minutes

### 4. Failed Migration
**Recovery Sequence**:
1. Check migration status: `node database/migrate.js status`
2. If pending: `node database/migrate.js up`
3. If applied but inconsistent: restore from backup (`./scripts/backup-db.sh --restore <file>`), then re-apply migrations from that point
4. If `down()` was called and dropped data: restore from backup

**RPO**: Up to 24 hours (if backup restore needed) or zero (if migration can be re-applied) | **RTO**: 15–30 minutes

### 5. Accidental Deletion
**Recovery Sequence**:
1. Stop write traffic to the database
2. If WAL archiving available: point-in-time recovery (beyond current setup)
3. Otherwise: restore from latest backup: `./scripts/backup-db.sh --restore <file>`
4. Verify: `./scripts/backup-db.sh --verify`
5. Restart services: `docker-compose up -d`
6. Document incident and implement safeguards (confirmation prompts, application-level transactions)

**RPO**: Up to 24 hours (backup frequency) | **RTO**: 30–60 minutes

### 6. Compromised Credentials
**Recovery Sequence**:
1. Rotate all secrets (`DB_PASSWORD`, `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`)
2. Update `.env` file (never commit to git)
3. Redeploy the application
4. Invalidate all active sessions (system already does this on password change)
5. Investigate: check application logs, database logs, `login_attempts` entries
6. Restart services

**RPO**: Zero (rotation-only; no data loss expected) | **RTO**: 10–20 minutes

### 7. Failed Release
**Recovery Sequence**:
1. Identify which release caused the failure (git tag/branch/commit)
2. Roll back the specific service (frontend Docker image, backend Docker image)
3. If database affected: restore from backup
4. Verify: health, auth, critical business flows
5. Document the release that caused the failure and the rollback procedure

**RPO**: Zero (rollback to prior known-good release) | **RTO**: 15–30 minutes

### 8. Storage Failure
**Recovery Sequence**:
- `uploads/` directory lost: re-upload files attached to inspections, documents, businesses
- `backups/` directory lost: run `./scripts/backup-db.sh` to create new backup
- Database volume (`db_data`) lost: covered under Database Loss scenario

**RPO**: Zero for uploads (re-upload); up to 24 hours for backups | **RTO**: 5–15 minutes

### 8. Application Outage
**Recovery Sequence**:
1. Check process status: `docker ps`
2. Restart the stack: `docker-compose restart`
3. If port occupied: identify and free the conflicting process
4. If network partitioned: check DNS, `/etc/hosts`, Docker network
5. Verify service up: `curl http://localhost:80/api/health`
6. Verify critical flows: auth, workers, inspections, payments
7. Check logs: `docker logs ddcms_backend`

**RPO**: Zero (state preserved in database + volumes) | **RTO**: 5–15 minutes

## Documentation & Testing
- Run `./scripts/backup-db.sh --verify` monthly
- Run after any major database change
- Record results in operational log

### Disaster Recovery Drill Recommendation
- Conduct a full DR drill quarterly:
  1. Provision a fresh server
  2. `docker-compose up -d` (fresh stack, init from schema.sql)
  2. Restore from latest backup
  3. Verify all critical business flows
  4. Record RTO/RPO and any issues

## Compliance with Phase 13–14 Standards
- Backup uses `pg_dump --no-owner --no-acl --clean --if-exists | gzip` ✅
- Restore verified via ephemeral PostgreSQL + table count check ✅
- No SUPERUSER/CREATEDB/CREATEROLE required for `ddcms` role ✅
- `ddcms` role: `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION` ✅
- Session invalidation on password change ✅
- Persistent lockout via `login_attempts` table ✅
- No fabricated data in any procedure ✅