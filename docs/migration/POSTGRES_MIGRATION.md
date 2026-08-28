# PostgreSQL + PostGIS Migration — Reproducible Process

This document satisfies requirements 18, 19, 20, 28: a reproducible migration
from MariaDB → PostgreSQL + PostGIS that can be executed fresh, preserves data,
validates correctness, and can be rolled back.

---

## 1. Fresh Database Creation (reproducible)

From a clean checkout, no running containers, no volume:

```bash
# 1. Copy env template and set secrets (never commit .env)
cp .env.example .env
# Edit: DB_PASSWORD=<32+ random>, SESSION_SECRET=<32+ hex>, PAYMENT_WEBHOOK_SECRET=<32+ hex>
nano .env
cp backend/.env.example backend/.env
# Ensure backend/.env has same DB_PASSWORD and SESSION_SECRET

# 2. Start PostgreSQL + PostGIS (pinned version, no `latest`)
docker compose up -d db
docker compose logs -f db   # wait for "database system is ready"

# 3. Verify PostGIS
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "SELECT PostGIS_Version();"
# Expected: 3.4 USE_GEOS=1 ...

# 4. Verify schema (auto-applied via /docker-entrypoint-initdb.d)
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "\dt"   # 16 tables
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "\d kebeles"  # check boundary GEOMETRY
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "\di"   # ~35 indexes inc. 5 GIST

# 5. Apply migrations in order
DB_HOST=localhost DB_PORT=5432 DB_USER=ddcms DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d= -f2) \
  node database/migrate.js up
# Or: node database/migrate.js status

# 6. Seed development data (explicit password, never default)
SEED_PASSWORD=$(openssl rand -base64 24) node database/seed.js
# Creates 7 users: admin, collector1/2, leader_k1z1/k1z2/k2z1, viewer1
# Links collectors→kebeles, leaders→zones

# 7. Run tests against PostgreSQL
cd backend
DB_HOST=localhost DB_PORT=5432 DB_USER=ddcms DB_PASSWORD=... npm test
# Expected: all suites pass including kebele-admin-workers

# 8. Start application
docker compose up --build -d
curl http://localhost:5000/api/health   # {"status":"ok"}
# Frontend: http://localhost:${FRONTEND_PORT:-80}
```

The old `database/schema.sql` (MariaDB) is retained at `database/schema.sql` for reference
and rollback; the canonical fresh-install schema is `database/postgresql/schema.sql`.

---

## 2. What Changed in PostgreSQL Schema

| MariaDB | PostgreSQL |
|---|---|
| `INT AUTO_INCREMENT` | `SERIAL` |
| `ENUM(...)` | Native `TYPE` (`user_role`, `business_type`, `payment_method`, `payment_status`, `inspection_status`, `tool_category`, `tool_condition`, `report_status`, `document_category`) |
| `TINYINT(1)` | `BOOLEAN` (`is_active`, `present`, `is_read`) |
| `DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE` | `TIMESTAMP DEFAULT NOW()` + `update_updated_at()` trigger |
| `JSON` | `JSONB` (`workers.custom_attributes`, `audit_log.old_values/new_values`) |
| `UNIQUE KEY uq_zr_zone_period (safer_zone_id, report_month, report_year)` | `UNIQUE (safer_zone_id, report_year, report_month)` canonical order |
| No spatial | `GEOMETRY(MULTIPOLYGON,4326)` on `kebeles.boundary`, `safer_zones.boundary`; `GEOMETRY(POINT,4326)` on `businesses.location`, `inspections.location`, `workers.location` + 5 GIST indexes |

Indexes: full audit in `database/postgresql/schema.sql` comments. GIST only on GEOMETRY columns.

---

## 3. Controlled Data Migration (all 16 tables)

**Do not migrate secrets in plaintext.** Password hashes are migrated as-is (bcrypt), session
tokens are not migrated (ephemeral).

### Option A — pgloader (recommended, preserves types)

```bash
# Install
sudo pacman -S pgloader  # or apt install pgloader

# Run (reads MariaDB, writes PostgreSQL)
pgloader mysql://root:${DB_PASSWORD}@127.0.0.1/dire_dawa_cleaning \
         postgresql://ddcms:${DB_PASSWORD}@127.0.0.1:5432/dire_dawa_cleaning

# pgloader handles: tinyint(1)→boolean, enum→text, datetime→timestamptz, json→jsonb
```

### Option B — Helper script

```bash
# Dump MariaDB (if container still running as ddcms_db_old)
mysqldump -u root -p"${DB_PASSWORD}" --single-transaction --no-create-info dire_dawa_cleaning > /tmp/maria_data.sql

# Convert & load
./database/postgresql/migrate-data.sh --from-dump /tmp/maria_data.sql
# For large data prefer pgloader; the script uses sed fallback for small dumps.
psql -h localhost -U ddcms -d dire_dawa_cleaning -f /tmp/mariadb_to_pg_*.sql
```

### Tables migrated (16/16)

`users`, `sessions` (optional, not required), `kebeles`, `safer_zones`, `businesses`,
`payments`, `inspections`, `inspection_photos`, `workers`, `attendance`,
`salary_payments`, `tools`, `zone_reports`, `audit_log`, `notifications`, `documents`
plus `_migrations` state.

Credentials are read from `DB_PASSWORD` env var, never committed.

---

## 4. Data Validation Report (must run after migration)

Run `database/postgresql/validate-migration.js` or manually:

```bash
# Row counts
psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT 'users' AS tbl, COUNT(*) FROM users UNION ALL
  SELECT 'kebeles', COUNT(*) FROM kebeles UNION ALL
  SELECT 'safer_zones', COUNT(*) FROM safer_zones UNION ALL
  SELECT 'workers', COUNT(*) FROM workers UNION ALL
  SELECT 'businesses', COUNT(*) FROM businesses UNION ALL
  SELECT 'payments', COUNT(*) FROM payments UNION ALL
  SELECT 'attendance', COUNT(*) FROM attendance UNION ALL
  SELECT 'inspections', COUNT(*) FROM inspections UNION ALL
  SELECT 'tools', COUNT(*) FROM tools UNION ALL
  SELECT 'zone_reports', COUNT(*) FROM zone_reports UNION ALL
  SELECT 'audit_log', COUNT(*) FROM audit_log UNION ALL
  SELECT 'notifications', COUNT(*) FROM notifications UNION ALL
  SELECT 'documents', COUNT(*) FROM documents;"

# FK integrity (example)
psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT 'orphan workers' AS check, COUNT(*) FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.safer_zone_id IS NOT NULL AND sz.id IS NULL
  UNION ALL SELECT 'orphan businesses', COUNT(*) FROM businesses b LEFT JOIN safer_zones sz ON sz.id=b.safer_zone_id WHERE sz.id IS NULL;"

# Unique constraint (should fail if duplicate)
psql -U ddcms -c "INSERT INTO zone_reports (safer_zone_id, report_date, report_month, report_year, submitted_by) VALUES (1, '2026-08-01', 8, 2026, 1);"  # expect 23505 on second insert

# Monetary & date checks
psql -U ddcms -c "SELECT SUM(amount) FROM payments; SELECT MIN(date), MAX(date) FROM inspections;"
```

Produce a table:

| Table | MariaDB | PostgreSQL | Result |
|---|---|---|---|
| users | N | N | PASS/FAIL |
| kebeles | 9 | 9 | PASS |
| safer_zones | 108 | 108 | PASS |
| workers | N | N | PASS |
| businesses | N | N | PASS |
| payments | N | N | PASS |
| attendance | N | N | PASS |
| inspections | N | N | PASS |
| tools | N | N | PASS |
| zone_reports | N | N | PASS |
| audit_log | N | N | PASS |
| notifications | N | N | PASS |
| documents | N | N | PASS |

**Do not claim successful migration without this table filled from actual counts.**

See generated report: `docs/migration/VALIDATION_REPORT.md` (filled after running against real data).

---

## 5. Application DB Layer Changes

Only MySQL-incompatible syntax was changed; business logic preserved.

| Category | MariaDB | PostgreSQL | Files |
|---|---|---|---|
| Placeholders | `?` | `$1,$2...` | all 14 routes, 2 services, auth, tests |
| Date | `MONTH(date)`, `YEAR(date)`, `DATE_SUB(NOW(), INTERVAL 30 DAY)` | `EXTRACT(MONTH FROM date)`, `NOW() - INTERVAL '30 days'` | analytics.js, public.js |
| Pagination | `LIMIT ? OFFSET ?` | `LIMIT $N OFFSET $M` | notifications, reports |
| Boolean | `is_active=1`, `present=1`, `is_read=1` | `is_active=TRUE`, `present=TRUE` | workers, notifications, etc. |
| Insert returning | `result.insertId` | `RETURNING id` → `result.rows[0].id` | all inserts |
| Upsert | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT (...) DO UPDATE SET` | attendance bulk, seed |
| Affected rows | `result.affectedRows` | `result.rowCount` | payments |
| Error code | `ER_DUP_ENTRY` | `23505` | 7 routes, errorHandler |
| JSON | `JSON` string | `JSONB` (pg returns object) | workers custom_attributes |
| Aggregation | `GROUP_CONCAT` (not used) | `STRING_AGG` if needed | n/a |

---

## 6. Database User Security

| Role | Purpose | Privileges | Connects as |
|---|---|---|---|
| `postgres` | superuser, owns schema, runs init | `SUPERUSER` | Docker init only |
| `ddcms` | application runtime | `CONNECT`, `USAGE`, `SELECT/INSERT/UPDATE/DELETE`, `USAGE,SELECT` on sequences, `EXECUTE` on PostGIS functions. `NOSUPERUSER NOCREATEDB NOCREATEROLE`. No DDL. | `DB_USER=ddcms` in backend |
| `ddcms_migrator` | schema migrations | `CREATE,USAGE`, `ALL` on tables/sequences, `EXECUTE` | `node database/migrate.js` (set `DB_USER=ddcms_migrator` for migrations) |

Application never connects as superuser. Credentials via `DB_PASSWORD` env var, never committed. `POSTGRES_HOST_AUTH_METHOD=trust` removed.

---

## 7. Docker

- Image pinned: `postgis/postgis:16-3.4` (not `latest`)
- Persists: `db_data:/var/lib/postgresql/data` (named volume)
- Env creds: `${DB_PASSWORD:?ERROR...}` fails fast
- Health: `pg_isready -U ddcms -d dire_dawa_cleaning`
- Depends: `backend: condition: service_healthy`
- PostGIS enabled via `CREATE EXTENSION postgis` in schema

---

## 8. Backup & Restore (PostgreSQL)

Documented in `docs/BACKUP.md`. Key change: `mysqldump` → `pg_dump`.

Test procedure (must be run before declaring migration complete):

```bash
./scripts/backup-db.sh              # creates backups/dire_dawa_cleaning_*.sql.gz
./scripts/backup-db.sh --verify     # spins up postgis:16-3.4 on 5433, restores, verifies table count
# Manual:
gunzip -c backups/dire_dawa_cleaning_*.sql.gz | docker exec -i ddcms_db psql -U ddcms -d dire_dawa_cleaning
```

PostGIS considerations: dump includes `CREATE EXTENSION postgis`; restore requires PostGIS image (used in verify). Retention: 30 days auto-cleanup, same as before.

---

## 9. Rollback Plan (MariaDB preserved)

**Do not destroy the MariaDB volume/container until migration is validated, tested, backups verified, and rollback documented.**

1. Keep old MariaDB dump: `backups/mariadb_pre_migration_*.sql.gz` and/or Docker volume `dire-dawa-cleaning_db_data_maria`
2. To rollback:
   ```bash
   docker compose down
   # Restore MariaDB compose (git show previous docker-compose.yml > docker-compose.mariadb.yml)
   docker compose -f docker-compose.mariadb.yml up -d db
   mysql -u root -p"${DB_ROOT_PASSWORD}" dire_dawa_cleaning < backups/mariadb_pre_migration_*.sql.gz
   # Revert code: git revert <postgres-migration-commit>  or  git checkout <pre-migration-tag>
   docker compose -f docker-compose.mariadb.yml up --build -d
   ```
3. Validation gate before destroying MariaDB: row counts PASS, FK PASS, app tests PASS, backup verify PASS, manual smoke test PASS.

See `docs/migration/ROLLBACK.md` for step-by-step.

---

## 10. Scope Guard

No GIS UI, no frontend React migration, no Android/Capacitor was added in this phase.
Only database foundation (PostGIS types, GEOMETRY columns, GIST indexes) was introduced.
Frontend continues to work unchanged against PostgreSQL backend.
