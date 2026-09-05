# MASTER PROJECT REGISTRY

**Dire Dawa Cleaning Management System — single authoritative project-memory and roadmap document.**

---

## 0. DOCUMENT CONTROL

```text
Registry Version:        2.0
Last Updated:            2026-09-05
Last Audited:            2026-09-05
Current Project Status:  STEADY — no mid-flight feature work; production infra externally BLOCKED
Current Phase:           Post-modernization incremental improvements (Phase 24 audit + roadmap)
Current Release:         1.0.0 (pre-production; local Docker compose verified)
Current Repository HEAD: fe316b5 (main, 80 commits, clean tree)
Registry Owner:          opencode agent (maintains roadmap; user authorizes scope)
```

**Source of Truth Priority:**
1. Actual repository implementation
2. Database/schema
3. Git history
4. Existing project documentation
5. Approved requirements/decisions
6. Conversation history only when repository evidence is unavailable

---

## 1. PROJECT IDENTITY

### 1.1 Official Name

```text
Dire Dawa Cleaning Management System
```

### 1.2 Organization

```text
Dire Dawa City Administration
Sanitation/Cleaning Department
```

### 1.3 Mission

Digitize and manage the city's cleaning operations end-to-end — workers, attendance, wages, businesses, fees, payments, inspections, zone reporting, and GIS — while keeping every data point authoritative, role-isolated, and operationally honest (no fabricated metrics).

### 1.4 Primary Objective

Replace the legacy static-HTML/MariaDB tool with a maintainable, mobile-first, secure system built on PostgreSQL + PostGIS and a modern Next.js frontend, deployable for municipal IT on a VPS with real HTTPS, backups, monitoring, and handover documentation.

---

## 2. CORE MUNICIPAL MODEL

```text
Dire Dawa
├── 9 Kebeles
│   ├── K01 Kebele 01 … K09 Kebele 09
└── 108 Safer Zones
    └── 12 per Kebele (Zone A … Zone L per kebele area)
```

Documented facts (verified in `database/postgresql/schema.sql`):
- **9-kebele requirement:** structural (unique codes K01–K09) and seeded as records (lines 418–422).
- **108-safer-zone requirement:** `UNIQUE (name, kebele_id)`, 12 zones per kebele. Verified: kebele_id `1..9` each has exactly 12 records.
- **Geographic relationships:** `safer_zones.kebele_id → kebeles`; `safer_zones.leader_id → users`; `workers.safer_zone_id`; `businesses.safer_zone_id`; `inspections.location` point.
- **Official data requirement:** kebele/zone boundaries are official municipal geographic data.
- **GIS requirement:** PostGIS MULTIPOLYGON boundaries + POINT locations (SRID 4326).

Three distinct truths (must not be conflated):
```text
Required structure      → 9 kebeles, 108 zones, 12/kebele (design invariant)
Actual production records → seed data present in schema; runtime records depend on usage
Official GIS dataset    → NOT yet loaded (boundaries column exists; municipal dataset unavailable)
```

---

## 3. SYSTEM ARCHITECTURE

### 3.1 Frontend (canonical)
- **Next.js 15.3.5 + React 19 + TypeScript**, App Router.
- Tailwind-style utility styling driven by design tokens (`frontend-next/src/styles/tokens.css`).
- Component library under `src/components/ui/` (button, card, badge, data-table, modal, drawer, form, select, input, tabs, toast, tooltip, skeleton, pagination, breadcrumb, dropdown, icon, alert, checkbox, network-status).
- Central API client `src/lib/api.ts` (all requests go through it; no direct `fetch` in components).
- Domain types in `src/types/domain.ts`.
- Feature modules under `src/app/(app)/…` grouped by operation/locations/businesses/reports/administration/community/settings.

### 3.2 Legacy Frontend
```text
frontend/
```
- **Current status:** REMOVED (decommissioned by commit `43d101d`). No `frontend/` directory exists at repo root as of this audit. This is a deliberate, recorded decision (CHANGED from the earlier "preserve legacy" constraint). Do not re-add.

### 3.3 Backend
- **Runtime:** Node.js/Express (`backend/server.js`, port 5000).
- **API architecture:** route modules in `backend/routes/` (auth, workers, businesses, payments, inspections, zoneReports, locations, gis, reports, analytics, users, tools, documents, auditLog, notifications, public, sandbox); validation via `middleware/schemas.js` + `validate.js`.
- **Authentication:** DB-backed `sessions` table; `x-session-token` or `Authorization: Bearer`; expiry `expires_at > NOW()`.
- **Authorization:** `middleware/auth.js` — `authenticate`, `requireRole(...)`, `zoneAccess`; kebele/zone isolation enforced server-side in SQL.
- **Data access:** `pg` parameterized queries (no ORM). Config in `backend/config/db.js` (default `DB_USER=ddcms`).

### 3.4 Database
- **PostgreSQL 16 + PostGIS 3.4** (`postgis/postgis:16-3.4`), schema `database/postgresql/schema.sql`.
- **Prisma:** NOT used. Migration strategy = SQL schema + `database/migrations/001_add_lifecycle_fields.js` + `MIGRATIONS.md`.
- **Database users (least privilege):** `ddcms` (app), `ddcms_migrator` (migrations) — created in schema (lines 491–520).
- **Extensions:** `postgis`, `uuid-ossp`.
- **Geometry architecture:** kebele/zone MULTIPOLYGON boundaries; businesses/inspections/workers POINT locations; all SRID 4326; GIST spatial indexes (line 409).

### 3.5 Infrastructure
- **Docker:** `docker-compose.yml` — `db` (PostGIS), `backend`, `frontend-next` (ports 80/3000 frontend, 5000 backend, 5432 db) with healthchecks + resource limits.
- **systemd/Nginx:** documented only (production target); NOT deployed. Nginx config is specified in `PRODUCTION_INFRASTRUCTURE.md`.
- **DNS/TLS:** BLOCKED (external municipal IT).
- **Backup infrastructure:** `scripts/backup-db.sh` (SHA256-tested), `db-health-check.sh`, `check-config.sh`.
- **Monitoring:** documented dashboards only (error-metrics, DB-performance, observability docs); not live.

---

## 4. CURRENT REPOSITORY STRUCTURE

```text
frontend-next/   Canonical Next.js frontend (components, lib, app, styles, types, test)
backend/         Express API (routes, middleware, config, services, test, uploads)
database/        PostgreSQL schema, migrations, PostGIS, seed
android/         Kotlin field-operations app (Phases 10–12)
docs/            modernization/ + operations/ + security/ + migration/
scripts/         backup-db.sh, db-health-check.sh, check-config.sh
backups/         backup outputs
docker-compose.yml
.env.example / .env   environment configuration (secrets never committed)
README.md
.github/         CI workflow
```

Only architecturally important locations are listed.

---

## 5. ROLE AND AUTHORIZATION MODEL

| Role        | UI Name      | Database Role/ID | Geographic Scope | Management Scope | Status |
| ----------- | ------------ | ---------------- | ---------------- | ---------------- | ------ |
| Admin       | Admin        | `admin`          | City-wide (all 9 kebeles) | Full CRUD across all modules | COMPLETE |
| Collector   | Kebele Admin | `collector`      | Assigned kebele (`kebeles.collector_id`) | Worker/inspection/business CRUD in own kebele | COMPLETE |
| Zone Leader | Zone Leader  | `leader`         | Own safer zone (`safer_zones.leader_id`) | Zone data visibility; `zoneAccess` enforced | COMPLETE |
| Worker      | Worker       | (see note)       | Own record / attendance | None (field role) | UNKNOWN across backend; frontend has no worker app role |
| Viewer      | Viewer       | `viewer`         | Depends on assignment | Read-only | COMPLETE |

- **Authentication:** DB sessions, token in `x-session-token`/Bearer, expiry enforced.
- **Authorization:** `requireRole(...roles)` (403 on mismatch), `zoneAccess` (leader restricted to own `safer_zones.leader_id`).
- **Geographic scope:** collector scoped by SQL `kebele_id`; leader by `safer_zones.leader_id`; admin unconstrained.
- **Resource permissions:** per-route guards (`requireRole("admin")` on users/tools/documents/safer-zones-mutations/businesses-delete/inspections-delete; `requireRole("admin","collector")` on operational CRUD).
- **Backend enforcement:** all isolation in SQL + middleware; tested by `authorization.test.js`.
- **Frontend visibility:** role-aware nav; selector is UX-only (see Dashboard banner). 
- **Note:** "Worker" as a login role is not represented in the `user_role` enum (`admin`,`collector`,`leader`,`viewer`).

> **Permanent rule: Client-side filtering is never the security boundary.**

---

## 6. FUNCTIONAL MODULE REGISTRY

Status values: COMPLETE / PARTIAL / IN PROGRESS / BACKLOG / DEFERRED / BLOCKED / UNKNOWN.

### 6.1 Dashboard
- Status: PARTIAL
- Route: `/dashboard` (`src/app/(app)/dashboard/page.tsx`)
- Backend: `/workers?status=active`, `/businesses?status=active`, `/safer-zones`, `/payments/summary/dashboard`
- Real data: yes (Safer Zones, Active Workers, Businesses KPIs; 9-Kebele Overview zone counts + payment achievement)
- Authorization: role/kebele-scoped query params; backend authoritative
- Mobile: yes; Accessibility: yes; Tests: yes (dashboard responsive suite)
- Placeholders: Kebeles KPI hardcoded `9`; "Operational overview" chart card (future)
- Known limitations: no charts yet; workers "Unavailable" per kebele; inspection % "Unavailable" (no baseline)
- Next candidate: P1-1 (Kebeles KPI → backend count)

### 6.2 Workers
- Status: COMPLETE (minor test flakiness noted). Backend: `/workers`, `/workers/:id/attendance`, `/workers/:id/salary`, `/workers/summary/stats`. Real data/authorization/mobile/a11y/tests: yes. Limitation: `workers.test.tsx` pagination test times out intermittently under parallel vitest load (passes solo) — tracked P1-4.

### 6.3 Attendance
- Status: COMPLETE. Bulk attendance, `UNIQUE(worker_id,date)`, date/context/search/summary/table.

### 6.4 Salary
- Status: COMPLETE. Salary page + per-worker history; `salary_payments` table.

### 6.5 Businesses
- Status: COMPLETE (page index placeholder noted §21). Contract in `BUSINESSES_COUNT_CONTRACT.md`; KPI uses `/businesses?status=active`.

### 6.6 Payments
- Status: COMPLETE. `/payments`, `/summary/dashboard`, `/payments/:id/verify`, Telebirr/cbebirr webhooks, sandbox checkout/callback.

### 6.7 Inspections
- Status: COMPLETE. Photos, GPS→PostGIS, status enum, 9-kebele scoping + collector enforcement; multer body-parsing order fixed.

### 6.8 Zone Reports
- Status: COMPLETE. Stepper UI, state machine, `UNIQUE(safer_zone_id, report_year, report_month)`.

### 6.9 Kebeles
- Status: COMPLETE (module), Locations index page is a placeholder (see §21). `/kebeles`, `/kebeles/:id` (PUT admin).

### 6.10 Safer Zones
- Status: COMPLETE. `/safer-zones` CRUD (admin), `UNIQUE(name,kebele_id)`.

### 6.11 GIS
- Status: PARTIAL. GeoJSON APIs (`/gis/kebeles`, `/gis/safer-zones`, `/gis/businesses`, `/gis/workers`, `/gis/inspections`), MapLibre map component, Android GIS. Web nav renders map as disabled "Soon"; official boundaries unavailable. Backlog P3-1.

### 6.12 Notifications
- Status: COMPLETE. `/notifications`, unread-count, mark-read, read-all, admin generate.

### 6.13 Complaints
- Status: UNKNOWN → effectively NOT IMPLEMENTED. No backend route exists (grep verified); nav item `complaints` disabled "Soon". Backlog P1-2 (decision required).

### 6.14 Reports
- Status: COMPLETE. `/reports/payments/monthly|yearly`, `/reports/workers/monthly`, `/reports/inspections`, `/reports/monthly-summary`.

### 6.15 Analytics
- Status: COMPLETE. `/analytics/attendance|payments|inspections|zones|trends`.

### 6.16 Users
- Status: COMPLETE. `/users` CRUD (admin), `/users/leaders`.

### 6.17 Tools
- Status: COMPLETE. `/tools` CRUD.

### 6.18 Documents
- Status: COMPLETE. `/documents`, upload/download with `uploadSecurity.js` validation.

### 6.19 Audit Logs
- Status: COMPLETE. `/auditLog` (admin-only read).

### 6.20 My Account / Settings
- Status: PARTIAL. Password change API exists (`/users/:id/password`); Settings page is a placeholder; nav `system` disabled "Soon". Backlog P1-3/P2-5.

---

## 7. FEATURE REQUIREMENTS REGISTRY

| ID | Requirement | Module | Priority | Status | Evidence | Notes |
| -- | ----------- | ------ | -------- | ------ | -------- | ----- |
| REQ-MUN-001 | 9 Kebeles, 108 Safer Zones, 12/kebele | Municipal | P0 | COMPLETE | schema.sql seed + UNIQUE constraints | Verified count per kebele_id |
| REQ-OPS-001 | Worker management (CRUD, active/inactive) | Workers | P1 | COMPLETE | `workers.js`, Workers page | |
| REQ-OPS-002 | Attendance (single + bulk, uniqueness) | Attendance | P1 | COMPLETE | `workers.js:315,381`, attendance tests | |
| REQ-OPS-003 | Salary/payroll tracking | Salary | P1 | COMPLETE | `salary_payments`, Salary page | |
| REQ-BIZ-001 | Business registration with safer-zone link | Businesses | P1 | COMPLETE | `locations.js`, Businesses page | |
| REQ-PAY-001 | Payments by business/month, webhooks | Payments | P1 | COMPLETE | `payments.js`, sandbox | |
| REQ-INSP-001 | Cleanliness inspections + photos + GPS | Inspections | P1 | COMPLETE | `inspections.js`, inspections page | |
| REQ-ZREP-001 | Zone reports with status workflow | Zone Reports | P1 | COMPLETE | `zoneReports.js`, stepper UI | |
| REQ-GIS-001 | PostGIS boundaries + point locations | GIS | P1 | PARTIAL | schema geometry, gis.js | Official boundaries deferred |
| REQ-GIS-002 | Web map visualization | GIS | P2 | PARTIAL | MapLibre component | Nav disabled "Soon" |
| REQ-COM-001 | Complaints from community | Complaints | P1 | UNKNOWN | no route/page | P1-2 decision required |
| REQ-REP-001 | Reports + CSV where implemented | Reports | P1 | COMPLETE | reports.js | |
| REQ-ANA-001 | Analytics & kebele comparisons | Analytics | P1 | COMPLETE | analytics.js | |
| REQ-ADM-001 | Users/roles administration | Users | P1 | COMPLETE | users.js | |
| REQ-ADM-002 | Tools/equipment registry | Tools | P1 | COMPLETE | tools.js | |
| REQ-ADM-003 | Documents storage | Documents | P1 | COMPLETE | documents.js | |
| REQ-ADM-004 | Audit logs | Audit Logs | P1 | COMPLETE | auditLog.js | |
| REQ-ADM-005 | Settings / My Account | Settings | P1 | PARTIAL | users.js:95; placeholder page | |
| REQ-SEC-001 | Server-authoritative kebele/zone isolation | Security | P0 | COMPLETE | auth.js, SQL filters, authorization tests | |
| REQ-SEC-002 | Sessions, secrets, CORS, rate limits | Security | P0 | COMPLETE | Phase 0 commits, env config | |
| REQ-DASH-001 | Dashboard KPIs with real backend data | Dashboard | P1 | COMPLETE | dashboard commits §19/§20 | Kebeles KPI hardcoded |
| REQ-MOB-001 | Android field operations | Android | P1 | COMPLETE | android/ (Phases 10–12) | Play Store deferred |
| REQ-PROD-001 | Production deployment | Production | P1 | BLOCKED | infra docs | External municipal IT |

---

## 8. FEATURE PARITY / FRONTEND MIGRATION

| Dimension | Legacy `frontend/` | New `frontend-next/` | Status |
| --------- | ------------------ | -------------------- | ------ |
| Functionality | Removed | All modules implemented | MIGRATED (obsolesced) |
| Routes | N/A | App Router | MIGRATED |
| Authentication | N/A | Token sessions | MIGRATED |
| Data integration | N/A | `lib/api.ts` → backend | MIGRATED |
| Permissions | N/A | Role-aware nav + backend | MIGRATED |
| Mobile | N/A | Responsive + bottom nav | MIGRATED |
| Accessibility | N/A | Audit maintained | MIGRATED |
| Public landing | plan | `(public)/login` | MIGRATED |

The legacy frontend is fully **OBSOLETE** and removed (see §3.2). Partial/not-migrated items are tracked in §21 placeholders, not as legacy parity gaps.

---

## 9. API REGISTRY

| Endpoint | Method | Module | Auth | Scope | Input Validation | Pagination | Status |
| -------- | ------ | ------ | ---- | ----- | ---------------- | ---------- | ------ |
| `/api/auth/login` | POST | Auth | public | — | yes | — | COMPLETE |
| `/api/auth/logout` | POST | Auth | auth | — | — | — | COMPLETE |
| `/api/auth/me` | GET | Auth | auth | — | — | — | COMPLETE |
| `/api/health` | GET | Health | public | — | — | — | COMPLETE |
| `/api/public/stats` | GET | Public | public | city | — | — | COMPLETE |
| `/api/workers` | GET | Workers | auth | role/kebele | yes | yes | COMPLETE |
| `/api/workers/summary/stats` | GET | Workers | auth | role/kebele | — | — | COMPLETE |
| `/api/workers` | POST | Workers | admin/collector | own kebele | yes | — | COMPLETE |
| `/api/workers/attendance/bulk` | POST | Attendance | admin/collector | own kebele | yes | — | COMPLETE |
| `/api/workers/:id/attendance` | GET | Attendance | auth | role/kebele | yes | yes | COMPLETE |
| `/api/workers/:id/salary` | GET | Salary | auth | role/kebele | yes | — | COMPLETE |
| `/api/businesses` | GET | Businesses | auth | role/kebele | yes | yes | COMPLETE |
| `/api/businesses` | POST | Businesses | admin/collector | own kebele | yes | — | COMPLETE |
| `/api/kebeles` | GET | Kebeles | auth | — | — | — | COMPLETE |
| `/api/safer-zones` | GET | Safer Zones | auth | role/kebele | — | — | COMPLETE |
| `/api/payments` | GET | Payments | auth | role/leader | yes | yes | COMPLETE |
| `/api/payments/summary/dashboard` | GET | Payments | auth | role/leader | yes | — | COMPLETE |
| `/api/payments/callback/telebirr` | POST | Payments | webhook | — | yes | — | COMPLETE |
| `/api/payments/callback/cbebirr` | POST | Payments | webhook | — | yes | — | COMPLETE |
| `/api/inspections` | GET | Inspections | auth | role/kebele | yes | yes | COMPLETE |
| `/api/zone-reports` | GET | Zone Reports | auth | role/kebele | yes | yes | COMPLETE |
| `/api/gis/kebeles` | GET | GIS | auth | city | — | — | COMPLETE |
| `/api/gis/safer-zones` | GET | GIS | auth | role | — | — | COMPLETE |
| `/api/reports/payments/monthly` | GET | Reports | auth | role | yes | — | COMPLETE |
| `/api/analytics/attendance` | GET | Analytics | auth | role | — | — | COMPLETE |
| `/api/analytics/zones` | GET | Analytics | auth | role | — | — | COMPLETE |
| `/api/users` | GET/POST | Users | admin | city | yes | yes | COMPLETE |
| `/api/users/:id/password` | PUT | Settings | self/admin | — | yes | — | COMPLETE |
| `/api/tools` | GET/POST | Tools | admin | city | yes | yes | COMPLETE |
| `/api/documents` | GET | Documents | auth | role/kebele | yes | yes | COMPLETE |
| `/api/auditLog` | GET | Audit Logs | admin | city | — | yes | COMPLETE |
| `/api/notifications` | GET | Notifications | auth | user | — | — | COMPLETE |
| `/api/sandbox/sandbox-checkout` | GET | Payments sandbox | auth | — | — | — | COMPLETE |

Only meaningful endpoints listed.

---

## 10. DATABASE REGISTRY

### Tables

| Table | Purpose | Key Relationships | Status |
| ----- | ------- | ----------------- | ------ |
| users | System users (login/roles) | sessions, kebeles.collector_id, safer_zones.leader_id | COMPLETE |
| sessions | Auth tokens | users ON DELETE CASCADE | COMPLETE |
| login_attempts | Brute-force lockout | (username, ip) | COMPLETE |
| kebeles | 9 kebeles | safer_zones.kebele_id, businesses (via zone) | COMPLETE |
| safer_zones | 108 zones | kebeles, users(leader), workers, businesses | COMPLETE |
| businesses | Registered businesses | safer_zones, payments | COMPLETE |
| payments | Fee payments/status | businesses, receipt/gateway refs | COMPLETE |
| inspections | Cleanliness inspections | safer_zones(implicit), inspection_photos | COMPLETE |
| inspection_photos | Inspection photo evidence | inspections | COMPLETE |
| workers | Cleaning workers | safer_zones | COMPLETE |
| attendance | Daily attendance | workers `UNIQUE(worker_id,date)` | COMPLETE |
| salary_payments | Wage payments | workers | COMPLETE |
| tools | Equipment registry | — | COMPLETE |
| zone_reports | Monthly zone reports | safer_zones `UNIQUE(safer_zone_id,report_year,report_month)` | COMPLETE |
| audit_log | Audit trail | users (context) | COMPLETE |
| notifications | User notifications | users | COMPLETE |
| documents | Uploaded documents | users/optional kebele | COMPLETE |

### Enums
- `user_role`: admin, collector, leader, viewer
- `business_type`: shop, cafe, hotel, restaurant, pharmacy, market, workshop, office, school, clinic, other
- `payment_method`: cash, mobile, bank, other, telebirr, cbebirr
- `payment_status`: paid, pending, overdue, failed
- `inspection_status`: active, warning, danger
- `tool_category`: vehicle, equipment, uniform, chemical, other
- `tool_condition`: good, fair, poor, broken
- `report_status`: draft, submitted, reviewed, approved
- `document_category`: contract, photo, training, incident, report, other

### Geometry
- Types: `GEOMETRY(MULTIPOLYGON, 4326)` (kebeles.boundary, safer_zones.boundary); `GEOMETRY(POINT, 4326)` (businesses.location, inspections.location, workers.location).
- SRID: 4326 consistently.
- GIS relationships: zone→kebele; boundaries owned by municipal dataset.
- Validation rules: never fabricate official boundaries/coordinates; geometries must be POSTGIS-valid.

### Constraints
- FKs with cascades/SET NULL as declared; `UNIQUE(name,kebele_id)` on safer_zones; `UNIQUE(name)`/`UNIQUE(code)` kebeles; `UNIQUE(worker_id,date)` attendance; `UNIQUE(business_id,month,year)` payments; zone-report uniqueness.
- `update_updated_at()` trigger on all operational tables.

### Indexes
- `idx_sz_kebele`, `idx_workers_active_zone`, `idx_users_role_active`, `idx_inspections_kebele`, `idx_businesses_active`, `idx_doc_kebele`, GIST spatial indexes, login_attempts indexes.

---

## 11. DATA DEFINITIONS / BUSINESS RULES

- **Active Worker** — Definition: worker with `is_active=TRUE`. Source: `GET /workers?status=active` (backend filters `w.is_active=TRUE`). Included: active in scope (admin=city, collector=own kebele, leader=own zone). Excluded: inactive. Formula: count of active workers.
- **Active Business** — Definition: business with `is_active=TRUE`. Source: `GET /businesses?status=active` (backend `b.is_active=TRUE`). Contract: `BUSINESSES_COUNT_CONTRACT.md`. Formula: count of active businesses in scope.
- **Payment Achievement** — Definition: collected/pending/overdue totals + by-kebele collected vs target. Source: `/payments/summary/dashboard`. Formula: `SUM(amount)` where `status` in totals; `SUM(b.monthly_target)` target.
- **Inspection %** — Definition: NOT defined (no authoritative expected-inspection baseline). Dashboard shows "Unavailable" honestly.
- **Attendance** — Definition: attendance record per worker per date; `UNIQUE(worker_id,date)`; bulk allowed.
- **Kebele** — Definition: one of 9 municipal kebeles, K01–K09; scope unit for collectors.
- **Safer Zone** — Definition: one of 108 zones; 12 per kebele; scope unit for leaders.
- **Zone Report** — Definition: monthly report per safer zone; unique per `(safer_zone_id, year, month)`; status workflow draft→submitted→reviewed→approved.
- **Safer Zone Count (KPI)** — Definition: count of safer zones in scope, excluding `is_active=false`. Source: `GET /api/safer-zones`.

---

## 12. DASHBOARD METRIC CONTRACTS

| KPI | Definition | Source | Scope | Calculation | Status |
| --- | ---------- | ------ | ----- | ----------- | ------ |
| Kebeles | 9 (currently hardcoded) | `dashboard/page.tsx` | admin | count (TBD backend) | P1-1 |
| Safer Zones | count of zones, active-only | `GET /api/safer-zones` | role/kebele | length of returned rows `is_active!==false` | COMPLETE |
| Active Workers | count of `is_active` workers | `GET /workers?status=active` | role/kebele | count of returned workers | COMPLETE |
| Businesses | count of `is_active` businesses | `GET /businesses?status=active` | role/kebele | count (see contract) | COMPLETE |
| Payment achievement | collected vs target by kebele | `/payments/summary/dashboard` | role/leader | SUM(paid amount); target SUM | COMPLETE |
| Workers per kebele | per-kebele counts | none authoritative | kebele | "Unavailable" (no baseline) | LIMITATION |
| Inspection % | expected-vs-actual inspections | none authoritative | — | "Unavailable" | LIMITATION |

Dedicated contract: `docs/modernization/BUSINESSES_COUNT_CONTRACT.md`.

---

## 13. UI/UX DESIGN SYSTEM

- **Tokens:** `frontend-next/src/styles/tokens.css` — the single source of truth. Typography (Inter + Segoe fallback), spacing (4–64 scale `--s-1..--s-16`), radii, shadows, breakpoints (`--bp-sm 480 / md 768 / lg 1024 / xl 1280`), z-layers, semantic status colors (draft/submitted/reviewed/approved), dark-mode tokens prepared but opt-in.
- **Icons:** centralized Lucide component (`components/ui/icon.tsx`); emojis removed from modules.
- **Components:** shadcn-style primitives in `components/ui/` (see §3.1).
- **Responsive/mobile-first:** shell with sidebar (desktop) + bottom nav (mobile); grid collapses; mobile attendance/workers tested.
- **Tables:** `data-table.tsx` + `pagination.tsx`; server pagination.
- **Forms:** react-hook-form + inputs in `form.tsx`/`input.tsx`/`select.tsx`/`textarea.tsx`; validation.
- **Dialogs/modals/drawers:** `modal.tsx`, `drawer.tsx`, `dialog`-accessible; focus management.
- **Cards:** `card.tsx` with `StatCard` variants.
- **States:** loading (skeleton), empty ("no data" text), error (alert), success (toast); `network-status.tsx` offline banner.
- **Rule:** no unapproved second design system — tokens are the contract.

---

## 14. ACCESSIBILITY REQUIREMENTS

- **Target:** WCAG AA (per phase 2/3 audits); responsive suite includes a11y checks.
- **Keyboard behavior:** tested for login (Tab order), dialogs, buttons (`Button` defaults `type="button"`), drawer focus.
- **Labels:** accessible labels on forms (login test verifies).
- **Semantic structure:** headings, roles, aria attributes on nav/disabled items (`aria-disabled`).
- **Contrast:** token-driven semantic colors meet contrast for text combinations.
- **Touch targets:** mobile nav/buttons ≥ 44px where applicable.
- **Responsive accessibility:** tests under `src/test/responsive*.test.tsx`.
- Known defects tracked separately; none active beyond flaky workers pagination test.

---

## 15. SECURITY REQUIREMENTS

| Check | Status |
| ----- | ------ |
| Authentication (session tokens, expiry) | VERIFIED |
| Sessions (DB-backed, revocable) | VERIFIED |
| Password handling (bcrypt, secure change) | VERIFIED |
| Authorization (requireRole, zoneAccess) | VERIFIED |
| IDOR prevention (role/kebele-scoped queries) | VERIFIED |
| Kebele isolation | VERIFIED |
| Safer-zone isolation | VERIFIED |
| Input validation (schemas) | VERIFIED |
| Secret handling (.env required; webhook secret separate) | VERIFIED |
| CORS (env allowlist) | VERIFIED |
| Headers (Phase 0 hardening) | VERIFIED |
| Database privileges (least privilege ddcms/ddcms_migrator) | VERIFIED in schema; confirm on provisioning (P0-1) |
| Logging (correlationId, audit_log) | VERIFIED |
| Backups (backup-db.sh SHA256-tested) | VERIFIED |
| Rollback (docs + docker volumes) | PARTIAL (documented, not executed in prod) |

---

## 16. GIS REQUIREMENTS

- **PostGIS:** enabled (extension), SRID 4326.
- **Geometry types:** MULTIPOLYGON boundaries (kebeles, safer_zones); POINT (businesses, inspections, workers).
- **Kebele/safer-zone boundaries:** columns exist; official municipal dataset NOT loaded.
- **Point data:** stored from inspections (GPS→PostGIS, Phase 12); worker/business points available for future.
- **Map behavior:** MapLibre component exists (`features/gis`); web nav map disabled "Soon".
- **Mobile GIS:** Android field ops capture GPS (Phase 11/12).
- **Official-data requirement:** boundaries must come from official municipal dataset.

> **Permanent rule: Never fabricate official geographic coordinates or boundaries.**

---

## 17. DATA INTEGRITY REQUIREMENTS

- Duplicate records: UNIQUE constraints prevent zone/name, worker/date, business/month/year, receipts (`receipt_number`, gateway_ref).
- Orphan zones: FKs enforce zone→kebele; ON DELETE as declared.
- Cross-kebele relationships: prevented by role-scoped server queries + `zoneAccess`.
- Invalid geometry: PostGIS validity; never fabricated.
- Invalid payments: payment_status enum + amount validation (`fc37a5a`).
- Invalid attendance: date validation, uniqueness.
- Inconsistent assignments: kebele.collector_id / zone.leader_id drive server scope.
- Accidental deletion: soft-delete via `is_active` flags; admin-only destructive endpoints.

---

## 18. TESTING BASELINE

| Test Category | Command | Result | Date | Commit |
| ------------- | ------- | ------ | ---- | ------ |
| Frontend | `npx vitest run` (from `frontend-next/`) | 147/147 (15 files); workers pagination intermittent under parallel load (passes solo) | 2026-09-05 | fe316b5 |
| Backend | `npm test` (from `backend/`, NODE_ENV=test) | 161 passing, 2 pending, 0 failing (10 suites) | 2026-09-05 | fe316b5 |
| Lint (frontend) | `next lint` | script present; run before changes | — | — |
| Typecheck (frontend) | `tsc --noEmit` | run before changes | — | — |
| Build (frontend) | `next build` (no `--turbopack`) | verified (local) | prior phases | — |
| Security | `security.test.js`, `authorization.test.js` | passing | 2026-09-05 | fe316b5 |
| Database | `validate-migration.js`, `db-health-check.sh` | 9 kebeles / 108 zones verified | 2026-09-05 | fe316b5 |

Historical results are not overwritten; dates/commits preserved.

---

## 19. COMPLETED WORK LOG

| Date | Task | Result | Commit | Evidence |
| ---- | ---- | ------ | ------ | -------- |
| 2026-08-28 | Baseline + full security hardening (secrets, XSS, SQLi, CORS, sessions, uploads, webhooks, CSV, tests) | done | `4e21450`…`903ba7d` | §E phase-0 docs |
| 2026-08-28 | Kebele Admin worker management | done | `c6d61cd` | |
| 2026-08-28 | MariaDB → PostgreSQL + PostGIS | done | `1ddb542` | phase-1 docs |
| 2026-08-28 | UI/UX architecture & design system | done | `d51cd28` `ae65270` `86eb28a` | phase-2 docs |
| 2026-09-01 | Next.js foundation & app shell | done | `f9d6f20`…`b2e9874` | phase-3 docs |
| 2026-09-01 | Workers/Attendance/Salary migration | done | `266c5fb`…`adf8f92` | phase-4 docs |
| 2026-09-01 | Businesses & Finance (incl. gap patch) | done | `bdb8f07` `fc37a5a` | phase-5 docs |
| 2026-09-01 | Inspections & Zone Reports (kebele scoping, collector enforcement) | done | `0227926`…`d4f0ef0` | phase-6 docs |
| 2026-09-02 | Reports & Analytics | done | `983e669` | phase-8 docs |
| 2026-09-03 | Administration (Users/Tools/Documents/Audit/Notifications) | done | `ae026c9` | phase-9 docs |
| 2026-09-03 | Android foundation + field ops + GIS | done | `2551ed2` `0aebe6c` `3807d7a` | phases 10–12 |
| 2026-09-04 | Production hardening + deployment/observability/DR | done | `4de66d0` `39b37a1` | phases 13–14 |
| 2026-09-04 | Production docs (18/19/20/23) + test stabilization | done | `b136f91` `320787e` `cc2225d` `cb1d4b7` `7643889` | docs/operations |
| 2026-09-05 | Dev fixes: --turbopack, :3000 container, CORS, .data, rate limits, Button/multer | done | `38f803f` `f29d8b0` `ef474c2` `3adb6fa` `6157d92` `84bd76f` | |
| 2026-09-05 | Decommission legacy frontend (Next.js on 80/3000) | done | `43d101d` | §3.2 |
| 2026-09-05 | Dashboard: remove fake progress bars | done | `7304d7c` | §12 |
| 2026-09-05 | Dashboard: remove Performance "Soon" nav item | done | `4a5297e` | §21 |
| 2026-09-05 | Dashboard: 9-Kebele Overview real data | done | `ae5187a` | §12 |
| 2026-09-05 | Dashboard: Active Workers KPI | done | `879342f` | §12 |
| 2026-09-05 | Businesses Count Contract | done | `b28c2c4` | BUSINESSES_COUNT_CONTRACT.md |
| 2026-09-05 | Dashboard: Businesses KPI | done | `2a82988` | §12 |
| 2026-09-05 | Dashboard: Safer Zones KPI | done | `fe316b5` | §12 |
| 2026-09-05 | Master Project Registry | done | `5e72309` → v2.0 (this doc) | §0 |

---

## 20. INCREMENTAL IMPROVEMENT LOG

| # | Item | Before | After | Commit | Tests |
| - | ---- | ------ | ----- | ------ | ----- |
| 1 | Dashboard 9-Kebele progress bars | fabricated percentages | removed (honest) | `7304d7c` | pass |
| 2 | "Performance" nav item | disabled mock "Soon" | removed | `4a5297e` | pass |
| 3 | Dashboard 9-Kebele Overview | placeholder/static | real zone counts + payment achievement | `ae5187a` | pass |
| 4 | Active Workers KPI | static/hardcoded | `GET /workers?status=active` scoped | `879342f` | pass |
| 5 | Businesses count contract | undefined | documented authoritative contract | `b28c2c4` | docs |
| 6 | Businesses KPI | static/hardcoded | `GET /businesses?status=active` scoped | `2a82988` | pass |
| 7 | Safer Zones KPI | hardcoded 108 | `GET /api/safer-zones` scoped | `fe316b5` | pass |

---

## 21. PLACEHOLDER / INCOMPLETE INVENTORY

| Location | Placeholder | Classification | Priority | Replacement Plan | Status |
| -------- | ----------- | -------------- | -------- | ---------------- | ------ |
| `/dashboard` Operational overview | chart skeletons | PLACEHOLDER | P2-1 | real charts from backend dimensions only | BACKLOG |
| `/dashboard` Kebeles StatCard | hardcoded `9` | PLACEHOLDER | P1-1 | backend count | CURRENT PENDING |
| `nav.tsx` complaints | disabled "Soon" | COMING SOON | P1-2 | decide module vs deferred/rejected | UNKNOWN |
| `nav.tsx` system | disabled "Soon" | COMING SOON | P1-3 | decide module vs deferred/rejected | UNKNOWN |
| `settings/page.tsx` | 5-line placeholder | PLACEHOLDER | P2-5 | My Account (password change) | BACKLOG |
| `operations/page.tsx` | placeholder | PLACEHOLDER | P2-2 | real landing content/nav | BACKLOG |
| `locations/page.tsx` | placeholder | PLACEHOLDER | P2-3 | real landing content/nav | BACKLOG |
| `businesses/page.tsx` | placeholder | PLACEHOLDER | P2-4 | real landing content/nav | BACKLOG |
| `reports/performance/page.tsx` | real page, nav removed | OBSOLETE | P2-6 | re-link nav or remove route | BACKLOG |
| GIS map nav | disabled "Soon" | COMING SOON | P3-1 | enable when official data ready | BLOCKED |
| 9-Kebele worker counts | "Unavailable" | REAL UNAVAILABLE STATE | — | keep honest | LIMITATION |
| Inspection % | "Unavailable" | REAL UNAVAILABLE STATE | — | keep honest | LIMITATION |

---

## 22. TECHNICAL DEBT REGISTRY

- Flaky `workers.test.tsx` pagination timeout under parallel vitest (P1-4).
- Duplicate `phase-2-ui-architecture.md` / `phase-2-ui-ux-architecture.md` (identical content) — converge to one.
- `reports/performance` route orphaned after nav removal (P2-6).
- Placeholder index pages (Operations/Locations/Businesses/Settings) are not error pages — they are intentional backlog items.
- No live monitoring/observability tooling yet (production BLOCKED).
- Android app not covered by CI test matrix in this repo (deferred).

Do not auto-fix debt; work through the backlog.

---

## 23. PRODUCTION STATUS

```text
Application release:   1.0.0 (pre-production build)
Application commit:    fe316b5
Production host:       NOT ASSIGNED
Public IP:             NONE
DNS:                   BLOCKED (diredawa-cleaning.gov.et unassigned)
TLS:                   BLOCKED (ACME incomplete)
Database:              PostgreSQL+PostGIS ready (local compose verified)
Deployment:            Docker Compose (80/3000 frontend, 5000 backend) verified locally
Monitoring:            documented only; not live
Backups:               backup-db.sh tested
Rollback:              documented (docker volumes + release-process.md)
```

**State: READY (code) / BLOCKED (infrastructure).** Do not mark LIVE.

---

## 24. DEPLOYMENT & OPERATIONS

References:
- `docs/operations/PRODUCTION_INFRASTRUCTURE.md`
- `docs/operations/PRODUCTION_RUNBOOK.md`
- `docs/operations/PRODUCTION_HANDOVER.md`
- `docs/operations/FINAL_PRODUCTION_GO_LIVE.md`
- `docs/operations/MUNICIPAL_IT_PRODUCTION_HANDOFF.md`
- `docs/operations/PHASE_23_INFRASTRUCTURE_VERIFICATION.md`

- Deployment architecture: compose services db/backend/frontend-next; Nginx TLS termination documented for prod.
- Environment variables: `DB_*`, `SESSION_SECRET`, `SESSION_EXPIRY_HOURS`, `PAYMENT_WEBHOOK_SECRET`, `MAX_FILE_SIZE_MB`, `CORS_ORIGINS`, `RATE_LIMIT_*`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL` (`.env.example`). Secrets only in `.env`.
- Backup process: `scripts/backup-db.sh`.
- Health checks: backend `/api/health`; compose healthchecks for all services.
- Logging: `correlationId` middleware + `logs/` volume.
- Monitoring/rollback/recovery: see disaster-recovery.md and runbook.

Sensitive configuration is referenced, not duplicated.

---

## 25. EXTERNAL BLOCKERS

| Blocker | Owner | Impact | Required Action | Status |
| ------- | ----- | ------ | --------------- | ------ |
| Production VPS unavailable | Municipal IT | cannot deploy | allocate Ubuntu 22.04 VPS with static IP | BLOCKED |
| DNS unavailable | Municipal IT | no public domain | assign A record `diredawa-cleaning.gov.et` | BLOCKED |
| TLS unavailable | Municipal IT | no HTTPS | complete ACME/Certbot | BLOCKED |
| Official GIS dataset unavailable | Municipal IT | boundaries not loaded | supply official kebele/zone boundaries | BLOCKED |
| External payment service (live keys) | Payment providers | webhooks in sandbox | provide production credentials | BLOCKED |

---

## 26. DEFERRED FEATURES

- **Feature:** Android/Play Store publishing. Reason: not requested to publish; app is field-ready. Activation: explicit user authorization.
- **Feature:** Continuous worker/vehicle GPS tracking. Reason: privacy + requirement absent. Activation: explicit request.
- **Feature:** Route optimization. Reason: not required. Activation: explicit request.
- **Feature:** Live payment gateway. Reason: sandbox only; external keys. Activation: production credentials.

---

## 27. REJECTED FEATURES / DECISIONS

- **Rejected item:** TanStack Query. Reason: reverted `8587bc4`; custom `lib/api.ts` preferred. Do not reintroduce without re-approval.
- **Rejected item:** Fabricated GIS/coordinates. Reason: integrity. Do not fabricate.
- **Rejected item:** Weakening server authorization. Reason: security. Do not allow client-side-only scoping.
- **Rejected item:** Unnecessary database replacement. Reason: PostgreSQL+PostGIS is the foundation.
- **Rejected item:** Accidental legacy deletion (older writing). Reason: legacy deletion was deliberately executed (`43d101d`) as a decision; the concept "don't reintroduce legacy" now stands.

---

## 28. KNOWN LIMITATIONS

- Production host/infrastructure unavailable (external).
- Official GIS dataset unavailable (boundaries columns empty).
- Worker-per-kebele KPI and Inspection % unavailable — no authoritative baseline; UI shows "Unavailable".
- `workers.test.tsx` pagination intermittently times out under parallel vitest.
- Android build requires JAVA_HOME (not set in sandbox); verified in earlier phases.
- Live payment webhooks need production credentials.

---

## 29. OPEN QUESTIONS

- **QID-001:** Should the Complaints module be implemented, or formally deferred/rejected? Why unresolved: no requirement evidence in repo beyond nav label. Evidence: no route, no page. Owner: user. Resolution required: P1-2.
- **QID-002:** Should the Settings/"System" module become a real page (password + system settings) or be scoped down? Why unresolved: placeholder only. Evidence: `settings/page.tsx`, `users.js:95`. Owner: user. Resolution required: P1-3.
- **QID-003:** Should `reports/performance` be re-linked into nav or deleted? Why unresolved: nav removed but page retained. Evidence: `4a5297e`, page.tsx. Owner: agent (via backlog). Resolution required: P2-6.
- **QID-004:** Does "Worker" exist as a login role or only as a domain entity? Why unresolved: not in `user_role` enum. Evidence: schema line 21. Owner: user. Resolution required: confirm no worker login role.

---

## 30. PRIORITIZED BACKLOG

### P0 — Critical

- **ID:** P0-1
- **Title:** Confirm DB least-privilege role on production provisioning
- **Reason:** security/data-integrity
- **Module:** Database/Deployment
- **Dependencies:** production VPS
- **Acceptance Criteria:** provisioning maps app connection to least-privilege role (schema-created `ddcms`/`ddcms_migrator`), not superuser.
- **Status:** BLOCKED (external)

### P1 — Core Functionality

- **P1-1 — Dashboard Kebeles KPI → backend count** | Reason: only remaining hardcoded KPI | Module: Dashboard | Dependencies: none | Acceptance: `Kebeles` StatCard derived from backend-sourced count respecting authorization; tests pass | Status: NEXT PENDING
- **P1-2 — Complaints decision** | Reason: remove UNKNOWN status | Module: Complaints | Acceptance: implemented OR formally deferred/rejected with rationale | Status: UNKNOWN
- **P1-3 — Settings/"System" decision** | Reason: remove placeholder ambiguity | Module: Settings | Acceptance: real My Account page or scoped decision | Status: UNKNOWN
- **P1-4 — Stabilize workers pagination test** | Reason: test reliability | Module: Workers/Tests | Acceptance: 147/147 stable in CI-parallel vitest | Status: BACKLOG

### P2 — Important Improvements

- **P2-1** Real dashboard charts from backend dimensions (placeholder chart card) | Module: Dashboard | Status: BACKLOG
- **P2-2** Operations index page | Status: BACKLOG
- **P2-3** Locations index page | Status: BACKLOG
- **P2-4** Businesses index page | Status: BACKLOG
- **P2-5** My Account/Settings page | Status: BACKLOG
- **P2-6** Re-link or remove `reports/performance` route | Status: BACKLOG

### P3 — Polish

- **P3-1** Enable web GIS map when official data present | Status: BLOCKED
- **P3-2** Kebele comparisons/operational stats (no fabrication) | Status: BACKLOG
- **P3-3** Remaining loading/empty/error state gaps | Status: BACKLOG

### FUTURE — Deferred

- Android/Play Store publishing; continuous GPS tracking; route optimization; live payment gateway. (All §26.)

---

## 31. CURRENT NEXT TASK

```text
Current Next Item:  P1-1 — Dashboard Kebeles KPI: replace hardcoded "9" with a backend-sourced
                    kebele count, mirroring the Safer Zones / Active Workers / Businesses KPIs.

Why it is next:     It is the only remaining hardcoded KPI on the Dashboard and aligns with the
                    established pattern (real backend data, authorized scope, no fabrication).
                    Highest value among unblocked, dependency-free items.

Dependencies:       None. (Kebeles already served by GET /api/kebeles with role/kebele scoping.)

Acceptance Criteria:
  - Kebeles StatCard shows a count fetched from the backend (not literal 9).
  - Request respects role authorization (admin=city; collector/leader=assigned scope).
  - Loading / error / empty states match the other KPI cards ("Unavailable" on failure).
  - Frontend tests pass; no regression in 147-pass suite.
```

No second "next" item.

---

## 32. PERMANENT PROJECT CONSTRAINTS

1. PostgreSQL + PostGIS remain the database foundation.
2. Dire Dawa has 9 Kebeles and 108 Safer Zones (12 per kebele).
3. Authorization is server-authoritative.
4. Kebele Admin is the UI term; preserve underlying role architecture (DB `collector`) unless explicitly changed.
5. Never fabricate municipal/GIS data.
6. Never use frontend filtering as the security boundary.
7. Do not introduce TanStack Query unless explicitly re-approved.
8. Do not introduce continuous GPS tracking unless explicitly activated.
9. Do not implement route optimization unless explicitly activated.
10. Do not re-add/restore the decommissioned legacy frontend (removed `43d101d`).
11. Mobile-first and accessibility remain mandatory.
12. Do not weaken security for convenience.
13. Do not change database architecture unnecessarily.
14. Do not publish Android/Play Store unless explicitly activated.
15. One task = one complete improvement.
16. Test → verify → commit → update registry → STOP.
17. No fabricated progress bars / fake KPIs; honest "Unavailable" when no authoritative data.
18. Production infra not marked live until externally verified.

---

## 33. EVIDENCE INDEX

| Evidence | Location |
| -------- | -------- |
| Database architecture | `database/postgresql/schema.sql`, `database/MIGRATIONS.md` |
| Security architecture | `backend/middleware/auth.js`, `backend/middleware/uploadSecurity.js`, `docs/security/` |
| Frontend architecture | `frontend-next/src/lib/api.ts`, `frontend-next/src/styles/tokens.css`, `src/components/ui/`, `src/types/domain.ts` |
| Businesses contract | `docs/modernization/BUSINESSES_COUNT_CONTRACT.md` |
| Production infrastructure | `docs/operations/PRODUCTION_INFRASTRUCTURE.md` |
| Production runbook | `docs/operations/PRODUCTION_RUNBOOK.md` |
| Phase reports | `docs/modernization/phase-*.md`, `docs/modernization/PHASE_18/19.md` |
| Handover/go-live | `docs/operations/FINAL_PRODUCTION_GO_LIVE.md`, `MUNICIPAL_IT_PRODUCTION_HANDOFF.md`, `PHASE_23_INFRASTRUCTURE_VERIFICATION.md` |
| Key commits | `git log --oneline` (HEAD `fe316b5`) |
| This registry | `docs/modernization/MASTER_PROJECT_REGISTRY.md` |

---

## 34. REGISTRY CHANGE LOG

| Date | Change | Reason | Commit |
| ---- | ------ | ------ | ------ |
| 2026-09-05 | v1.0 registry created (audit + roadmap) | Phase 24 master recovery | `5e72309` |
| 2026-09-05 | v2.0 restructured to exact 39-section schema (§0–§39) | operator directive to standardize registry structure | (this update) |

---

## 35. REQUIRED END-OF-TASK UPDATE

Every future implementation task must update these registry sections where applicable:
```text
Current status (S0) · Completed work (S19) · Incremental improvement log (S20) ·
Module status (S6) · Backlog (S30) · Current Next Item (S31) · Testing baseline (S18) ·
Known limitations (S28) · Placeholder inventory (S21) · Open questions (S29)
```
Do not update unrelated sections unnecessarily.

---

## 36. REQUIRED FUTURE AGENT WORKFLOW

```text
1. Read MASTER_PROJECT_REGISTRY.md
2. Inspect current repository
3. Verify the registry is still accurate
4. Inspect the CURRENT NEXT ITEM (S31)
5. Re-evaluate against actual repository evidence
6. Select exactly ONE implementation item
7. Define acceptance criteria
8. Implement only that item
9. Test
10. Manually verify
11. Update registry (S35)
12. Commit
13. Report
14. STOP
```

If the selected item turns out to be already complete:

```text
Verify → update registry → choose the next correct item → STOP
```

Do not create meaningless work.

---

## 37. NO PHASE-DRIFT RULE

The agent must not invent large phases simply to keep the project moving. A phase may contain multiple sequential tasks, but each implementation task must remain independently scoped. The registry controls the roadmap. The user should not need to remember: completed work, postponed items, rejected technologies, approved metric contracts, migrated frontends, established security rules, or blocked items — the registry preserves all of it.

---

## 38. FINAL REGISTRY QUALITY CHECK

- [x] No unsupported claims
- [x] No fake status
- [x] No fabricated test results
- [x] No fabricated production infrastructure
- [x] No duplicated requirements with contradictions
- [x] No missing permanent constraints
- [x] No lost deferred decisions
- [x] No lost rejected decisions
- [x] No lost unresolved questions
- [x] All major modules represented
- [x] Frontend migration represented
- [x] Database represented
- [x] Security represented
- [x] GIS represented
- [x] Production represented
- [x] Backlog prioritized
- [x] Exactly one Current Next Item

---

## 39. FINAL REGISTRY FOOTER

## Registry Authority

This registry is the canonical project-memory and roadmap document for the Dire Dawa Cleaning Management System.

Future agents must read it before implementation and update it after every completed incremental task.

One task = one complete improvement.

Inspect → Implement → Test → Verify → Commit → Update Registry → STOP.