# Dire Dawa Cleaning Management System — Master Project Registry

> **Status:** Verified against repository at `HEAD fe316b5` (`main`, 80 commits, clean tree) on 2026-09-05.
> This file is the **permanent source of truth** for the entire project.

---

## A. Original Goals

*Manage municipal cleaning operations for Dire Dawa across the full operational lifecycle: workers, attendance, salaries, businesses, fees, payments, inspections, zone reports, locations/GIS, notifications, complaints, reports/analytics, and administration.*

- **Municipal structure:** Dire Dawa, 9 Kebeles, 108 Safer Zones (12 per kebele).
- **Operational scope:** workers, attendance, salary/payroll, inspections, zone reports, businesses, business fees, payments, receipts, tools/equipment.
- **Locations:** kebeles, safer zones, GIS, official geographic boundaries, service areas.
- **Community:** notifications, complaints, support.
- **Reporting:** reports, analytics, CSV/export where implemented, kebele comparisons, operational statistics.
- **Administration:** users, roles, Kebele Admin, zone leaders, assignments, tools, documents, audit logs, settings.
- **Security:** auth, sessions, authorization, kebele isolation, safer-zone isolation, server-authoritative permissions, secret handling, backups, rollback, auditability.
- **UI/UX:** mobile-first, responsive, accessible, design system, dashboards, forms, tables, dialogs, loading/empty/error states.
- **Production:** PostgreSQL, PostGIS, production VPS, DNS, HTTPS/TLS, Nginx, backups, monitoring, rollback, operational handover.
- **Mobile:** Android app for field operations (attendance, inspections, photos, GPS, offline queue & sync).

---

## B. Architecture

```
[ Android (field ops) ]   [ Next.js frontend-next :80/:3000 ]   [ clients ]
              │                         │
              └──────────►  Node.js Express backend :5000  ◄──┘
                                  │
                          PostgreSQL 16 + PostGIS 3.4
```

- **Backend:** Node.js/Express, zero-framework DB access via `pg` (parameterized SQL). Routes in `backend/routes/`.
- **Database:** PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), schema in `database/postgresql/schema.sql`, migration `database/migrations/001_add_lifecycle_fields.js`.
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind-style design system (`frontend-next/`). Uses `lucide-react`, `maplibre-gl`, react-hook-form. No TanStack Query (reverted per `8587bc4`).
- **Android:** `android/` — Kotlin field-operations app.
- **Auth:** custom session table + `x-session-token` header (not express-session/cookies). Middleware in `backend/middleware/auth.js`.
- **Deployment:** `docker-compose.yml` — db, backend, frontend-next. Scripts for backup/health/check-config.

---

## C. Municipal Model (verified)

Structure in `database/postgresql/schema.sql`:

- **9 Kebeles:** `K01`–`K09` (`kebeles` table, `UNIQUE(name)`, `UNIQUE(code)`). Inserted rows at lines 418–422.
- **108 Safer Zones:** 12 per kebele (`safer_zones.name` values `Zone A`–`Zone L` per kebele area); `UNIQUE (name, kebele_id)`, `ON CONFLICT (name, kebele_id) DO NOTHING`. Verified: kebele_id `1..9` each have exactly **12** records.
- Both structural requirements **and** actual seed records.
- Business/worker/hierarchy: `safer_zones.kebele_id`, `safer_zones.leader_id`, `businesses.safer_zone_id`, zone-report uniqueness `(safer_zone_id, report_year, report_month)`, attendance `UNIQUE(worker_id, date)`, payment uniqueness `(business_id, month, year)`.
- Soft-delete/active semantics: `users.is_active`, `workers.is_active`, `businesses.is_active`.

---

## D. Roles & Authorization (as implemented in `backend/middleware/auth.js`)

DB enum `user_role = ('admin','collector','leader','viewer')` (schema.sql line 21).

| Role | Geographic scope | Data visibility | Management permissions | Enforcement |
|------|------------------|-----------------|------------------------|-------------|
| **admin** | All kebeles / city-wide | All data | Full CRUD across modules | `requireRole("admin")` in `requireRole` middleware (documents, tools, users, safer-zones, businesses delete, inspections delete) |
| **collector** | Single assigned kebele | Own kebele data (server-side filtered by `kebeles.collector_id`) | Worker/inspection/business CRUD within kebele | `requireRole("admin","collector")` route guards + SQL `kebele_id` filters |
| **leader** | Own safer zone | Own zone data | Zone data visibility; `zoneAccess` middleware restricts to `safer_zones.leader_id` | `zoneAccess` in auth middleware (admin/collector bypass) |
| **viewer** | Depends on assignment | Read-only | — | `authenticate` only |

- Sessions: DB `sessions` table, expiry `expires_at > NOW()`; token carried in `x-session-token` or `Authorization: Bearer`.
- **Rule recorded: client-side filtering is never the security boundary.** Backend enforces kebele/zone isolation via SQL filters and middleware. UI selector is UX only (`kebeles.collector_id` / `safer_zones.leader_id`), per dashboard banner.
- **Note:** UI calls this role *"Kebele Admin"* while the DB role name is `collector` (permanent terminology decision).

---

## E. Phase Inventory & Completed Work

Phases below were rebuilt/documented during modernization. Numbering in docs is NOT a strict truth; Git history is authoritative. Summary of the 80-commit history (oldest → newest):

### Phase 0 — Baseline & Security Hardening (legacy modernized)
- `4e21450` baseline snapshot; `52ec787` remove exposed secrets; `03c4520` XSS; `2702e71` SQL injection parameterization; `731243c` CORS allowlist; `65073da` session token URLs & secure passwords; `f72ff93` uploads; `5650fe7` webhook secret + `crypto`; `4598147` CSV injection + zone-report state machine.
- `2124884`, `9d9bbb0` security/cross-zone test suites; `8c99637` validation/indexes; `1f71d5e` lifecycle fields + auth hardening + seed fix; `903ba7d` Docker hardening + backups + docs.
- `c6d61cd` Kebele Admin worker management within own kebele.

### Phase 1 — PostgreSQL + PostGIS migration
- `1ddb542` migrate MariaDB → PostgreSQL+PostGIS; docs `8744a78`, `f15498c` (Phase 1 docs). See `docs/modernization/phase-1-postgresql-postgis.md`.

### Phase 2 — UI/UX architecture & design system
- Docs `d51cd28`, `ae65270`, `86eb28a` → `docs/modernization/phase-2-ui-ux-architecture.md` (`phase-2-ui-architecture.md` is an identical duplicate).

### Phase 3 — Next.js foundation & app shell
- `f9d6f20`, `55052d3`, `019be73`, `f6ab655`, `3b48cb3`, `b2e9874`, then `05de766` emoji removal.

### Phase 4 — Workers, Attendance & Salary (Next.js)
- `266c5fb`, `bb9a637`, `e943d6e`, `a4e6b2a`, `7ea0b07`, `2bc2e9d`, `e62ae45`, `8a29f2f`, `ad69268`, `bab7565`, `adf8f92`.
- `57df772` added TanStack Query server state, then **`8587bc4` reverted it** (permanent constraint: no TanStack Query). Docs `e8d156c`.

### Phase 5 — Businesses & Finance
- `bdb8f07` migration; `fc37a5a` gap patch (payment history, payments business filter + transactions, backend collector enforcement, amount validation).

### Phase 6 — Inspections & Zone Reports
- `0227926`, `7189ccb` (inspection table 9-kebele scoping + backend collector enforcement), `86a3051`, `d4f0ef0`.

### Phase 8 — Reports & Analytics
- `983e669` (no fabrication, real backend APIs).

### Phase 9 — Administration
- `ae026c9` (Users, Tools, Documents, Audit, Notifications).

### Phase 10 — Android Foundation — `2551ed2`
### Phase 11 — Android field operations — `0aebe6c` (attendance, inspections, photos, GPS, offline queue & sync)
### Phase 12 — Production GIS & Location Intelligence — `3807d7a` (GeoJSON API, web MapLibre map, Android GIS, inspection GPS→PostGIS)
### Phase 13 — Production hardening security fixes — `4de66d0`
### Phase 14 — Deployment, Observability & Disaster-Recovery Readiness — `39b37a1`
### Phase 18/19/20/23 — Production deployment, go-live, infrastructure spec, verification — `b136f91`, `320787e`, `cc2225d`, `cb1d4b7`, `7643889`

### Post-phase fixes & production infra (verified in-tree)
- `38f803f` remove `--turbopack` (SIGBUS crash on dev server).
- `f29d8b0` Next.js container on :3000 + prerender layout fix.
- `ef474c2` CORS localhost origins.
- `3adb6fa` `.data` property-access safeguard + tools role/query improvements.
- `6157d92` rate limits via env vars (`RATE_LIMIT_API_MAX`/`AUTH`/`LOGIN`).
- `84bd76f` Button default `type="button"` + multer body-parsing order in inspections API.
- `43d101d` **decommission legacy frontend; serve Next.js frontend on ports 80/3000.**

### Dashboard Improvements (see §L — already completed, DO NOT redo)

---

## F. In Progress

- **Production go-live:** infrastructure `BLOCKED` on external municipal IT (see §K). Deployment/pipeline, Docker, docs, verification audit complete.
- No application feature is currently mid-flight; HEAD clean.

---

## G. Module Audit

Legend: ✅ implemented/verified · ⚠️ partial/placeholder · ❎ not implemented in frontend (or backend) · ? unverified.

| Module | Exists | Implemented | Functional | Real data | Authorized | Mobile | A11y | Tests | Placeholder | Notes |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|-------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Charts card = placeholder ("future chart"); Kebeles KPI hardcoded `9` |
| Workers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | `workers.test.tsx` pagination test flaky under parallel load (passes solo) |
| Attendance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | bulk attendance, `UNIQUE(worker_id,date)` |
| Salary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | salary page, per-worker history endpoint |
| Businesses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | count contract defined (BUSINESSES_COUNT_CONTRACT.md) |
| Payments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | `/summary/dashboard`, Telebirr/cbe-birr webhooks, sandbox routes |
| Inspections | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | photos, GPS→PostGIS, multer order fixed |
| Zone Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | stepper, state machine, uniqueness |
| Kebeles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Locations index page is placeholder; real pages under `locations/kebeles` |
| Safer Zones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | `UNIQUE(name,kebele_id)` |
| GIS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Map nav item shows disabled "Soon" in UI |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | admin `generate`, mark-read |
| Complaints | ❎ | ❎ | ❎ | — | — | — | — | — | ⚠️ | No backend API (grep: no `complaints` route), nav item disabled "Soon" |
| Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | monthly/yearly payments, workers, inspections, monthly-summary |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | attendance/payments/inspections/zones/trends |
| Performance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | Page exists & real; **nav item removed** (commit `4a5297e`) — orphaned route reachable only by URL |
| Users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | role-least-privilege DB roles (ddcms_app/ddcms_migrator) |
| Tools | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | CRUD |
| Documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | uploads w/ security validation |
| Audit Logs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | admin-only endpoints |
| My Account / Settings | ⚠️ | ⚠️ | ⚠️ | — | — | — | — | — | ⚠️ | Settings page is a 5-line placeholder; password change exists (`users.js:95`); nav "System" disabled "Soon" |
| Operations index | ⚠️ | ❎ | ❎ | — | — | — | — | — | ⚠️ | `operations/page.tsx` is a placeholder |
| Locations index | ⚠️ | ❎ | ❎ | — | — | — | — | — | ⚠️ | `locations/page.tsx` is a placeholder |
| Businesses index | ⚠️ | ❎ | ❎ | — | — | — | — | — | ⚠️ | `businesses/page.tsx` is a placeholder (payments real) |

---

## H. Frontend Implementations Audit

- **Legacy frontend `frontend/`:** **REMOVED** by commit `43d101d` ("decommission legacy frontend"). No `frontend/` dir exists at repo root as of this audit. This is the official/canonical frontend decision — Next.js `frontend-next/` is THE frontend. (This supersedes any earlier "preserve legacy" constraint; recorded as a **CHANGED decision**.)
- **New frontend `frontend-next/`:** canonical. Next.js 15 + React 19 + TS. Feature-complete across Workers/Attendance/Salary/Businesses/Payments/Inspections/Zone-Reports/Kebeles/Safer-Zones/Reports/Analytics/Administration/Dashboard.
- Public pages: `(public)/login`. App shell: `(app)` with role-aware nav.
- **No duplication remains** (legacy deleted). Remaining cleanup: placeholder index pages, disabled "Soon" nav items (`complaints`, `system`), orphaned `reports/performance` route, GIS map disabled item.

---

## I. Database Audit (verified)

- **PostgreSQL 16 + PostGIS 3.4** (docker image `postgis/postgis:16-3.4`).
- Tables (from `schema.sql`): users, sessions, login_attempts, kebeles, safer_zones, businesses, payments, inspections, inspection_photos, workers, attendance, salary_payments, tools, zone_reports, audit_log, notifications, documents (17 tables). Enums: `user_role`, `inspection_status`, `payment_status` (and any other CHECK-enums in schema).
- Relationships: `safer_zones.kebele_id`, `safer_zones.leader_id`, `businesses.safer_zone_id`, `payments.business_id`, `workers.safer_zone_id` (zone→kebele furnishes kebele scope), `inspection_photos` FK to inspections, cascades where declared.
- Indexes: `idx_sz_kebele`, `idx_workers_active_zone`, `idx_users_role_active`, `idx_inspections_kebele`, `idx_businesses_active`, `idx_doc_kebele`, plus UNIQUE constraints listed above.
- Geometry columns: added in Phase 12 (GIS). PostGIS extension enabled.
- **Roles:** least-privilege `ddcms_app` and `ddcms_migrator` created in schema (lines 491–520); `backend/config/db.js` connects as `DB_USER` (default `ddcms` = least-privilege app role), confirming P0-1's configuration is correct.
- Soft-delete: `is_active` flags on users/workers/businesses.
- **9 Kebeles / 108 Safer Zones: verified present as seed records** (9 kebele rows, 12 zone rows per kebele_id 1–9).

---

## J. Security / Ops Audit

- Auth: DB-backed sessions (`sessions` table), expiry check, `is_active` gate. Server-authoritative authorization via SQL filters + middleware (`requireRole`, `zoneAccess`).
- Secrets: `.env` required; no secrets in tracks (Phase 0 removed them). Webhook secrets separated. `SECRET_ROTATION.md` present.
- Uploads: `uploadSecurity.js` (MIME detection, filename sanitize, size limits).
- Rate limiting: env-configurable (`RATE_LIMIT_API_MAX`/`AUTH`/`LOGIN`).
- CORS: env-based allowlist.
- XSS/SQLi: parameterized queries + sanitization (Phase 0).
- CSV formula injection prevented (Phase 0).
- Audit logs: admin-only read; created on key actions.
- Backups: `scripts/backup-db.sh` (SHA256-tested), `scripts/db-health-check.sh`, `scripts/check-config.sh`; DR docs in `docs/operations/disaster-recovery.md`.

---

## K. Production Status (verified evidence)

| Item | Status | Evidence |
|------|--------|----------|
| Application | Built & tested locally (Docker compose: db + backend + frontend-next) | `docker-compose.yml` |
| Production server | **NOT live** — infrastructure **BLOCKED** (external municipal IT VPS allocation) | `docs/operations/PRODUCTION_INFRASTRUCTURE.md` (status BLOCKED) |
| Public IP / DNS | **BLOCKED** — domain `diredawa-cleaning.gov.et` record unassigned | infra doc line 152 |
| TLS | **BLOCKED** — ACME challenge unfulfilled | infra doc line 153 |
| Database | PostgreSQL+PostGIS ready, backup script tested | backups/ + scripts |
| Backups | Automated `backup-db.sh`, tested | scripts/ |
| Monitoring | Dashboards/docs prepared (errors, DB perf, observability) | docs/operations/* |
| Deployment | Docker Compose verified; ports 80/3000 frontend, 5000 backend; runbook/handover docs written | docs/operations/PRODUCTION_RUNBOOK.md, MUNICIPAL_IT_PRODUCTION_HANDOFF.md, PHASE_23_INFRASTRUCTURE_VERIFICATION.md |

**Do not mark production as live** — public infra remains externally blocked.

---

## L. Dashboard History (already completed — DO NOT REDO)

Recorded from Git history (`git log --oneline`, all verified in HEAD):

| Commit | Change | Status |
|--------|--------|--------|
| `43d101d` | Decommission legacy frontend; serve Next.js on 80/3000 | ✅ |
| `7304d7c` | **Remove fake progress bars** from 9-Kebele Overview | ✅ |
| `4a5297e` | **Remove "Performance" "Coming Soon" disabled nav item** | ✅ |
| `ae5187a` | **9-Kebele Overview: real backend data** (zone count via kebele context, payment achievement via `/payments/summary/dashboard`, honest "Unavailable") | ✅ |
| `879342f` | **Active Workers KPI** → `/workers?status=active` (role/kebele scoped; admin=all, collector=own kebele, leader=own zone) | ✅ |
| `2a82988` | **Businesses KPI** → `/businesses?status=active` (role/kebele scoped) | ✅ |
| `b28c2c4` | **Businesses Count Contract** → `docs/modernization/BUSINESSES_COUNT_CONTRACT.md` (definition, scope, data source, pagination, date/error semantics) | ✅ |
| `fe316b5` | **Safer Zones KPI** → `/safer-zones` (role/kebele scoped; replaces hardcoded 108; filters `is_active !== false`) | ✅ |

Dashboard current live state (`frontend-next/src/app/(app)/dashboard/page.tsx`):
- Kebeles StatCard: **hardcoded `9`** (only remaining hardcoded KPI).
- Safer Zones / Active Workers / Businesses StatCards: real from backend with loading/error/empty states.
- Operational overview card: placeholder ("Monthly revenue future chart", "Attendance future", skeleton `animate-pulse`).
- 9-Kebele Overview: real zone counts + payment achievement; workers "Unavailable" (no baseline); inspection % "Unavailable" (no authoritative expected-inspection baseline).

**Remaining nav "Soon" items (verified):** `complaints` (Community), `system` (Settings). GIS `map` renders disabled "Soon". `reports/performance` page exists but its nav item was removed (reachable by URL only).

---

## M. Prioritized Backlog

Priorities: **P0** critical/security/data-integrity · **P1** core ops · **P2** important · **P3** UX/polish · **FUTURE** deferred.

- **P0**
  - P0-1 Verify production `DB_USER` peers with least-privilege role. `backend/config/db.js` defaults `DB_USER` to `ddcms` (least-privilege app role created in schema). Confirm on provisioning that the role maps to `ddcms_app`-style privileges, not superuser.
- **P1**
  - P1-1 Dashboard Kebeles KPI: replace hardcoded `9` with backend count (consistent with other KPIs).
  - P1-2 Decide & implement `complaints` module (backend API + frontend) OR explicitly classify as deferred/rejected.
  - P1-3 Decide & implement `system`/Settings module (backend + frontend) OR classify deferred/rejected.
  - P1-4 Resolve flaky `workers.test.tsx` pagination test (timeout under parallel vitest load) to make 147/147 reliable.
- **P2**
  - P2-1 Add real dashboard charts (monthly revenue / attendance) replacing the placeholder card — only from backend-exposed dimensions, no fabrication.
  - P2-2 Implement Operations index page (currently placeholder) with real navigation content.
  - P2-3 Implement Locations index page (currently placeholder).
  - P2-4 Implement Businesses index page (currently placeholder).
  - P2-5 Implement My Account/Settings page (password change exists in API) incl. "System" sub-sections.
  - P2-6 Re-link or remove `reports/performance` route (nav item removed; page orphaned).
- **P3**
  - P3-1 GIS map in web UI (currently disabled "Soon") once geo data/boundaries are available.
  - P3-2 Kebele comparisons / operational-statistic enhancements without fabrication.
  - P3-3 Any remaining "Loading/empty/error" state gaps across modules.
- **FUTURE (deferred)**
  - Business fee/receipt printing if not already present. (Verify `receipt_number` — receipts exist at DB level.)
  - Android/Play Store publishing — deferred unless explicitly activated.
  - Route optimization — rejected.
  - Continuous GPS tracking — rejected.
  - Any database replacement — rejected.

---

## N. Rating Legend per item

Each backlog item must map to one classification:
**COMPLETED / PARTIALLY COMPLETE / NEXT / BACKLOG / DEFERRED / REJECTED / BLOCKED / UNKNOWN.**
Unknown items must remain UNKNOWN until evidence exists (never assume COMPLETED).

---

## O. Permanent Constraints (agents MUST NOT violate)

1. PostgreSQL + PostGIS (no database replacement).
2. 9 Kebeles / 108 Safer Zones (12 per kebele) — structural and seed truth.
3. Backend-authoritative authorization; client-side filtering is never the security boundary; role isolation must be enforced server-side via SQL + middleware.
4. Kebele Admin UI terminology while DB role is `collector`.
5. No fabricated municipal data, GIS, metrics, or tests.
6. No TanStack Query (reverted `8587bc4`).
7. No continuous GPS tracking; no route optimization.
8. No unnecessary database/schema replacement; changes only when required and verified.
9. Mobile-first; accessible; production-safe changes.
10. **One incremental improvement at a time** — ONE TASK = ONE COMPLETE IMPROVEMENT, tested, verified, committed, STOP.
11. Android/Play Store work is deferred unless explicitly activated.
12. Legacy frontend was decommissioned (`43d101d`); do not re-add it. The `frontend-next/` directory is the only frontend.
13. No fabricated progress bars / fake KPIs (honest "Unavailable" when no authoritative data).
14. Production infra not marked live until externally verified (currently BLOCKED).

---

## P. Future Agent Operating Procedure (mandatory)

Every future task MUST:

1. Read `MASTER_PROJECT_REGISTRY.md` first.
2. Inspect current repository state (`git log -1`, `git status`).
3. Verify recent completed work listed in §E/§L.
4. Select exactly **ONE** highest-value unfinished item from §M.
5. Define acceptance criteria for it.
6. Implement ONLY that item.
7. Test it (frontend: `npx vitest run` from `frontend-next/`; backend: `npm test` from `backend/`).
8. Manually verify it.
9. Update `MASTER_PROJECT_REGISTRY.md` (move item to COMPLETED; add evidence).
10. Commit the change with a clear message.
11. **STOP.**

The agent — not the user — maintains the prioritized roadmap in §M. The user selects authorization for new/external-scope work only.

---

## Q. Test Baseline (verified 2026-09-05)

| Check | Result | Command / notes |
|-------|--------|-----------------|
| Frontend tests | 147/147 (15 files; 1 transient timeout re-passes solo) | `npx vitest run` from `frontend-next/` |
| Backend tests | 161 passing, 2 pending, 0 failing (10 suites) | `npm test` from `backend/` (NODE_ENV=test) |
| Lint (frontend) | script: `next lint` | run before changes |
| Typecheck (frontend) | `tsc --noEmit` | run before changes |
| Build (frontend) | `next build` (no `--turbopack`) | dev needs plain `next dev` |
| Database validation | 9 kebeles / 108 zones verified in schema seed | `validate-migration.js`, `db-health-check.sh` |
| Security validation | XSS/SQLi/auth cross-zone suites in backend tests | `security.test.js`, `authorization.test.js` |
| Route syntax | All backend routes pass `node --check` | verified in Phase 16 |
| Git | 80 commits, `main`, clean tree, HEAD `fe316b5` | 2026-09-05 |

---

## R. Verification Notes & Contradictions Flagged

- `phase-2-ui-architecture.md` and `phase-2-ui-ux-architecture.md` are byte-identical duplicates — safe to converge later.
- `reports/performance/page.tsx` exists & functional, but nav item removed (`4a5297e`); orphaned route — flag for P2-6.
- Dashboard "Operational overview" card still a placeholder — this is a backlog item, not an error.
- `businesses/page.tsx`, `operations/page.tsx`, `locations/page.tsx`, `settings/page.tsx` are placeholder pages — backlog items, not modules missing entirely.
- Production docs exist and are thorough, but **public infrastructure is BLOCKED externally** — no "live" claims.