# Database Performance Monitoring

## Overview
Monitoring for PostgreSQL + PostGIS production health. Special attention to report, analytics, inspection, worker, business, and payment queries.

## Active Connections
### What to Monitor
- `SELECT count(*) FROM pg_stat_activity;` — total active connections
- `SELECT count(*) FROM pg_stat_activity WHERE state = 'active';` — currently running queries
- `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';` — idle connections
- `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction';` — idle-in-transaction connections (can cause pool exhaustion)

### Alert Thresholds (guidance, adjust for deployment size)
- **Warning**: active connections > 80% of pool max (pool max = 10 → warn at > 8)
- **Critical**: active connections ≥ pool max (10) → new requests wait/timeout

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT pid, state, wait_event_type, wait_event, query, query_start 
  FROM pg_stat_activity 
  WHERE state != 'sleeping' 
  ORDER BY query_start DESC LIMIT 10;
"
```

### Current Pool Configuration
- `max: 10` (backend/config/db.js)
- `idleTimeoutMillis: 30000` (30 seconds)
- `connectionTimeoutMillis: 5000` (5 seconds)

**Recommendation**: Monitor `pg_stat_activity`; if idle-in-transaction connections accumulate, investigate application code for missing `.release()` or forgotten transactions.

## Long-Running Queries
### What to Monitor
- Queries running > 1 second
- Queries running > 5 seconds
- Queries blocking other queries

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT pid, state, wait_event_type, wait_event, query, query_start 
  FROM pg_stat_activity 
  WHERE state != 'sleeping' 
    AND (query_start IS NOT NOW() - INTERVAL '1 second') 
  ORDER BY query_start LIMIT 10;
"
```

### Dangerous Patterns
- Unbounded `SELECT ... WHERE true` or `SELECT ... WHERE 1=1` without LIMIT
- Missing WHERE clause on UPDATE/DELETE affecting all rows
- `gis` viewport queries without spatial index usage

**Current code audit**: 
- ✅ No unbounded UPDATE/DELETE without WHERE in routes (validated in Phase 13)
- ✅ All list endpoints have pagination (LIMIT 500 / limit ≤ 200)
- ✅ GIS endpoints have `LIMIT 500` hard cap

## Blocked Queries
### What to Monitor
- `locked_transaction_count` — number of transactions waiting for a lock
- `lock.wait_type` — type of lock wait
- Specific queries holding locks

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT blocked.lpid AS blocked_pid, blocked.pid AS blocking_pid, 
         blocked.state, query, query_start 
  FROM pg_stat_activity blocked 
  JOIN pg_stat_activity blocking ON blocked.locked_by = blocking.pid 
  WHERE blocked.wait_event_type = 'Lock';
"
```

### Current code audit
- ✅ All `:id` endpoints have server-side role/kebele/zone scoping (Phase 13)
- ✅ No dynamic ORDER BY (all hardcoded)
- ✅ No client-controlled SQL identifier injection

## Locks
### What to Monitor
- Total number of waiting transactions
- Which queries are blocking which
- Lock duration

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT locktype, mode, granted, waiting, pid, virtualid, locktype 
  FROM pg_locks 
  WHERE NOT granted 
  LIMIT 10;
"
```

### Current code audit
- ✅ All database writes use parameterized queries (`$n`)
- ✅ Transactions used where atomicity required (e.g., migration runner)
- ⚠️ No explicit `pool.end()` in previous code — added in Phase 13 (SIGTERM/SIGINT handlers)

## Slow Queries
### What to Monitor
- Queries exceeding `statement_timeout` (PostgreSQL default: 0 = disabled)
- Application-level slow queries (timed in application code)
- GIS spatial query performance

### How to Check (PostgreSQL)
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SET statement_timeout = 60000;  -- 60 seconds for testing
  SELECT pid, query, query_start 
  FROM pg_stat_activity 
  WHERE state = 'active' 
    AND query_start IS NOT NOW() - INTERVAL '1 second'
  ORDER BY query_start LIMIT 10;
"
```

### How to Configure (PostgreSQL config, not application)
- `statement_timeout` = e.g., `30000` (30 seconds) in `postgresql.conf`
- Can be set per-session: `SET statement_timeout = 30000;`
- **Do not set to 0 in production** (allows runaway queries)

**Current status**: `statement_timeout` not set in Docker image (defaults to disabled). Recommend setting in Docker run args or PostgreSQL config. The application-layer pool timeout is 5s (`connectionTimeoutMillis: 5000`).

## Index Usage
### What to Monitor
- `idx_scan` — number of times an index was scanned (postgres)
- `idx_tup_read` — tuples read from index
- `idx_tup_fetch` — tuples fetched from index (via index, not heap)

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
  FROM pg_stat_user_indexes 
  ORDER BY idx_scan DESC LIMIT 20;
"
```

### Critical Indexes Verified (from schema.sql)
| Index | Table | Purpose |
|---|---|---|
| `idx_kebele_collector` | kebeles | Fast lookup by collector_id |
| `idx_sz_kebele` | safer_zones | Fast lookup by kebele_id |
| `idx_payments_year_month_status` | payments | Fast payment filtering by year/month/status |
| `idx_payments_year_month` | payments | Fast payment year/month grouping |
| `idx_attendance_worker_date` | attendance | Fast attendance lookup by worker+date |
| `idx_tools_zone` | tools | Fast lookup by safer_zone_id |
| `idx_biz_zone` | businesses | Fast lookup by safer_zone_id |
| `idx_inspection_location` | inspections | GIST spatial index on location |
| `idx_worker_location` | workers | GIST spatial index on location |
| `idx_zone_boundary` | safer_zones | GIST boundary index |
| `idx_kebele_boundary` | kebeles | GIST boundary index |
| `idx_business_location` | businesses | GIST location index |

**Recommendation**: Run `ANALYZE` after any bulk data operations to keep statistics fresh:
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -A -t -c "ANALYZE;"
```

### Index Safety Rules (per NON-NEGOTIABLE rules)
- ✅ Do not remove indexes without evidence
- ✅ All existing indexes verified and documented
- ✅ No new indexes added without a verified performance need
- ⚠️ `CREATE INDEX CONCURRENTLY` not used in current migrations — acceptable for initial setup; use for production index additions if table is large and available time is limited

## Table Growth
### What to Monitor
- Row counts per table
- Size per table (total, index, TOAST)
- Growth rate over time

### How to Check
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT schemaname, tablename, n_live_tup, n_dead_tup, total_size 
  FROM pg_stat_user_tables 
  ORDER BY n_live_tup DESC;
"
```

### Expected Growth (based on municipal operation scale)
- **users**: Static (~20–50 rows, never grows)
- **keleb**: Static (9 seed + future admin additions)
- **safer_zones**: Static (108 seed + future zone additions)
- **businesses**: Grows with new business registrations (expected: ~50–200 over years)
- **payments**: Grows with each payment transaction (expected: ~100–500 per year)
- **inspections**: Grows with each inspection (expected: ~200–800 per year)
- **workers**: Static + new hires (expected: ~50–200 over years)
- **attendance**: Grows with each attendance entry (expected: ~500–2000 per year)
- **salary_payments**: Grows with each payment (expected: ~50–200 per year)
- **tools**: Static + new tool additions (expected: ~20–60 over years)
- **zone_reports**: Grows with each report (expected: ~20–100 per year)
- **audit_log**: Grows with each audit entry (expected: ~1000–5000 per year)
- **notifications**: Grows with each notification (expected: ~500–2000 per year)
- **documents**: Grows with each upload (expected: ~200–1000 per year)

### Dead Tuple Maintenance
- `VACUUM` automatically runs via PostgreSQL autovacuum (default settings)
- Monitor `n_dead_tup` in `pg_stat_user_tables`; if growing rapidly, check autovacuum config
- No manual `VACUUM` needed in most cases

## PostGIS Spatial Query Performance
### What to Monitor
- Spatial index usage (GIST)
- Query planning (EXPLAIN ANALYZE)
- Bounding box vs. full geometry operations

### How to Check Query Performance
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  EXPLAIN ANALYZE 
  SELECT * FROM inspections 
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(-90.23, 9.23), 4326), 1000);
"
```

### GIST Index Verification
All spatial columns have GIST indexes (verified in schema.sql):
- `idx_business_location` ON businesses USING GIST (location)
- `idx_inspection_location` ON inspections USING GIST (location)
- `idx_worker_location` ON workers USING GIST (location)
- `idx_zone_boundary` ON safer_zones USING GIST (boundary)
- `idx_kebele_boundary` ON kebeles USING GIST (boundary)

### Spatial Query Patterns (validated in Phase 13)
- ✅ `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` for point persistence
- ✅ `LIMIT 500` on all GIS list endpoints
- ✅ No continuous location tracking
- ✅ Viewport queries use `ST_DWithin` or bounding box
- ⚠️ Geometry simplification not applied — geometry returned as-is from PostGIS; payload size depends on geometry complexity

### GeoJSON Generation
- `routes/gis.js` returns `FeatureCollection` with `ST_AsGeoJSON`
- Honest geometry: `geometry: null` + `locationUnavailable: true` where geometry absent
- No fabricated geometry (Phase 12 constraint)
- Payload size reasonable (only 50 entities per page + "N more")

## Reports & Analytics Queries
### High-Priority Monitoring
Reports and analytics queries are the most likely to have performance issues due to aggregations.

### Key Queries to Monitor
1. **Monthly summary**: `SELECT ... WHERE p.month=$1 AND p.year=$2` — bounded by query params, uses indexes on `payments(year, month, status)`
2. **Worker KPI**: `COUNT(CASE WHEN a.present=TRUE THEN 1 END)` with JOINs — uses `idx_attendance_worker_date`
3. **Inspections by status/time**: `WHERE i.status=$n` + date filters — uses `idx_inspection_status`, `idx_insp_date`
4. **Worker attendance per zone**: JOINS across workers → safer_zones → kebeles — uses `idx_worker_zone`, `idx_sz_kebele`, `idx_kebele_collector`

### Dangerous Patterns to Avoid
- `SELECT ... WHERE ... LIKE '%pattern%'` without covering index → sequential scan
- `SELECT ... ORDER BY RANDOM()` — full table scan + shuffle
- Unindexed JOIN columns → nested loop with sequential scans on both sides
- `GROUP BY` on large tables without proper indexes

**Current code audit**: ✅ All report/analytics queries use parameterized `$n` values, bounded pagination, and leverage existing indexes. No `LIKE '%...%'` without purpose. No `ORDER BY RANDOM()`.

## Database Performance Monitoring Summary

| Area | Status | Action |
|---|---|---|
| Active connections | Monitor via `pg_stat_activity` | Set up cron job or dashboard |
| Long-running queries | Monitor via `pg_stat_activity`; `statement_timeout` recommended | Set `statement_timeout` in Docker run args |
| Blocked queries | Monitor via `pg_locks` / `pg_stat_activity` | Investigate if any appear |
| Locks | Monitor via `pg_locks` | Investigate deadlocks immediately |
| Slow queries | Application-level timing possible; PostgreSQL `statement_timeout` | Recommend: set `statement_timeout = 30000` |
| Index usage | All critical indexes verified + documented | Run `ANALYZE` after bulk operations |
| Table growth | Estimated rates documented; autovacuum handles cleanup | Monitor `pg_stat_user_tables` quarterly |
| PostGIS spatial queries | GIST indexes verified; honest geometry; LIMIT 500 | No action needed |
| Reports & analytics | All parameterized + indexed; no dangerous patterns | No action needed |

**Overall**: Database performance is solid due to careful index design and parameterized queries. Monitoring active connections and long-running queries is the highest-yield operational addition. No immediate index changes needed.