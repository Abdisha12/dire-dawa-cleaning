# Production Operations Runbook

This runbook documents operational procedures for managing the Dire Dawa Cleaning Department Modernization application in production.

---

## 1. Service Management

### Application Service Status
```bash
# Check Docker container status
docker compose ps

# Check backend logs
docker compose logs -f backend

# Check frontend logs
docker compose logs -f frontend
```

### Restart Services
```bash
# Graceful restart of all application services
docker compose restart

# Single service restart
docker compose restart backend
```

---

## 2. Database Operations

### PostgreSQL & PostGIS Health Check
```bash
# Run database health check script
./scripts/db-health-check.sh
```

### Database Backup
```bash
# Create immediate compressed backup
./scripts/backup-db.sh

# Create backup and verify restoration in temporary container
./scripts/backup-db.sh --verify
```

### Database Restoration
```bash
# Restore from backup file (WARNING: Overwrites target database)
./scripts/backup-db.sh --restore ./backups/dire_dawa_cleaning_<TIMESTAMP>.sql.gz
```

---

## 3. Configuration & Secret Checks

```bash
# Run production configuration check
./scripts/check-config.sh
```

---

## 4. Health Check Endpoints

```bash
# Backend health endpoint
curl -s http://localhost:5000/api/health

# Database readiness ping
docker exec ddcms_db pg_isready -U ddcms -d dire_dawa_cleaning
```

---

## 5. Emergency Rollback

In the event of a critical failure:
1. Stop backend service: `docker compose stop backend`
2. Restore previous stable container image or git commit.
3. Restore database snapshot if migrations were applied:
   `./scripts/backup-db.sh --restore ./backups/<PRE_DEPLOYMENT_BACKUP>.sql.gz`
4. Restart application services: `docker compose up -d`
5. Verify health: `./scripts/db-health-check.sh`
