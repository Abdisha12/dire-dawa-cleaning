# Phase 8 — Reports & Analytics

> Migration of operational reports/analytics from existing backend APIs (`/reports/*`, `/analytics/*`, `/payments/summary/dashboard`) into the Next.js frontend.

---

## A. Audit

Inspected actual backend APIs:
- `GET /reports/payments/monthly` (CSV/PDF/XLSX)
- `GET /reports/payments/yearly` (monthly aggregate)
- `GET /reports/workers/monthly` (attendance + bonus + gross wage)
- `GET /reports/inspections` (date range, status, kebele, zone)
- `GET /reports/monthly-summary` (combined KPI)
- `GET /analytics/attendance|payments|inspections|zones|trends` (server-side aggregations)
- `GET /payments/summary/dashboard` (totals + byKebele + monthly)

No new backend endpoints added — the existing system is sufficient.

## B. Reports

Implemented (`app/(app)/reports/page.tsx`):
- **Payments (Monthly)** — Receipt, Business, Kebele, Zone, Amount, Method, Status, Collector, Paid At
- **Payments (Yearly)** — Month, Count, Collected, Pending, Overdue
- **Workers (Monthly)** — Worker, Kebele, Zone, Present/Absent, Bonus, Daily Wage, Gross
- **Inspections (Period)** — Date, Kebele, Zone, Status, Inspector

## C. Analytics

Implemented (`app/(app)/reports/analytics/page.tsx`):
- **Summary KPIs** (Collected/Pending/Overdue) from `/payments/summary/dashboard`
- **Monthly Collection Trend** (bar chart, lazy CSS bars) with text alternative
- **9-Kebele Comparison** table from `byKebele` (no fabrication)
- **Target/Achievement %** only when both `target` and `collected` are non-null

## D. Metrics (definitions and sources)

| Metric | Source | Formula |
|---|---|---|
| Total collected | `payments.status='paid'` SUM | backend |
| Pending | `payments.status='pending'` SUM | backend |
| Overdue | `payments.status='overdue'` SUM | backend |
| Workers present/absent | `attendance.present` COUNT | backend |
| Gross wage | `days_present*daily_wage + bonus` SUM | backend (`reports/workers/monthly`) |
| Inspections active/warning/danger | `inspections.status` COUNT | backend |
| Target (per kebele) | `monthly_target` per business (sum) | backend |
| Achievement % | `collected / target * 100` | client (only when target present) |

No invented metrics.

## E. 9 Kebeles

- Real `byKebele` rows from `dashboard` endpoint
- No hardcoded K01..K09 IDs
- Hierarchical render: City → 9 kebele cards → safe-zone ranking

## F. Filters

- Kebele (from `useKebele` context, not user-controlled)
- Safer Zone (admin dropdown only)
- Month + Year (for periodic reports)
- From/To date (for inspections)
- Search (not implemented; backend doesn't expose report search)

## G. Exports

- CSV via `format=csv` (server-generated; authenticated via `x-session-token` header)
- XLSX/PDF endpoints exist on backend (`/reports/payments/monthly` etc.) — frontend only wires CSV in this phase; XLSX/PDF can be added via direct URL with same auth pattern
- Filename pattern: `dire-dawa-<report>-<year>-<month>.csv`
- No XLSX/PDF client-side fabrication

## H. Security

- Backend `/reports/*` enforce `authenticate` + `requireRole` + `validate(schemas.reportQuery)` (year, month, from, to)
- Role scoping preserved: `leader` zone-only, `collector` kebele, `admin` all
- No client-side role trust
- CSRF/XSS safe (no `dangerouslySetInnerHTML`; JSX escape)
- Token via `x-session-token` only (not in URL)

## I. Accessibility

- Labels for filters, `aria-label` on controls
- `role=dialog` not needed (page-level)
- `aria-live="polite"` for export status
- Chart text alternative via `<details><summary>` (Text alternative)
- Empty/error states distinguishable
- 44px targets on buttons
- Status text + color (e.g. Active/Warning/Danger not color-only)
- Reduced motion via `globals.css`

## J. Mobile

- `flex-wrap` filter row → single column at narrow widths
- `DataTable` hides desktop table at `md:hidden` and shows cards
- Stat cards grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Touch targets ≥44px

## K. Performance

- Server-side pagination (25/page via existing endpoints)
- `AbortController` cancels stale fetches
- Memoized `useMemo` for column/summary derivation
- `selective fetchData()` after filter change
- No TanStack Query (local state)

## L. Tests

- **13 new Phase 8 tests** in `src/test/reports-analytics.test.tsx`
- Coverage: Reports route renders, report selector, results, empty state, error state; Analytics renders, kebele comparison, accessible chart alternative; 9 kebeles visible, admin all, kebele admin scoped, leader scoped; CSV action; Performance route
- **Total: 124/124 pass** (was 111)

## M. Build

- `npx tsc --noEmit` 0 (Phase 8 files clean; 6 pre-existing errors in `locations/map/page.tsx` from Phase 7 sandbox maplibre install constraints, not Phase 8)
- `eslint` 0 for Phase 8 files
- `npm run test` 124/124
- `npm run build` 135 OOM sandbox (1.3GB free) — env limit documented

## N. Regression

- Phase 0/3/4/5/6/7 tests retained: shell (10), kebele (3), login (6), workers (13), attendance-salary (7), businesses (15), payments (13), inspections (8), zone-reports (13), responsive (6), businesses-responsive (10), inspections-zone-responsive (7), shell (10) → 111 retained
- New Phase 8: 13 tests
- **Total: 124/124**

## O. Database

- No schema changes
- `database/postgresql/schema.sql` unchanged
- No migrations

## P. Legacy Frontend

- `frontend/` preserved
- `frontend/js/pages/inspections.js`, `zonereports.js`, `payments.js` etc. intact
- Old hash router operational

## Q. TanStack Query

- **NOT introduced** (`grep 0`)
- Local state + `useCallback` + `AbortController`

## R. Android

- **NOT started** (intentionally deferred)

## S. Administration

- **NOT started** (Users/Tools/Documents/Audit Logs intentionally deferred)

## T. Git

- Final checkpoint: `86a3051` feat (Phase 6) + `7189ccb` fix + `d4f0ef0` final docs
- Phase 8 added: `a193de9` feat Phase 8 + docs
- Clean working tree
