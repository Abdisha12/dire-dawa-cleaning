# Migration Validation Report

Generated: 2026-09-04T19:09:58.263Z

PostgreSQL: `postgresql://***@localhost:5432/dire_dawa_cleaning`

| Table | MariaDB | PostgreSQL | Result |
|---|---|---|---|
| users | — | 7 | PG-only |
| kebeles | — | 9 | PG-only |
| safer_zones | — | 108 | PG-only |
| businesses | — | 5 | PG-only |
| payments | — | 0 | PG-only |
| inspections | — | 0 | PG-only |
| inspection_photos | — | 0 | PG-only |
| workers | — | 5 | PG-only |
| attendance | — | 0 | PG-only |
| salary_payments | — | 0 | PG-only |
| tools | — | 5 | PG-only |
| zone_reports | — | 0 | PG-only |
| audit_log | — | 0 | PG-only |
| notifications | — | 0 | PG-only |
| documents | — | 0 | PG-only |
| sessions | — | 0 | PG-only |

## Integrity Checks

- Kebeles: 9 (expected 9) — PASS
- Safer zones: 108 (expected 108) — PASS
- Zones without kebele (orphans): 0 — PASS
- Workers→zones orphans: 0
- Payments total amount: 0

## Unique Constraint

zone_reports UNIQUE (safer_zone_id, report_year, report_month) — verify via: `INSERT duplicate → expect 23505`
- Zone report duplicate groups (should be 0): 0

## Result

**PASS** — all available checks passed (run with MARIA_URL for full diff)

> Do not claim successful migration without actual validation.
