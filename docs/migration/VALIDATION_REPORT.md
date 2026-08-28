# Migration Validation Report

**Generated:** 2026-08-29 (template — fill after running against real data)
**Source:** `database/postgresql/validate-migration.js`

Run validation:
```bash
# With live databases
MARIA_URL=mysql://root:${DB_PASSWORD}@127.0.0.1:3306/dire_dawa_cleaning \
PG_URL=postgresql://ddcms:${DB_PASSWORD}@127.0.0.1:5432/dire_dawa_cleaning \
node database/postgresql/validate-migration.js

# Or PG-only (row counts + integrity without MariaDB)
PG_URL=postgresql://ddcms:${DB_PASSWORD}@127.0.0.1:5432/dire_dawa_cleaning \
node database/postgresql/validate-migration.js
```

## Row Counts

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
| inspection_photos | N | N | PASS |
| salary_payments | N | N | PASS |
| tools | N | N | PASS |
| zone_reports | N | N | PASS |
| audit_log | N | N | PASS |
| notifications | N | N | PASS |
| documents | N | N | PASS |
| sessions | N | N | PASS |

> **Do not claim successful migration without filling this table from actual counts.**
> In fresh install with seed data: users=7, kebeles=9, safer_zones=108, businesses=5, workers=5, tools=5.

## Integrity Checks

- Kebeles: expected 9 — run `SELECT COUNT(*) FROM kebeles;`
- Safer zones: expected 108 — `SELECT COUNT(*) FROM safer_zones;`
- Zones without kebele (orphans): `SELECT COUNT(*) FROM safer_zones sz LEFT JOIN kebeles k ON k.id=sz.kebele_id WHERE k.id IS NULL;` → 0
- Workers → zones orphans: `SELECT COUNT(*) FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.safer_zone_id IS NOT NULL AND sz.id IS NULL;` → 0
- Businesses → zones orphans: `SELECT COUNT(*) FROM businesses b LEFT JOIN safer_zones sz ON sz.id=b.safer_zone_id WHERE sz.id IS NULL;` → 0
- Payments → businesses orphans: `SELECT COUNT(*) FROM payments p LEFT JOIN businesses b ON b.id=p.business_id WHERE b.id IS NULL;` → 0

## Unique Constraints

- `zone_reports` duplicate check: `SELECT safer_zone_id, report_year, report_month, COUNT(*) FROM zone_reports GROUP BY 1,2,3 HAVING COUNT(*)>1;` → 0 rows
- Manual test: second `INSERT INTO zone_reports (safer_zone_id, report_month, report_year, report_date, submitted_by) VALUES (1, 8, 2026, '2026-08-01', 1);` must fail with `23505`

## Value Checks

- Monetary: `SELECT SUM(amount) FROM payments;` compare MariaDB vs PG (NUMERIC(12,2) preserved)
- Dates: `SELECT MIN(date), MAX(date) FROM inspections; SELECT MIN(report_date), MAX(report_date) FROM zone_reports;`
- Status values: `SELECT DISTINCT status FROM payments;` → paid,pending,overdue,failed (PG ENUM)
- ENUM enforcement: `INSERT INTO payments (status) VALUES ('invalid');` must fail

## Current PG-only Snapshot (from last validation run)

When no MariaDB is available, the script produces PG-only counts. Fill below after DB is running:

```
PostgreSQL connected: (fill)
users: (fill)
kebeles: (fill) — expected 9
safer_zones: (fill) — expected 108
...
```

## Result

**Status:** `TEMPLATE — run validate-migration.js against live DB to mark PASS`
