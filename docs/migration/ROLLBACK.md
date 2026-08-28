# Rollback Plan — PostgreSQL → MariaDB

**Status:** MariaDB must remain restorable until migration validation is complete.

---

## Pre-migration Snapshot

Before running migration:

```bash
# 1. Backup MariaDB (mysqldump)
docker exec ddcms_db mysqldump -u root -p"${DB_ROOT_PASSWORD}" --single-transaction --routines --triggers dire_dawa_cleaning | gzip > backups/mariadb_pre_migration_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Backup MariaDB volume (optional)
docker run --rm -v dire-dawa-cleaning_db_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/mariadb_volume_$(date +%Y%m%d).tar.gz -C /data .

# 3. Tag code
git tag pre-postgres-migration
git push origin pre-postgres-migration
```

---

## When to Rollback

- Validation report shows row count / FK mismatch
- Application tests fail against PostgreSQL
- Backup verify fails
- Performance regression >20% on key queries without remediation
- Any data integrity issue (kebele/zone/worker relationship broken)

---

## Rollback Steps

```bash
# 1. Stop PostgreSQL stack
docker compose down

# 2. Restore MariaDB service
# Previous docker-compose.yml is available at git show pre-postgres-migration:docker-compose.yml
git show pre-postgres-migration:docker-compose.yml > docker-compose.mariadb.yml
docker compose -f docker-compose.mariadb.yml up -d db
# Wait for healthcheck
docker inspect --format='{{.State.Health.Status}}' ddcms_db

# 3. Restore data
gunzip -c backups/mariadb_pre_migration_*.sql.gz | docker exec -i ddcms_db mysql -u root -p"${DB_ROOT_PASSWORD}" dire_dawa_cleaning

# 4. Verify counts
docker exec ddcms_db mysql -u root -p"${DB_ROOT_PASSWORD}" -e "SELECT COUNT(*) FROM kebeles; SELECT COUNT(*) FROM safer_zones;" dire_dawa_cleaning

# 5. Revert application code
git checkout pre-postgres-migration -- backend/ database/ docker-compose.yml .env.example .github/workflows/ci.yml scripts/backup-db.sh docs/BACKUP.md
# Or full revert: git revert 1ddb542

# 6. Restart app on MariaDB
docker compose -f docker-compose.mariadb.yml up --build -d
curl http://localhost:5000/api/health

# 7. Run tests against MariaDB
cd backend && DB_HOST=localhost DB_PORT=3306 npm test
```

---

## Post-rollback Verification

- 9 kebeles preserved, 108 zones with correct kebele_id
- Worker zone/kebele relationships intact
- Payment totals match pre-migration snapshot
- No secrets exposed in rollback scripts

---

## Destroy MariaDB Only After

- [ ] Validation report PASS for all tables
- [ ] `npm test` PASS on PostgreSQL
- [ ] `scripts/backup-db.sh --verify` PASS (PostgreSQL restore)
- [ ] Manual smoke test (login as admin/collector/leader, create worker, submit report)
- [ ] Performance baseline within 10% or justified

Keep `backups/mariadb_pre_migration_*.sql.gz` for at least 90 days.
