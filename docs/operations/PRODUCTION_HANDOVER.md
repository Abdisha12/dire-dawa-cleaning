# Production Handover Document — Dire Dawa Cleaning Management System

## 1. Overview
- **System Name:** Dire Dawa Cleaning Management System (v2)
- **Approved Release Commit:** `b136f915ecce9aa4f664e474aa7dcb357dd92cb0`
- **Deployment Status:** BLOCKED (External VPS host node, public DNS `diredawa-cleaning.gov.et`, and TLS certificates remain unprovisioned)
- **Architecture:** Node.js + Express REST API (Backend), Next.js App Router (Frontend), PostgreSQL 16 + PostGIS 3.4 (Database)

- **Municipal Structure:** 9 Kebeles & 108 Safer Zones

---

## 2. Operational Procedures & Service Controls

### Service Controls
```bash
# Check Docker service health
docker compose ps

# View backend API logs
docker compose logs -f backend

# View database health
./scripts/db-health-check.sh
```

### Database Operations & Automated Backups
- **Scheduled Backups:** Executed via `./scripts/backup-db.sh`
- **Backup Location:** `./backups/` (Excluded from git)
- **Restoration Command:** `./scripts/backup-db.sh --restore <BACKUP_FILE>`

---

## 3. Emergency Actions & Rollback Procedure

In case of critical production issues:
1. Stop API backend: `docker compose stop backend`
2. Restore previous stable code revision / docker image.
3. Restore database snapshot if migrations occurred:
   `./scripts/backup-db.sh --restore ./backups/<SNAPSHOT>.sql.gz`
4. Restart application services: `docker compose up -d`
5. Run health check: `./scripts/db-health-check.sh`
