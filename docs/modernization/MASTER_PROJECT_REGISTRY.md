# MASTER PROJECT REGISTRY

**Dire Dawa Cleaning Management System — single source of truth for project state.**

## Document Roles

```text
This document is the project's factual source of truth.

Agent workflow instructions are maintained separately in:
docs/modernization/AGENT_WORK_INSTRUCTIONS.md

The Registry records WHAT the project is and WHERE it stands.
The Agent Work Instructions define HOW an AI agent should work on it.
```

---

## 0. Document Control

```text
Registry Version:       3.0
Last Updated:           2026-09-06
Last Audited:           2026-09-06
Current Project Status: STEADY — no mid-flight feature work; production infrastructure externally BLOCKED
Current Phase:          Post-modernization incremental improvements (registry keeps the roadmap)
Current Release:        1.0.0 (pre-production; local Docker Compose verified)
Current Repository HEAD: 98e9139 (main, 84 commits, clean tree) — this commit updates it; pin the hash in the next audit pass (§34 tag "this commit")
Registry Owner:         opencode agent (maintains roadmap; user authorizes scope)
```

### Source-of-Truth Priority

```text
1. Actual repository implementation
2. Database/schema
3. Git history
4. Project documentation
5. Approved requirements and decisions
6. Conversation history only when repository evidence is unavailable
```

---

## 1. Project Identity

- **Official project name:** Dire Dawa Cleaning Management System
- **Organization:** Dire Dawa City Administration
- **Department:** Sanitation/Cleaning Department
- **Mission:** Digitize and manage the city's cleaning operations end-to-end — workers, attendance, wages, businesses, fees, payments, inspections, zone reporting, and GIS — with every data point authoritative, role-isolated, and operationally honest (no fabricated metrics).
- **Primary objectives:** Replace the legacy static-HTML/MariaDB tool with a maintainable, mobile-first, secure system on PostgreSQL + PostGIS and a modern Next.js frontend, deployable for municipal IT on a VPS with real HTTPS, backups, monitoring, and handover documentation.
- **System purpose:** Manage municipal cleaning operations across the full lifecycle — workforce, finance, inspections, location intelligence, community, reporting, and administration.

---

## 2. Municipal Model

```text
Dire Dawa
├── 9 Kebeles
│   ├── K01 Kebele 01 … K09 Kebele 09
└── 108 Safer Zones
    └── 12 per Kebele (Zone A … Zone L per kebele area)
```

Verified in `database/postgresql/schema.sql`:

- **Required structure:** 9 kebeles (`UNIQUE(code)`, K01–K09) and 108 safer zones (`UNIQUE(name, kebele_id)`, 12 per kebele) — design invariant.
- **Actual records:** kebele rows seeded (lines 418–422); safer-zones seeded, verified kebele_id `1..9` each has exactly 12 records. Runtime records depend on usage.
- **Geographic relationships:** `safer_zones.kebele_id → kebeles`; `safer_zones.leader_id → users`; `workers.safer_zone_id`; `businesses.safer_zone_id`.
- **Official GIS requirement:** kebele/zone boundaries and coordinates must come from the official municipal dataset (columns exist; dataset not yet loaded).

---

## 3. System Architecture

### 3.1 New Frontend (canonical)
- **Stack:** Next.js 15.3.5 + React 19 + TypeScript, App Router, Tailwind-style utilities.
- **Design system/tokens:** `frontend-next/src/styles/tokens.css` — single token source of truth.
- **Component library:** `src/components/ui/` (button, card, badge, data-table, modal, drawer, form, select, input, tabs, toast, tooltip, skeleton, pagination, breadcrumb, dropdown, icon, alert, checkbox, network-status).
- **API client:** `src/lib/api.ts` — all requests flow through it; no direct `fetch` in components.
- **Domain types:** `src/types/domain.ts`. Feature modules under `src/app/(app)/…`.
- **Status:** sole canonical frontend (since `43d101d`).

### 3.2 Legacy Frontend
- `frontend/` — **REMOVED** (decommissioned by commit `43d101d`). No directory at repo root. Deliberate, recorded decision (CHANGED from the earlier "preserve legacy" constraint). Not to be reintroduced.

### 3.3 Backend
- **Runtime:** Node.js/Express (`backend/server.js`, port 5000). Route modules in `backend/routes/`.
- **API architecture:** REST under `/api`, validation via `middleware/schemas.js` + `validate.js`, error handler + correlationId middleware.
- **Authentication:** DB-backed `sessions` table; `x-session-token` header or `Authorization: Bearer`; expiry `expires_at > NOW()`.
- **Authorization:** `middleware/auth.js` — `authenticate`, `requireRole(...)`, `zoneAccess`; kebele/zone isolation enforced server-side in SQL.
- **Services/routes:** Express routers per module (auth, workers, businesses, payments, inspections, zoneReports, locations, gis, reports, analytics, users, tools, documents, auditLog, notifications, public, sandbox).
- **Data access:** `pg` parameterized queries (no ORM). Config `backend/config/db.js` (default `DB_USER=ddcms`).
- **Uploads:** `middleware/uploadSecurity.js`. Rate limits env-configurable (`RATE_LIMIT_*`). CORS env allowlist.

### 3.4 Database
- **PostgreSQL 16 + PostGIS 3.4** (`postgis/postgis:16-3.4`), schema `database/postgresql/schema.sql`.
- **Prisma:** not used.
- **Migrations:** SQL schema + `database/migrations/001_add_lifecycle_fields.js` + `MIGRATIONS.md` + `validate-migration.js`.
- **Database roles (least privilege):** `ddcms` (app), `ddcms_migrator` (migrations) — created in schema (lines 491–520).
- **Geometry architecture:** MULTIPOLYGON boundaries (kebeles/zones), POINT locations (businesses/inspections/workers), SRID 4326, GIST spatial indexes.

### 3.5 Infrastructure
- **Docker:** `docker-compose.yml` — `db` (PostGIS), `backend`, `frontend-next` (ports 80/3000 frontend, 5000 backend, 5432 db) with healthchecks + resource limits.
- **systemd / Nginx:** documented only; not deployed. Nginx config specified in `PRODUCTION_INFRASTRUCTURE.md`.
- **DNS / TLS:** BLOCKED (external municipal IT).
- **Backups:** `scripts/backup-db.sh` (SHA256-tested), `db-health-check.sh`, `check-config.sh`.
- **Monitoring:** documented only; not live.

---

## 4. Repository Structure

```text
frontend-next/   Canonical Next.js frontend (app, components, lib, styles, types, test)
frontend/        REMOVED (decommissioned 43d101d)
backend/         Express API (routes, middleware, config, services, test, uploads)
prisma/          NOT USED (no Prisma anywhere)
database/        PostgreSQL schema, migrations, PostGIS, seed
android/         Kotlin field-operations app (Phases 10–12)
tests/           Frontend tests exist under frontend-next/src/test; backend tests under backend/test
scripts/         backup-db.sh, db-health-check.sh, check-config.sh
docs/            modernization/ + operations/ + security/ + migration/
public/          Not applicable at repo root (static assets live under frontend-next)
docker-compose.yml, .env.example, .env, README.md, .github/
```

Only architecturally important locations are listed.

---

## 5. Role & Authorization Model

| Role | UI Name | Database Role/ID | Geographic Scope | Permissions | Status |
| ---- | ------- | ---------------- | ---------------- | ----------- | ------ |
| Admin | Admin | `admin` | City-wide (all 9 kebeles) | Full CRUD across all modules | COMPLETE |
| Collector | Kebele Admin | `collector` | Assigned kebele (`kebeles.collector_id`) | Worker/inspection/business CRUD in own kebele | COMPLETE |
| Zone Leader | Zone Leader | `leader` | Own safer zone (`safer_zones.leader_id`) | Zone data visibility; `zoneAccess` enforced | COMPLETE |
| Worker | Worker | (not in `user_role` enum) | Own record / attendance | Field role only; not a login role | UNKNOWN |
| Viewer | Viewer | `viewer` | Depends on assignment | Read-only | COMPLETE |

- **Authentication:** DB sessions, token in `x-session-token`/Bearer, expiry enforced, inactive users rejected.
- **Geographic scope:** collector scoped by SQL `kebele_id`; leader by `safer_zones.leader_id`; admin unconstrained.
- **Resource permissions:** per-route guards (`requireRole("admin")` on users/tools/documents/safer-zones mutations/businesses-delete/inspections-delete; `requireRole("admin","collector")` on operational CRUD).
- **Backend enforcement:** isolation in SQL + middleware, tested by `authorization.test.js`.
- **Current role terminology:** UI shows "Kebele Admin" for DB role `collector`; "Worker" is a domain entity, not a login role.

> **Permanent project rule: Backend authorization is authoritative. Client-side filtering is never the security boundary.**

---

## 6. Functional Module Registry

Statuses: COMPLETE / PARTIAL / IN PROGRESS / BACKLOG / DEFERRED / BLOCKED / UNKNOWN.

### 6.1 Dashboard
- Route: `/dashboard`. Status: COMPLETE.
- Backend: `/workers?status=active`, `/businesses?status=active`, `/safer-zones`, `/payments/summary/dashboard`, `/dashboard/overview`.
- Real Data: yes (Kebeles/Safer Zones/Active Workers/Businesses KPIs; revenue/attendance/inspections overview; real 9-kebele operational comparison).
- Authorization: yes (role/kebele/zone scoped; `/api/dashboard/overview` scopes server-side — admin/viewer city-wide, collector own kebele, leader own zone). Mobile: yes. Accessibility: yes. Tests: yes.
- Placeholders: none (operational overview + comparison are real data).
- Known limitations: expected-vs-actual inspection % still "Unavailable" (no authoritative baseline); attendance rate is null (rendered "No data") when no records exist — never fabricated as 0%.

### 6.2 Workers
- Route: `/operations/workers`. Status: COMPLETE.
- Backend: `/workers` CRUD, `/workers/summary/stats`, `/workers/:id/attendance`, `/workers/:id/salary`.
- Real Data: yes. Authorization: yes (role/kebele). Mobile: yes. Accessibility: yes. Tests: yes.
- Known limitation: `workers.test.tsx` pagination test intermittently times out under parallel vitest (passes solo).

### 6.3 Attendance
- Route: `/operations/attendance`. Status: COMPLETE.
- Backend: `/workers/attendance/bulk`, `/workers/:id/attendance`. Bulk attendance; `UNIQUE(worker_id,date)`; date/context/search/summary/table; mobile-tested.

### 6.4 Salary
- Route: `/operations/salary`. Status: COMPLETE.
- Backend: `/workers/:id/salary`, `/workers/summary/stats`. Salary page + per-worker history; `salary_payments` table.

### 6.5 Businesses
- Route: `/businesses`. Status: COMPLETE (index page placeholder).
- Backend: `/businesses` CRUD. Count contract defined (`BUSINESSES_COUNT_CONTRACT.md`); KPI `/businesses?status=active`.

### 6.6 Payments
- Route: `/businesses/payments`. Status: COMPLETE.
- Backend: `/payments`, `/payments/summary/dashboard`, `/payments/:id/verify`, webhooks (telebirr/cbebirr), sandbox. Receipts at DB level.

### 6.7 Inspections
- Route: `/operations/inspections`. Status: COMPLETE.
- Backend: `/inspections`. Photos, GPS→PostGIS, status enum, 9-kebele scoping + collector enforcement; multer body-parsing order fixed.

### 6.8 Zone Reports
- Route: `/operations/zone-reports`. Status: COMPLETE.
- Backend: `/zone-reports`. Stepper UI, status state machine, `UNIQUE(safer_zone_id, report_year, report_month)`.

### 6.9 Kebeles
- Route: `/locations/kebeles`. Status: COMPLETE (module).
- Backend: `/kebeles`, `/kebeles/:id` (PUT admin). Locations index page is a placeholder.

### 6.10 Safer Zones
- Route: `/locations/safer-zones`. Status: COMPLETE.
- Backend: `/safer-zones` CRUD (admin). `UNIQUE(name,kebele_id)`; 108 seeded zones.

### 6.11 GIS
- Status: PARTIAL.
- Backend: GeoJSON APIs (`/gis/kebeles|safer-zones|businesses|workers|inspections`).
- MapLibre map component exists; Android GIS exists. Web nav renders map disabled "Soon"; official boundaries unavailable. Backlog P3-1.

### 6.12 Notifications
- Route: `/community/notifications`. Status: COMPLETE.
- Backend: `/notifications`, unread-count, mark-read, read-all, admin generate.

### 6.13 Complaints
- Route: `/community/complaints`. Status: COMPLETE.
- Backend: `/api/complaints` GET/POST/PUT/:id/status/DELETE/:id + summary. Staff file complaints on behalf of community (app is auth-only; reporter captured as free-text name/phone). Role-scoped: admin/viewer=city, collector=own kebele, leader=own zone. Status machine: new → in_progress → resolved. Complaint category enum: illegal_dumping, litter, blocked_drain, hazard, other.

### 6.14 Reports
- Route: `/reports`. Status: COMPLETE.
- Backend: `/reports/payments/monthly|yearly`, `/reports/workers/monthly`, `/reports/inspections`, `/reports/monthly-summary`.

### 6.15 Analytics
- Route: `/reports/analytics`. Status: COMPLETE.
- Backend: `/analytics/attendance|payments|inspections|zones|trends`.

### 6.16 Users
- Route: `/administration/users`. Status: COMPLETE.
- Backend: `/users` CRUD (admin), `/users/leaders`.

### 6.17 Tools
- Route: `/administration/tools`. Status: COMPLETE.
- Backend: `/tools` CRUD.

### 6.18 Documents
- Route: `/administration/documents`. Status: COMPLETE.
- Backend: `/documents`, upload/download with `uploadSecurity.js` validation.

### 6.19 Audit Logs
- Route: `/administration/audit-logs`. Status: COMPLETE.
- Backend: `/auditLog` (admin-only read).

### 6.20 My Account
- Route: `/settings`. Status: COMPLETE (P1-3A profile + P1-3B security implemented; notification preferences documented unsupported — backend has no preference endpoint).
- Backend: `/users/:id/password` (self/admin password change), `/auth/logout`, `/auth/me`; no preference persistence endpoint exists.
- Nav `system` disabled "Soon" preserved; settings work is user-facing profile/security, not global system admin.

---

## 7. Requirements Registry

| ID | Requirement | Module | Priority | Status | Evidence | Notes |
| -- | ----------- | ------ | -------- | ------ | -------- | ----- |
| REQ-MUN-001 | 9 Kebeles, 108 Safer Zones, 12/kebele | Municipal | P0 | COMPLETE | schema.sql seed + UNIQUE constraints | Verified per kebele_id |
| REQ-OPS-001 | Worker management (CRUD, active/inactive) | Workers | P1 | COMPLETE | `workers.js`, Workers page | |
| REQ-OPS-002 | Attendance (single + bulk, uniqueness) | Attendance | P1 | COMPLETE | `workers.js:315,381`, attendance tests | |
| REQ-OPS-003 | Salary/payroll tracking | Salary | P1 | COMPLETE | `salary_payments`, Salary page | |
| REQ-BIZ-001 | Business registration with safer-zone link | Businesses | P1 | COMPLETE | `locations.js`, Businesses page | |
| REQ-PAY-001 | Payments by business/month, webhooks | Payments | P1 | COMPLETE | `payments.js`, sandbox | |
| REQ-INSP-001 | Cleanliness inspections + photos + GPS | Inspections | P1 | COMPLETE | `inspections.js`, Inspections page | |
| REQ-ZREP-001 | Zone reports with status workflow | Zone Reports | P1 | COMPLETE | `zoneReports.js`, stepper UI | |
| REQ-GIS-001 | PostGIS boundaries + point locations | GIS | P1 | PARTIAL | schema geometry, gis.js | Official boundaries blocked |
| REQ-GIS-002 | Web map visualization | GIS | P2 | PARTIAL | MapLibre component | Nav disabled "Soon" |
| REQ-COM-001 | Complaints from community | Complaints | P1 | COMPLETE | `complaints.js`, Complaints page | Implemented P1-2 (2026-09-06) |
| REQ-REP-001 | Reports + CSV where implemented | Reports | P1 | COMPLETE | reports.js | |
| REQ-ANA-001 | Analytics & kebele comparisons | Analytics | P1 | COMPLETE | analytics.js | |
| REQ-ADM-001 | Users/roles administration | Users | P1 | COMPLETE | users.js | |
| REQ-ADM-002 | Tools/equipment registry | Tools | P1 | COMPLETE | tools.js | |
| REQ-ADM-003 | Documents storage | Documents | P1 | COMPLETE | documents.js | |
| REQ-ADM-004 | Audit logs | Audit Logs | P1 | COMPLETE | auditLog.js | |
| REQ-ADM-005 | Settings / My Account | Settings | P1 | PARTIAL | users.js:95; placeholder page | |
| REQ-SEC-001 | Server-authoritative kebele/zone isolation | Security | P0 | COMPLETE | auth.js, SQL filters, authorization tests | |
| REQ-SEC-002 | Sessions, secrets, CORS, rate limits | Security | P0 | COMPLETE | Phase 0 commits, env config | |
| REQ-DASH-001 | Dashboard KPIs with real backend data | Dashboard | P1 | COMPLETE | dashboard commits §19/§20 | Kebeles KPI now backend-sourced (§12) |
| REQ-DASH-002 | Dashboard operational overview (revenue/attendance/inspections + 9-kebele comparison), role-scoped | Dashboard | P1 | COMPLETE | `dashboard.js`, dashboard tests | honest null/zero states |
| REQ-MOB-001 | Android field operations | Android | P1 | COMPLETE | android/ (Phases 10–12) | Play Store deferred |
| REQ-PROD-001 | Production deployment | Production | P1 | BLOCKED | infra docs | External municipal IT |

---

## 8. Frontend Migration Registry

| Dimension | Legacy `frontend/` | New `frontend-next/` | Status |
| --------- | ------------------ | -------------------- | ------ |
| Functionality | Removed | All modules implemented | MIGRATED (obsolesced) |
| Routes | N/A | App Router | MIGRATED |
| Authentication | N/A | Token sessions | MIGRATED |
| API integration | N/A | `lib/api.ts` → backend | MIGRATED |
| Permissions | N/A | Role-aware nav + backend | MIGRATED |
| Mobile | N/A | Responsive + bottom nav | MIGRATED |
| Accessibility | N/A | audit maintained | MIGRATED |
| Public landing experience | plan | `(public)/login` | MIGRATED |

- **Feature parity:** full migration completed before decommission.
- **Canonical frontend status:** `frontend-next/` is the sole frontend (since `43d101d`).
- **Remaining migration work:** none from legacy (deleted). Outstanding work is placeholder completion (see §21), not legacy parity.
- **Compatibility requirements:** none (legacy gone).

---

## 9. API Registry

| Endpoint | Method | Module | Authentication | Scope | Validation | Pagination | Status |
| -------- | ------ | ------ | -------------- | ----- | ---------- | ---------- | ------ |
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
| `/api/dashboard/overview` | GET | Dashboard | auth | role (leader=own zone, collector=own kebele, admin/viewer=city) | yes | — | COMPLETE |
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
| `/api/complaints` | GET | Complaints | auth | role (leader=own zone, collector=own kebele, admin/viewer=city) | yes | yes | COMPLETE |
| `/api/complaints/summary` | GET | Complaints | auth | role | — | — | COMPLETE |
| `/api/complaints` | POST | Complaints | admin/collector/leader | own kebele/zone | yes | — | COMPLETE |
| `/api/complaints/:id/status` | PUT | Complaints | admin/collector/leader | own kebele/zone | yes | — | COMPLETE |
| `/api/complaints/:id` | DELETE | Complaints | admin | city | yes | — | COMPLETE |
| `/api/sandbox/sandbox-checkout` | GET | Payments sandbox | auth | — | — | — | COMPLETE |

Only meaningful endpoints listed.

---

## 10. Database Registry

### Tables

| Table | Purpose | Key Relationships | Status |
| ----- | ------- | ----------------- | ------ |
| users | System users (login/roles) | sessions, kebeles.collector_id, safer_zones.leader_id | COMPLETE |
| sessions | Auth tokens | users ON DELETE CASCADE | COMPLETE |
| login_attempts | Brute-force lockout | (username, ip) | COMPLETE |
| kebeles | 9 kebeles | safer_zones.kebele_id | COMPLETE |
| safer_zones | 108 zones | kebeles, users(leader), workers, businesses | COMPLETE |
| businesses | Registered businesses | safer_zones, payments | COMPLETE |
| payments | Fee payments/status | businesses, receipt/gateway refs | COMPLETE |
| inspections | Cleanliness inspections | inspection_photos | COMPLETE |
| inspection_photos | Inspection photo evidence | inspections | COMPLETE |
| workers | Cleaning workers | safer_zones | COMPLETE |
| attendance | Daily attendance | workers `UNIQUE(worker_id,date)` | COMPLETE |
| salary_payments | Wage payments | workers | COMPLETE |
| tools | Equipment registry | — | COMPLETE |
| zone_reports | Monthly zone reports | safer_zones `UNIQUE(safer_zone_id,report_year,report_month)` | COMPLETE |
| audit_log | Audit trail | users (context) | COMPLETE |
| notifications | User notifications | users | COMPLETE |
| documents | Uploaded documents | users/optional kebele | COMPLETE |
| complaints | Community-reported cleanliness issues | safer_zones (NOT NULL), users (created_by/assigned_to/resolved_by) | COMPLETE |

### Enums

`user_role`(admin,collector,leader,viewer) · `business_type`(shop,cafe,hotel,restaurant,pharmacy,market,workshop,office,school,clinic,other) · `payment_method`(cash,mobile,bank,other,telebirr,cbebirr) · `payment_status`(paid,pending,overdue,failed) · `inspection_status`(active,warning,danger) · `tool_category`(vehicle,equipment,uniform,chemical,other) · `tool_condition`(good,fair,poor,broken) · `report_status`(draft,submitted,reviewed,approved) · `document_category`(contract,photo,training,incident,report,other) · `complaint_category`(illegal_dumping,litter,blocked_drain,hazard,other) · `complaint_status`(new,in_progress,resolved)

### Geometry

- Types: `GEOMETRY(MULTIPOLYGON, 4326)` (kebeles.boundary, safer_zones.boundary); `GEOMETRY(POINT, 4326)` (businesses.location, inspections.location, workers.location).
- SRID: 4326. GIST spatial indexes present.
- Relationships: zone→kebele; boundaries owned by official municipal dataset.
- Validation: geometries must be PostGIS-valid; never fabricated.

### Constraints

- Foreign keys with cascades / SET NULL as declared.
- UNIQUE: `kebeles.name`, `kebeles.code`, `safer_zones(name,kebele_id)`, `attendance(worker_id,date)`, `payments(business_id,month,year)`, `users.username`, `workers.fayda_id`, `receipt_number`, `gateway_ref`, zone-report `(safer_zone_id,report_year,report_month)`.
- Check: enum-backed column checks via SQL ENUM types.
- Triggers: `update_updated_at()` on all operational tables.

### Indexes

`idx_sz_kebele`, `idx_workers_active_zone`, `idx_users_role_active`, `idx_inspections_kebele`, `idx_businesses_active`, `idx_doc_kebele`, login_attempts indexes, GIST spatial indexes.

### Migrations & Database Roles

- Migration: `database/migrations/001_add_lifecycle_fields.js`; strategy SQL + `MIGRATIONS.md` + `validate-migration.js`; seed `database/postgresql/schema.sql`.
- Roles (least privilege): `ddcms` (app), `ddcms_migrator` (migrations) — created in schema lines 491–520; app connects as `DB_USER` (default `ddcms`).

### PostGIS Configuration

- Extension enabled; SRID 4326; MULTIPOLYGON boundaries + POINT locations; validation rule = never fabricate.

---

## 11. Data Definitions & Business Rules

- **Active Worker** — Definition: worker with `is_active=TRUE`. Source: `GET /workers?status=active` (backend filters `w.is_active=TRUE`). Formula: count of active workers. Included: active in scope (admin=city, collector=own kebele, leader=own zone). Excluded: inactive. Scope: role/kebele. Status: COMPLETE.
- **Active Business** — Definition: business with `is_active=TRUE`. Source: `GET /businesses?status=active` (backend `b.is_active=TRUE`). Contract: `BUSINESSES_COUNT_CONTRACT.md`. Formula: count of active businesses in scope. Included/Excluded: per contract. Scope: role/kebele. Status: COMPLETE.
- **Payment Achievement** — Definition: collected/pending/overdue totals + by-kebele collected vs target. Source: `/payments/summary/dashboard`. Formula: `SUM(amount)` by status; `SUM(b.monthly_target)` target. Scope: role/leader. Status: COMPLETE.
- **Inspection %** — Definition: NOT defined (no authoritative expected-inspection baseline). Dashboard shows "Unavailable" honestly. Status: LIMITATION.
- **Attendance** — Definition: attendance record per worker per date; `UNIQUE(worker_id,date)`; bulk allowed. Scope: role/kebele. Status: COMPLETE.
- **Kebele** — Definition: one of 9 municipal kebeles, K01–K09; scope unit for collectors. Status: COMPLETE.
- **Safer Zone** — Definition: one of 108 zones; 12 per kebele; scope unit for leaders. Status: COMPLETE.
- **Zone Report** — Definition: monthly report per safer zone; unique per `(safer_zone_id, year, month)`; workflow draft→submitted→reviewed→approved. Status: COMPLETE.
- **Safer Zone Count (KPI)** — Definition: count of safer zones in scope, excluding `is_active=false`. Source: `GET /api/safer-zones`. Status: COMPLETE.
- **Operational Overview** — Definition: single role-scoped aggregate for the dashboard (revenue collected/pending/overdue/target + achievementPct, monthly collected trend, attendance summary + rate, inspection status counts, per-kebele comparison rows: zones/workerCount/businessCount/target/collected/achievementPct/attendanceRate/inspection buckets). Source: `GET /api/dashboard/overview` (`backend/routes/dashboard.js`). Formula: zone-scoped SQL; `achievementPct` computed only when target>0; attendance rate null when zero records (rendered "No data"). Scope: admin/viewer=city, collector=own kebele (`kebeles.collector_id`; unassigned → empty result, not city data), leader=own zone. Status: COMPLETE.
- **Complaint** — Definition: community-reported cleanliness issue (category, title, description, zone, optional reporter name/phone) filed by authenticated staff on behalf of a community member (no anonymous public portal exists; honest limitation), resolved by staff. Source: `GET/POST /api/complaints`, `PUT /api/complaints/:id/status` (`backend/routes/complaints.js`). Lifecycle: new → in_progress → resolved (monotonic; no regressions allowed). Scope: admin/viewer=city, collector=own kebele, leader=own zone (`safer_zones.leader_id` constrained in all operations). Delete: admin-only, audited. Notifications: `complaint_update` sent to assignee (or creator) on status change. Status: COMPLETE.

---

## 12. Dashboard Metric Contracts

| KPI | Definition | Source | Scope | Calculation | Status |
| --- | ---------- | ------ | ----- | ----------- | ------ |
| Kebeles | count of authorized Kebele records (Dire Dawa city roster K01–K09) | `useKebele().kebeles` → `GET /api/kebeles` | all roles (endpoint is not role-scoped; returns full roster for every authenticated role); operational detail: `kebeles.collector_id` / `zone.leader_id` still scope ops | `kebeles.length`, loaded once by KebeleProvider | COMPLETE |
| Safer Zones | count of zones, active-only | `GET /api/safer-zones` | role/kebele | length of returned rows `is_active!==false` | COMPLETE |
| Active Workers | count of `is_active` workers | `GET /workers?status=active` | role/kebele | count of returned workers | COMPLETE |
| Businesses | count of `is_active` businesses | `GET /businesses?status=active` | role/kebele | count (see contract) | COMPLETE |
| Payment achievement | collected vs target by kebele | `/payments/summary/dashboard` | role/leader | SUM(paid amount); target SUM | COMPLETE |
| Workers per kebele | per-kebele count of active workers (`workerCount`) | `/api/dashboard/overview` → `kebeles[].workerCount` | kebele | COUNT over zone-scoped workers grouped by kebele; workers with NULL zone are uncountable per-kebele (KPI still counts them city-wide) | COMPLETE |
| Attendance rate (overview) | present / total worker-days in period | `/api/dashboard/overview` → `attendance.attendanceRate` + `kebeles[].attendanceRate` | role | null (rendered "No data") when zero records; never fabricated as 0%; `::numeric` division per kebele | COMPLETE |
| Inspection % | expected-vs-actual inspections | none authoritative | — | "Unavailable" | LIMITATION |

Dedicated contract: `docs/modernization/BUSINESSES_COUNT_CONTRACT.md`.

Operational overview aggregations (`revenue`, `monthly`, `attendance`, `inspections`, `kebeles[]`) are defined in `backend/routes/dashboard.js` and verified by `backend/test/dashboard.test.js` (admin shape, collector/leader scoping, achievement-null honesty, unassigned-collector empty result).

---

## 13. UI/UX Design System

Approved project decisions (implementation in `frontend-next/src/styles/tokens.css` and `src/components/ui/`):

- **Mobile-first** responsive design; sidebar (desktop) + bottom nav (mobile).
- **Design tokens** are the single source of truth — no arbitrary per-component colors.
- **Typography:** Inter + Segoe UI fallback; `--text-base 15px`, `--leading 1.5`, heading scale `--h-hero/--h-section/--h-card`.
- **Spacing:** 4–64 px scale (`--s-1..--s-16`).
- **Colors/tokens:** semantic (primary/secondary/success/warning/danger/information/neutral + status mapping draft/submitted/reviewed/approved); dark-mode tokens prepared but opt-in.
- **Breakpoints:** `--bp-sm 480 / md 768 / lg 1024 / xl 1280`.
- **Icons:** centralized Lucide component (`components/ui/icon.tsx`); emojis not used in modules.
- **Components:** shadcn-style primitives (see §3.1).
- **Forms:** react-hook-form + inputs (form/input/select/textarea).
- **Tables:** data-table + pagination; server pagination.
- **Dialogs:** modal/drawer with focus management.
- **Cards:** card + StatCard variants.
- **States:** skeleton loading, alert error, toast success, empty-state text, offline `network-status` banner.

---

## 14. Accessibility Requirements

- **WCAG target:** AA (per Phase 2/3 audits).
- **Keyboard behavior:** tested for login (Tab order), dialogs, buttons (`Button` defaults `type="button"`), drawer focus.
- **Focus behavior:** modal/drawer focus management.
- **Labels:** accessible labels on forms/labels (login test verifies).
- **Semantic structure:** headings, buttons, aria attributes on nav/disabled items (`aria-disabled`).
- **Contrast:** token-driven semantic colors meet contrast for text combinations.
- **Touch targets:** mobile nav/buttons at accessible sizes where applicable.
- **Dialogs:** focus containment + return handling.
- **Responsive accessibility:** tests under `src/test/responsive*.test.tsx`.

Known defects tracked separately: none active beyond the flaky `workers.test.tsx` pagination timeout (covered in §22).

---

## 15. Security Requirements

| Requirement | Status |
| ----------- | ------ |
| Authentication (session tokens, expiry) | VERIFIED |
| Sessions (DB-backed, revocable) | VERIFIED |
| Password handling (bcrypt, secure change) | VERIFIED |
| Authorization (requireRole, zoneAccess) | VERIFIED |
| IDOR protection (role/kebele-scoped queries) | VERIFIED |
| Kebele isolation | VERIFIED |
| Safer-zone isolation | VERIFIED |
| Input validation (schemas) | VERIFIED |
| Secrets (`.env` required; webhook secret separate) | VERIFIED |
| CORS (env allowlist) | VERIFIED |
| Security headers (Phase 0 hardening) | VERIFIED |
| Database privileges (least privilege) | VERIFIED in schema; confirm on provisioning (P0-1) |
| Auditability (audit_log, correlationId) | VERIFIED |
| Backups (backup-db.sh SHA256-tested) | VERIFIED |
| Rollback (docs + docker volumes) | PARTIAL (documented, not executed in prod) |

---

## 16. GIS Registry

- **PostGIS:** enabled; SRID 4326.
- **Geometry types:** MULTIPOLYGON boundaries (kebeles, safer_zones); POINT (businesses, inspections, workers).
- **Kebele/safer-zone boundaries:** columns exist; official municipal dataset NOT loaded.
- **Point data:** stored from inspections (GPS→PostGIS); worker/business points available.
- **Map behavior:** MapLibre component exists; web nav map disabled "Soon".
- **Mobile GIS:** Android field ops capture GPS (Phases 11–12).
- **Official data requirements:** boundaries must come from official municipal dataset.
- **Current GIS limitations:** no official boundaries; web map disabled; data validated, not fabricated.

> **Permanent project decision: Official geographic coordinates and boundaries must never be fabricated.**

---

## 17. Data Integrity Requirements

- **Duplicates:** prevented by UNIQUE constraints (zone names, worker/date, business/month/year, receipts, gateway refs, usernames, fayda IDs, zone reports).
- **Orphan safer zones:** FKs enforce zone→kebele cardinality.
- **Cross-kebele relationships:** prevented by role-scoped server queries + `zoneAccess` (leader can only reach own zone).
- **Invalid geometry:** PostGIS validity rules; no fabricated coordinates.
- **Invalid payments:** `payment_status` enum + amount validation (`fc37a5a`).
- **Invalid attendance:** date validation + per-worker/date uniqueness.
- **Inconsistent assignments:** kebele.collector_id / zone.leader_id drive server scope.
- **Accidental deletion:** soft-delete via `is_active` flags; admin-only destructive endpoints.

---

## 18. Testing Baseline

| Category | Command | Result | Date | Commit |
| -------- | ------- | ------ | ---- | ------ |
| Frontend tests | `npx vitest run` (from `frontend-next/`) | 171/171 (17 files); workers pagination intermittent under parallel load (passes solo) | 2026-09-06 | (this commit) |
| Backend tests | `npm test` (from `backend/`, NODE_ENV=test) | 199 passing, 2 pending, 0 failing | 2026-09-06 | (this commit) |
| Lint (frontend) | `next lint` | pass | 2026-09-06 | (this commit) |
| Typecheck (frontend) | `tsc --noEmit` | pass | 2026-09-06 | (this commit) |
| Build (frontend) | `next build` | BLOCKED (environment): `next-swc` native binding SIGBUS (exit 135) in this sandbox; reproducible on a minimal throwaway app — not caused by project code; run on a normal host | 2026-09-06 | — |
| Security | `security.test.js`, `authorization.test.js` | passing | 2026-09-05 | fe316b5 |
| Database | `validate-migration.js`, `db-health-check.sh` | 9 kebeles / 108 zones verified | 2026-09-05 | fe316b5 |

Historical results preserved with date and commit.

---

## 19. Completed Work Log

| Date | Work | Result | Commit | Evidence |
| ---- | ---- | ------ | ------ | -------- |
| 2026-08-28 | Baseline + full security hardening (secrets, XSS, SQLi, CORS, sessions, uploads, webhooks, CSV, tests) | done | `4e21450`…`903ba7d` | Phase 0 docs |
| 2026-08-28 | Kebele Admin worker management | done | `c6d61cd` | — |
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
| 2026-09-05 | Dev fixes: --turbopack, :3000 container, CORS, .data, rate limits, Button/multer | done | `38f803f` `f29d8b0` `ef474c2` `3adb6fa` `6157d92` `84bd76f` | — |
| 2026-09-05 | Decommission legacy frontend (Next.js on 80/3000) | done | `43d101d` | §3.2 |
| 2026-09-05 | Dashboard: remove fake progress bars | done | `7304d7c` | §12 |
| 2026-09-05 | Dashboard: remove Performance "Soon" nav item | done | `4a5297e` | §21 |
| 2026-09-05 | Dashboard: 9-Kebele Overview real data | done | `ae5187a` | §12 |
| 2026-09-05 | Dashboard: Active Workers KPI | done | `879342f` | §12 |
| 2026-09-05 | Businesses Count Contract | done | `b28c2c4` | BUSINESSES_COUNT_CONTRACT.md |
| 2026-09-05 | Dashboard: Businesses KPI | done | `2a82988` | §12 |
| 2026-09-05 | Dashboard: Safer Zones KPI | done | `fe316b5` | §12 |
| 2026-09-05 | Master Project Registry (v1, v2.0, v2.1, v3.0) | done | `5e72309` `9943367` `08854f2` | this file |
| 2026-09-05 | Agent Work Instructions created | done | `08854f2` | AGENT_WORK_INSTRUCTIONS.md |
| 2026-09-06 | Dashboard: Kebeles KPI from authoritative `GET /api/kebeles` + repair of pre-existing compile-blocking regressions (missing KebeleSelector/KebeleSummary import from `ae5187a`, Businesses-KPI effect dropped by `fe316b5`, Workers/Zones response typing, `kebelesCode` typo) | done | (this commit) | §12, §20, §22 |
| 2026-09-06 | Dashboard: Operational Overview COMPLETE — role-aware `GET /api/dashboard/overview` aggregation (revenue totals+target+achievement, monthly trend, attendance, inspections, per-kebele comparison), real far-overview cards replacing the placeholder chart card, real 9-kebele comparison via DataTable (no more "Unavailable" worker counts), monthly trend with a11y details text alternative, honest null/zero/empty/loading/error states, api.ts `DashboardOverview` type | done | (this commit) | §6.1, §7, §9, §11, §12, §18, §20, §21 |
| 2026-09-06 | Complaints module COMPLETE (P1-2 decision: implement) — `complaints` table + migration `002_add_complaints.js`, `/api/complaints` GET/POST/PUT/:id/status/DELETE/:id/summary with role-scoped kebele/zone isolation, new→in_progress→resolved state machine, audit + `complaint_update` notifications, Complaints page (summary cards, filters, DataTable, create + status-transition modals, mobile cards, viewer read-only), nav item enabled, 31 backend tests + 8 frontend tests | done | (this commit) | §6.13, §7, §9, §10, §11, §18, §20, §21, §29, §30, §31 |

---

## 20. Incremental Improvement Log

| # | Improvement | Before | After | Commit | Tests |
| - | ----------- | ------ | ----- | ------ | ----- |
| 1 | Dashboard 9-Kebele progress bars | fabricated percentages | removed (honest) | `7304d7c` | pass |
| 2 | "Performance" nav item | disabled mock "Soon" | removed | `4a5297e` | pass |
| 3 | Dashboard 9-Kebele Overview | placeholder/static | real zone counts + payment achievement | `ae5187a` | pass |
| 4 | Active Workers KPI | static/hardcoded | `GET /workers?status=active` scoped | `879342f` | pass |
| 5 | Businesses count contract | undefined | documented authoritative contract | `b28c2c4` | docs |
| 6 | Businesses KPI | static/hardcoded | `GET /businesses?status=active` scoped | `2a82988` | pass |
| 7 | Safer Zones KPI | hardcoded 108 | `GET /api/safer-zones` scoped | `fe316b5` | pass |
| 8 | Kebeles KPI | hardcoded `9` | `useKebele().kebeles` → `GET /api/kebeles` (authoritative, all roles); loading/zero/error states | (this commit) | 8 new dashboard tests, 155/155 pass |
| 9 | Operational overview + 9-kebele comparison | placeholder "Operational overview" chart card; per-kebele worker counts "Unavailable"; no comparisons | single role-scoped `GET /api/dashboard/overview`; real revenue/attendance/inspections cards; monthly trend with a11y text alternative; real comparative DataTable; honest null/zero/empty/loading/error states | (this commit) | 8 new backend tests + 8 new dashboard tests, all pass |
| 10 | Complaints (P1-2) | nav disabled "Soon", no backend route, no page | full module implemented: `complaints` table (migration `002`), `/api/complaints` CRUD + status transitions + summary, role-scoped (leader=own zone, collector=own kebele), audit + `complaint_update` notifications, Complaints page (summary cards, filters, DataTable, create + transition modals, mobile cards, viewer read-only), nav enabled | (this commit) | 31 backend tests + 8 frontend tests, all pass |

---

## 21. Placeholder / Incomplete Inventory

| Location | Item | Classification | Priority | Status |
| -------- | ---- | -------------- | -------- | ------ |
| `nav.tsx` system | disabled "Soon" | COMING SOON | P1-3 | UNKNOWN |
| `settings/page.tsx` | 5-line placeholder | PLACEHOLDER | P2-5 | BACKLOG |
| `operations/page.tsx` | placeholder | PLACEHOLDER | P2-2 | BACKLOG |
| `locations/page.tsx` | placeholder | PLACEHOLDER | P2-3 | BACKLOG |
| `businesses/page.tsx` | placeholder | PLACEHOLDER | P2-4 | BACKLOG |
| `reports/performance/page.tsx` | real page, nav removed | OBSOLETE | P2-6 | BACKLOG |
| GIS map nav | disabled "Soon" | COMING SOON | P3-1 | BLOCKED |
| Analytics per-kebele worker breakdown | "Unavailable" | REAL UNAVAILABLE STATE | — | LIMITATION (dashboard comparison now provides `workerCount` per kebele via overview) |
| Inspection % | "Unavailable" | REAL UNAVAILABLE STATE | — | LIMITATION |

---

## 22. Technical Debt Registry

- Flaky `workers.test.tsx` pagination timeout under parallel vitest (P1-4).
- Duplicate `phase-2-ui-architecture.md` / `phase-2-ui-ux-architecture.md` (identical content) — converge to one.
- `reports/performance` route orphaned after nav removal (P2-6).
- REPAIRED in P1-1 commit: dashboard page had failed to compile since `ae5187a` (`KebeleSelector`/`KebeleSummary` used without import) and `fe316b5` dropped the Businesses-KPI state/effect while keeping the StatCard; also `kebelesCode` typo and Workers/Zones response typing were wrong. All repaired with no KPI semantics changed.
- `next build` cannot run in the current sandbox: `@next/swc-linux-x64-gnu` native binding raises SIGBUS (exit 135) — environmental, not project code (reproduced on a minimal throwaway app); must be run on a normal host.
- Frontend `next dev` is likewise unavailable in this sandbox for the same SWC reason — browser-level manual verification must happen on a normal host; vitest renders the full DashboardPage with real providers as functional coverage.
- Placeholder index pages (Operations/Locations/Businesses/Settings) — deliberate backlog items, not errors.
- No live monitoring/observability tooling yet (production BLOCKED).
- Android app not in this repo's CI test matrix (deferred).
- Backend lint/format scripts exist but recent runs not recorded in this registry.

---

## 23. Production Status

```text
Application Release:   1.0.0 (pre-production build)
Application Commit:    fe316b5
Production Host:       NOT ASSIGNED
Public IP:             NONE
DNS:                   BLOCKED (diredawa-cleaning.gov.et unassigned)
TLS:                   BLOCKED (ACME incomplete)
Database:              PostgreSQL+PostGIS ready (local Compose verified)
Deployment:            Docker Compose (80/3000 frontend, 5000 backend) verified locally
Monitoring:            documented only; not live
Backups:               backup-db.sh SHA256-tested
Rollback:              documented (docker volumes + release-process.md)
```

**State: READY (code) / BLOCKED (infrastructure).** Do not mark LIVE.

---

## 24. Deployment & Operations

References:
- `docs/operations/PRODUCTION_INFRASTRUCTURE.md`
- `docs/operations/PRODUCTION_RUNBOOK.md`
- `docs/operations/PRODUCTION_HANDOVER.md`
- `docs/operations/FINAL_PRODUCTION_GO_LIVE.md`
- `docs/operations/MUNICIPAL_IT_PRODUCTION_HANDOFF.md`
- `docs/operations/PHASE_23_INFRASTRUCTURE_VERIFICATION.md`

- **Deployment architecture:** Docker Compose services db/backend/frontend-next; Nginx TLS termination documented for prod.
- **Environment requirements:** `DB_*`, `SESSION_SECRET`, `SESSION_EXPIRY_HOURS`, `PAYMENT_WEBHOOK_SECRET`, `MAX_FILE_SIZE_MB`, `CORS_ORIGINS`, `RATE_LIMIT_*`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL` (`.env.example`). Secrets live only in `.env`.
- **Backups:** `scripts/backup-db.sh`.
- **Health checks:** backend `/api/health`; compose healthchecks for db/backend/frontend-next.
- **Logging:** `correlationId` middleware + `logs/` volume.
- **Monitoring / rollback / recovery:** documented in `disaster-recovery.md`, runbook, and `release-process.md`.

No secrets are stored in this document.

---

## 25. External Blockers

| Blocker | Owner | Impact | Required Action | Status |
| ------- | ----- | ------ | --------------- | ------ |
| Production VPS unavailable | Municipal IT | cannot deploy | allocate Ubuntu 22.04 VPS with static IP | BLOCKED |
| DNS unavailable | Municipal IT | no public domain | assign A record `diredawa-cleaning.gov.et` | BLOCKED |
| TLS unavailable | Municipal IT | no HTTPS | complete ACME/Certbot | BLOCKED |
| Official GIS dataset unavailable | Municipal IT | boundaries not loaded | supply official kebele/zone boundaries | BLOCKED |
| External payment service (live keys) | Payment providers | webhooks in sandbox | provide production credentials | BLOCKED |

---

## 26. Deferred Features

| Feature | Reason Deferred | Activation Condition | Status |
| ------- | --------------- | -------------------- | ------ |
| Android/Play Store publishing | not requested; app is field-ready | explicit authorization | DEFERRED |
| Continuous worker/vehicle GPS tracking | privacy + requirement absent | explicit request | DEFERRED |
| Route optimization | not required | explicit request | DEFERRED |
| Live payment gateway | sandbox only; external keys | production credentials | DEFERRED |

---

## 27. Rejected Decisions

| Decision | Reason | Status |
| -------- | ------ | ------ |
| TanStack Query | reverted `8587bc4`; custom `lib/api.ts` preferred | REJECTED |
| Fabricated GIS/coordinates | data integrity | REJECTED |
| Weakened server authorization | security | REJECTED |
| Unnecessary database replacement | PostgreSQL+PostGIS is the foundation | REJECTED |
| Reintroducing the legacy frontend | deliberately decommissioned `43d101d` | REJECTED |

---

## 28. Known Limitations

- Production host/infrastructure unavailable (external).
- Official GIS dataset unavailable (boundary columns empty).
- Worker-per-kebele KPI and Inspection % unavailable — no authoritative baseline; UI shows "Unavailable". Per-kebele worker counts are now available on the dashboard comparison (`workerCount`); analytics still has no per-kebele worker breakdown, and expected-vs-actual inspection % remains undefined.
- `workers.test.tsx` pagination intermittently times out under parallel vitest.
- Android build requires JAVA_HOME (not set in sandbox); verified in earlier phases.
- Live payment webhooks need production credentials.
- Backend lint/format latest pass not re-run during this documentation task.

---

## 29. Open Questions

| ID | Question | Evidence Checked | Owner | Status |
| -- | -------- | ---------------- | ----- | ------ |
| QID-001 | Implement Complaints module, or formally defer/reject it? | no route, no page; nav "Soon" | user | RESOLVED (P1-2, 2026-09-06 — implemented: route, page, data model, tests) |
| QID-002 | Should Settings/"System" become a real page or be scoped down? | `settings/page.tsx`, `users.js:95` | user | OPEN (P1-3) |
| QID-003 | Re-link `reports/performance` into nav or remove the route? | `4a5297e`, page.tsx | agent (backlog) | OPEN (P2-6) |
| QID-004 | Does "Worker" exist as a login role or only as a domain entity? | `user_role` enum (no worker) | user | OPEN |

---

## 30. Prioritized Backlog

### P0 — Critical

- **ID:** P0-1
- **Title:** Confirm DB least-privilege role on production provisioning
- **Module:** Database/Deployment
- **Reason:** security/data integrity
- **Dependencies:** production VPS
- **Acceptance Criteria:** app connects as least-privilege role (schema-created `ddcms`/`ddcms_migrator`), not superuser
- **Status:** BLOCKED (external)

### P1 — Core Functionality

- **ID:** P1-1
- **Title:** Dashboard Kebeles KPI from backend count
- **Module:** Dashboard
- **Reason:** only remaining hardcoded KPI
- **Dependencies:** none
- **Acceptance Criteria:** Kebeles StatCard from backend-sourced count respecting authorization; loading/error/empty states; tests pass
- **Status:** COMPLETE (2026-09-06)

- **ID:** P1-2
- **Title:** Complaints decision (implement or defer/reject)
- **Module:** Complaints
- **Reason:** remove UNKNOWN status
- **Dependencies:** none
- **Acceptance Criteria:** implemented OR formally deferred/rejected with rationale
- **Status:** COMPLETE (2026-09-06 — decision recorded: implemented. Rationale: P1 core functionality; pre-existing `complaint_update` notification type and nav/permission scaffolding already anticipated a real module; a user-facing portal is out of scope for the auth-only app, so staff file complaints on behalf of the community (reporter captured as free-text name/phone) — honest limitation, no fabricated data.)

- **ID:** P1-3
- **Title:** Settings/"System" decision
- **Module:** Settings
- **Reason:** remove placeholder ambiguity
- **Dependencies:** none
- **Acceptance Criteria:** real My Account page or scoped decision
- **Status:** COMPLETE (P1-3A profile implemented + P1-3B security: password change via `/api/users/:id/password` with full validation, session/logout preserved, notification preferences honestly documented as unsupported — no fake toggles; read-only profile protected from role/kebele/zone modification; all changes server-authoritative)

- **ID:** P1-4
- **Title:** Stabilize workers pagination test
- **Module:** Workers/Tests
- **Reason:** test reliability
- **Dependencies:** none
- **Acceptance Criteria:** 147/147 stable under parallel vitest
- **Status:** BACKLOG

### P2 — Important Improvements

- **P2-1** Real dashboard charts from backend dimensions (placeholder chart card). Module: Dashboard. Status: COMPLETE (2026-09-06, operational overview).
- **P2-2** Operations index page. Status: BACKLOG.
- **P2-3** Locations index page. Status: BACKLOG.
- **P2-4** Businesses index page. Status: BACKLOG.
- **P2-5** My Account/Settings page. Status: COMPLETE (P1-3A profile + P1-3B password/session; notification preferences documented unsupported — no backend endpoint).
- **P2-6** Re-link or remove `reports/performance` route. Status: BACKLOG.

### P3 — Polish

- **P3-1** Enable web GIS map when official data present. Status: BLOCKED.
- **P3-2** Kebele comparisons/operational stats (no fabrication). Status: COMPLETE (2026-09-06, dashboard overview).
- **P3-3** Remaining loading/empty/error state gaps. Status: BACKLOG.

### FUTURE — Deferred

- Android/Play Store publishing; continuous GPS tracking; route optimization; live payment gateway. (All §26.)

---

## 31. Current Next Item

```text
ID:                 P1-4
Title:              Stabilize workers pagination test
Module:             Workers/Tests
Reason:             P1-3 (Settings Security & Preferences) is COMPLETE. P1-4 is the next meaningful item: workers pagination intermittently times out under parallel vitest (documented in §22 technical debt).
Dependencies:       None (test-only fix; no backend change required).
Acceptance Criteria:
  - `workers.test.tsx` pagination passes reliably under parallel vitest (current intermittent timeout resolved).
  - 147/147 workers tests stable.
Status:             NEXT PENDING (awaits test fix)
```

No second "next" item.

---

## 32. Permanent Project Decisions & Constraints

- PostgreSQL + PostGIS remain the database foundation.
- Dire Dawa contains 9 Kebeles and 108 Safer Zones (12 per kebele).
- Backend authorization is authoritative.
- Kebele Admin is the UI terminology; underlying role IDs remain unchanged unless explicitly changed.
- Municipal/GIS data must not be fabricated.
- TanStack Query is not approved.
- Continuous GPS tracking is not approved.
- Route optimization is not approved.
- Legacy frontend must not be accidentally reintroduced (decommissioned `43d101d`).
- Mobile-first and accessibility remain required.
- Database architecture must not be changed unnecessarily.
- Android/Play Store work remains deferred unless explicitly activated.
- Production infrastructure not marked live until externally verified.
- No fake progress bars / fake KPIs (honest "Unavailable" when no authoritative data).

---

## 33. Evidence Index

| Evidence | Location |
| -------- | -------- |
| Database architecture | `database/postgresql/schema.sql`, `database/MIGRATIONS.md` |
| Security architecture | `backend/middleware/auth.js`, `backend/middleware/uploadSecurity.js`, `docs/security/` |
| Frontend architecture | `frontend-next/src/lib/api.ts`, `frontend-next/src/styles/tokens.css`, `src/components/ui/`, `src/types/domain.ts` |
| Complaints module | `backend/routes/complaints.js`, `database/migrations/002_add_complaints.js`, `frontend-next/src/app/(app)/community/complaints/page.tsx`, `backend/test/complaints.test.js`, `frontend-next/src/test/complaints.test.tsx` |
| Businesses contract | `docs/modernization/BUSINESSES_COUNT_CONTRACT.md` |
| Production infrastructure | `docs/operations/PRODUCTION_INFRASTRUCTURE.md` |
| Production runbook | `docs/operations/PRODUCTION_RUNBOOK.md` |
| Phase reports | `docs/modernization/phase-*.md`, `docs/modernization/PHASE_18/19.md` |
| Handover/go-live | `docs/operations/FINAL_PRODUCTION_GO_LIVE.md`, `MUNICIPAL_IT_PRODUCTION_HANDOFF.md`, `PHASE_23_INFRASTRUCTURE_VERIFICATION.md` |
| Deployment & operations | `docs/operations/PRODUCTION_PROVISIONING_CHECKLIST.md`, `PRODUCTION_RUNBOOK.md`, `disaster-recovery.md`, `release-process.md` |
| Key commits | `git log --oneline` (HEAD — see §34) |
| This registry | `docs/modernization/MASTER_PROJECT_REGISTRY.md` |
| Agent procedures | `docs/modernization/AGENT_WORK_INSTRUCTIONS.md` |

---

## 34. Registry Change Log

| Date | Change | Reason | Commit |
| ---- | ------ | ------ | ------ |
| 2026-09-05 | v1.0 registry created (audit + roadmap) | Phase 24 master recovery | `5e72309` |
| 2026-09-05 | v2.0 restructured to canonical 39-section schema | registry standardization directive | `9943367` |
| 2026-09-05 | v2.1 removed procedural/agent instructions → separate `AGENT_WORK_INSTRUCTIONS.md`; 31 factual sections | separation of facts from agent procedures | `08854f2` |
| 2026-09-05 | v3.0 restructured to exact 36-section schema (§0–§35); added Repository Structure, Accessibility, Data Integrity, Deployment & Operations sections | exact-structure directive | `98e9139` |
| 2026-09-06 | Separation audit — validated Registry vs Agent Work Instructions for contradictions, duplication, missing facts/rules, separation clarity; refreshed Document Control HEAD | brief validation step | (this commit) |
| 2026-09-06 | Dashboard Operational Overview COMPLETE: `/api/dashboard/overview` role-aware aggregation, real overview cards + 9-kebele comparison, honest null/zero/empty/loading/error states; §§6.1/7/9/11/12/18/19/20/21/28/30/33 updated; §31 next item unchanged (P1-2) | feature completion (P2-1/P3-2) | (this commit) |
| 2026-09-06 | Complaints module COMPLETE (P1-2 implement decision): `complaints` table + migration `002`, `/api/complaints` CRUD + status transitions + summary, role-scoped kebele/zone isolation, audit + `complaint_update` notifications, Complaints page + nav enabled, viewer read-only; 31 backend tests + 8 frontend tests, all pass; §21 `nav.tsx` complaints placeholder removed; §29 QID-001 resolved; §30 P1-2 COMPLETE; §31 next item → P1-3 (do-not-implement) | feature completion (P1-2) | (this commit) |

| 2026-09-06 | Settings Security & Preferences (P1-3B): password change (validated via `/api/users/:id/password`), session/logout preserved, notification preferences documented unsupported (no backend endpoint), read-only profile protected; registry updated §6.20/§30/§31; next item → P1-4 | feature completion (P1-3B) | (this commit) |
---

## 35. Registry Authority

```text
This document is the canonical record of the Dire Dawa Cleaning Management
System's requirements, architecture, decisions, implementation status,
history, limitations, blockers, and roadmap.

Agent workflow instructions are maintained separately in:

docs/modernization/AGENT_WORK_INSTRUCTIONS.md
```