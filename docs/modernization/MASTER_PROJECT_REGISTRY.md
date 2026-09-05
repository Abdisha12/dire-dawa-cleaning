# MASTER PROJECT REGISTRY

**Dire Dawa Cleaning Management System — factual source of truth.**

## Document Roles

```text
This document is the project's factual source of truth.

Agent workflow instructions are maintained separately in:
docs/modernization/AGENT_WORK_INSTRUCTIONS.md

The Registry records WHAT the project is and WHERE it stands.
The Agent Work Instructions define HOW an AI agent should work on it.
```

---

## 1. Registry Document Control

```text
Registry Version:       2.1
Last Updated:           2026-09-05
Last Audited:           2026-09-05
Current Project Status: STEADY — no mid-flight feature work; production infrastructure externally BLOCKED
Current Phase:          Post-modernization incremental improvements (registry keeps the roadmap)
Current Release:        1.0.0 (pre-production; local Docker Compose verified)
Current Repository HEAD: fe316b5 (main, 80 commits, clean tree)
Registry Owner:         opencode agent (maintains roadmap; user authorizes scope)
```

**Source of Truth Priority:**
1. Actual repository implementation
2. Database/schema
3. Git history
4. Existing project documentation
5. Approved requirements/decisions
6. Conversation history only when repository evidence is unavailable

---

## 2. Project Identity

- **Official name:** Dire Dawa Cleaning Management System
- **Organization:** Dire Dawa City Administration — Sanitation/Cleaning Department
- **Mission:** Digitize and manage the city's cleaning operations end-to-end — workers, attendance, wages, businesses, fees, payments, inspections, zone reporting, and GIS — with every data point authoritative, role-isolated, and operationally honest (no fabricated metrics).
- **Primary objective:** Replace the legacy static-HTML/MariaDB tool with a maintainable, mobile-first, secure system on PostgreSQL + PostGIS and a modern Next.js frontend, deployable for municipal IT on a VPS with real HTTPS, backups, monitoring, and handover documentation.

---

## 3. Municipal Model

```text
Dire Dawa
├── 9 Kebeles
│   ├── K01 Kebele 01 … K09 Kebele 09
└── 108 Safer Zones
    └── 12 per Kebele (Zone A … Zone L per kebele area)
```

Verified in `database/postgresql/schema.sql`:

- **9-kebele requirement:** structural (`UNIQUE(code)`, K01–K09) and seeded as records (lines 418–422).
- **108-safer-zone requirement:** `UNIQUE (name, kebele_id)`, 12 zones per kebele. Verified: kebele_id `1..9` each has exactly 12 records.
- **Geographic relationships:** `safer_zones.kebele_id → kebeles`; `safer_zones.leader_id → users`; `workers.safer_zone_id`; `businesses.safer_zone_id`.
- **Official GIS requirement:** kebele/zone boundaries must come from the official municipal dataset.

Three distinct truths (not to be conflated):

```text
Requirement            → 9 kebeles, 108 zones, 12/kebele (design invariant)
Actual database records → seed data present in schema; runtime records depend on usage
Official GIS data      → NOT yet loaded (boundary columns exist; municipal dataset unavailable)
```

---

## 4. Architecture

### 4.1 Frontend (canonical)
- Next.js 15.3.5 + React 19 + TypeScript, App Router.
- Tailwind-style utility styling driven by design tokens (`frontend-next/src/styles/tokens.css`).
- Component library: `src/components/ui/` (button, card, badge, data-table, modal, drawer, form, select, input, tabs, toast, tooltip, skeleton, pagination, breadcrumb, dropdown, icon, alert, checkbox, network-status).
- Central API client `src/lib/api.ts` — all requests go through it; no direct `fetch` in components.
- Domain types: `src/types/domain.ts`. Feature modules under `src/app/(app)/…`.

### 4.2 Legacy Frontend
- `frontend/` — **REMOVED** (decommissioned by commit `43d101d`). No directory exists at repo root. Deliberate, recorded decision (CHANGED from earlier "preserve legacy" constraint). Not to be reintroduced.

### 4.3 Backend
- Node.js/Express (`backend/server.js`, port 5000). Route modules in `backend/routes/`.
- Validation: `middleware/schemas.js` + `validate.js`. Auth: DB-backed sessions; `x-session-token`/Bearer.
- Authorization: `middleware/auth.js` — `authenticate`, `requireRole(...)`, `zoneAccess`; kebele/zone isolation enforced server-side in SQL.
- Data access: `pg` parameterized queries (no ORM). Config `backend/config/db.js` (default `DB_USER=ddcms`).
- Uploads: `middleware/uploadSecurity.js`. Rate limiting env-configurable (`RATE_LIMIT_*`). CORS env allowlist.

### 4.4 Database
- PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), schema `database/postgresql/schema.sql`.
- **Prisma: not used.** Migrations: `database/migrations/001_add_lifecycle_fields.js` + `MIGRATIONS.md`.
- Database users (least privilege): `ddcms` (app), `ddcms_migrator` (migrations) — created in schema (lines 491–520).
- Extensions: `postgis`, `uuid-ossp`. Geometry: MULTIPOLYGON boundaries (kebeles/zones), POINT locations (businesses/inspections/workers), SRID 4326, GIST spacial indexes.

### 4.5 Infrastructure
- **Docker:** `docker-compose.yml` — `db` (PostGIS), `backend`, `frontend-next` (ports 80/3000 frontend, 5000 backend, 5432 db) with healthchecks + resource limits.
- **systemd / Nginx:** documented only; not deployed. Nginx config specified in `PRODUCTION_INFRASTRUCTURE.md`.
- **DNS / TLS:** BLOCKED (external municipal IT).
- **Backup infrastructure:** `scripts/backup-db.sh` (SHA256-tested), `db-health-check.sh`, `check-config.sh`.
- **Monitoring:** documented dashboards only; not live.

---

## 5. Role and Authorization Model

| Role | UI Name | Database Role | Scope | Permissions | Status |
| ---- | ------- | ------------- | ----- | ----------- | ------ |
| Admin | Admin | `admin` | City-wide (all 9 kebeles) | Full CRUD across all modules | COMPLETE |
| Collector | Kebele Admin | `collector` | Assigned kebele (`kebeles.collector_id`) | Worker/inspection/business CRUD in own kebele | COMPLETE |
| Zone Leader | Zone Leader | `leader` | Own safer zone (`safer_zones.leader_id`) | Zone data visibility; `zoneAccess` enforced | COMPLETE |
| Worker | Worker | (not in `user_role` enum) | Own record / attendance | Field role only; not a login role | UNKNOWN |
| Viewer | Viewer | `viewer` | Depends on assignment | Read-only | COMPLETE |

- **Authentication:** DB sessions, token in `x-session-token`/Bearer, expiry `expires_at > NOW()` enforced.
- **Authorization:** `requireRole(...)` (403 on mismatch); `zoneAccess` (leader restricted to own zone). Collector scoped by SQL `kebele_id`; leader by `safer_zones.leader_id`.
- **Resource permissions:** per-route guards (`requireRole("admin")` on users/tools/documents/safer-zones mutations/businesses-delete/inspections-delete; `requireRole("admin","collector")` on operational CRUD).
- **Backend enforcement:** isolation in SQL + middleware, tested by `authorization.test.js`.
- **Frontend visibility:** role-aware nav; kebele selector is UX-only (see Dashboard context banner).
- **Note:** "Worker" as a login role is not represented in `user_role` (`admin`,`collector`,`leader`,`viewer`).

> **Permanent fact: Backend authorization is authoritative. Client-side filtering is never the security boundary.**

---

## 6. Functional Module Registry

Status: COMPLETE / PARTIAL / IN PROGRESS / BACKLOG / DEFERRED / BLOCKED / UNKNOWN.

### 6.1 Dashboard
- Exists: yes. Implemented: yes. Functional: yes. Real Data: yes (Safer Zones, Active Workers, Businesses KPIs; 9-Kebele Overview zones + payment achievement). Authorization: yes (role/kebele scoped). Mobile: yes. Accessibility: yes. Tests: yes. Placeholder: Kebeles KPI hardcoded `9`; "Operational overview" chart card. Known limitations: no charts yet; per-kebele worker counts "Unavailable"; inspection % "Unavailable" (no baseline). Status: PARTIAL.

### 6.2 Workers
- Exists/Implemented/Functional/Real Data/Authorization/Mobile/Accessibility: yes. Tests: yes (pagination test intermittently times out under parallel vitest; passes solo — see §20). Placeholder: none. Limitation: flaky pagination test. Status: COMPLETE.

### 6.3 Attendance
- COMPLETE. Bulk attendance; `UNIQUE(worker_id,date)`; date/context/search/summary/table; mobile-tested.

### 6.4 Salary
- COMPLETE. Salary page + per-worker history; `salary_payments` table.

### 6.5 Businesses
- COMPLETE. Count contract defined (`BUSINESSES_COUNT_CONTRACT.md`); KPI `/businesses?status=active`; index page is a placeholder (§19).

### 6.6 Payments
- COMPLETE. `/payments`, `/summary/dashboard`, `/payments/:id/verify`; Telebirr/cbebirr webhooks; sandbox checkout/callback; receipts at DB level.

### 6.7 Inspections
- COMPLETE. Photos, GPS→PostGIS, status enum, 9-kebele scoping + collector enforcement; multer body-parsing order fixed.

### 6.8 Zone Reports
- COMPLETE. Stepper UI, status state machine, `UNIQUE(safer_zone_id, report_year, report_month)`.

### 6.9 Kebeles
- COMPLETE (module). `/kebeles`, `/kebeles/:id` (PUT admin). Locations index page is a placeholder (§19).

### 6.10 Safer Zones
- COMPLETE. `/safer-zones` CRUD (admin); `UNIQUE(name,kebele_id)`; 108 seeded zones.

### 6.11 GIS
- PARTIAL. GeoJSON APIs (`/gis/kebeles|safer-zones|businesses|workers|inspections`); MapLibre map component; Android GIS. Web nav renders map disabled "Soon"; official boundaries unavailable. Backlog P3-1.

### 6.12 Notifications
- COMPLETE. `/notifications`, unread-count, mark-read, read-all, admin generate.

### 6.13 Complaints
- NOT IMPLEMENTED. No backend route (grep verified); nav item `complaints` disabled "Soon". Status: UNKNOWN (decision required — P1-2).

### 6.14 Reports
- COMPLETE. `/reports/payments/monthly|yearly`, `/reports/workers/monthly`, `/reports/inspections`, `/reports/monthly-summary`.

### 6.15 Analytics
- COMPLETE. `/analytics/attendance|payments|inspections|zones|trends`.

### 6.16 Users
- COMPLETE. `/users` CRUD (admin), `/users/leaders`.

### 6.17 Tools
- COMPLETE. `/tools` CRUD.

### 6.18 Documents
- COMPLETE. `/documents`, upload/download with `uploadSecurity.js` validation.

### 6.19 Audit Logs
- COMPLETE. `/auditLog` (admin-only read).

### 6.20 My Account
- PARTIAL. Password change API exists (`/users/:id/password`); Settings page is a placeholder; nav `system` disabled "Soon". Backlog P1-3/P2-5.

---

## 7. Requirements Registry

| ID | Requirement | Module | Priority | Status | Evidence |
| -- | ----------- | ------ | -------- | ------ | -------- |
| REQ-MUN-001 | 9 Kebeles, 108 Safer Zones, 12/kebele | Municipal | P0 | COMPLETE | schema.sql seed + UNIQUE constraints |
| REQ-OPS-001 | Worker management (CRUD, active/inactive) | Workers | P1 | COMPLETE | `workers.js`, Workers page |
| REQ-OPS-002 | Attendance (single + bulk, uniqueness) | Attendance | P1 | COMPLETE | `workers.js:315,381`, attendance tests |
| REQ-OPS-003 | Salary/payroll tracking | Salary | P1 | COMPLETE | `salary_payments`, Salary page |
| REQ-BIZ-001 | Business registration with safer-zone link | Businesses | P1 | COMPLETE | `locations.js`, Businesses page |
| REQ-PAY-001 | Payments by business/month, webhooks | Payments | P1 | COMPLETE | `payments.js`, sandbox |
| REQ-INSP-001 | Cleanliness inspections + photos + GPS | Inspections | P1 | COMPLETE | `inspections.js`, Inspections page |
| REQ-ZREP-001 | Zone reports with status workflow | Zone Reports | P1 | COMPLETE | `zoneReports.js`, stepper UI |
| REQ-GIS-001 | PostGIS boundaries + point locations | GIS | P1 | PARTIAL | schema geometry, gis.js |
| REQ-GIS-002 | Web map visualization | GIS | P2 | PARTIAL | MapLibre component | 
| REQ-COM-001 | Complaints from community | Complaints | P1 | UNKNOWN | no route/page → P1-2 |
| REQ-REP-001 | Reports + CSV where implemented | Reports | P1 | COMPLETE | reports.js |
| REQ-ANA-001 | Analytics & kebele comparisons | Analytics | P1 | COMPLETE | analytics.js |
| REQ-ADM-001 | Users/roles administration | Users | P1 | COMPLETE | users.js |
| REQ-ADM-002 | Tools/equipment registry | Tools | P1 | COMPLETE | tools.js |
| REQ-ADM-003 | Documents storage | Documents | P1 | COMPLETE | documents.js |
| REQ-ADM-004 | Audit logs | Audit Logs | P1 | COMPLETE | auditLog.js |
| REQ-ADM-005 | Settings / My Account | Settings | P1 | PARTIAL | users.js:95; placeholder page |
| REQ-SEC-001 | Server-authoritative kebele/zone isolation | Security | P0 | COMPLETE | auth.js, SQL filters, authorization tests |
| REQ-SEC-002 | Sessions, secrets, CORS, rate limits | Security | P0 | COMPLETE | Phase 0 commits, env config |
| REQ-DASH-001 | Dashboard KPIs with real backend data | Dashboard | P1 | COMPLETE | dashboard commits §17/§18 |
| REQ-MOB-001 | Android field operations | Android | P1 | COMPLETE | android/ (Phases 10–12) |
| REQ-PROD-001 | Production deployment | Production | P1 | BLOCKED | infra docs; external municipal IT |

---

## 8. Frontend Migration Registry

| Dimension | Legacy `frontend/` | New `frontend-next/` | Status |
| --------- | ------------------ | -------------------- | ------ |
| Functionality | Removed | All modules implemented | MIGRATED (obsolesced) |
| Routes | N/A | App Router | MIGRATED |
| Authentication | N/A | Token sessions | MIGRATED |
| Data integration | N/A | `lib/api.ts` → backend | MIGRATED |
| Permissions | N/A | Role-aware nav + backend | MIGRATED |
| Mobile | N/A | Responsive + bottom nav | MIGRATED |
| Accessibility | N/A | audit maintained | MIGRATED |
| Public landing | plan | `(public)/login` | MIGRATED |

- **Canonical frontend:** `frontend-next/` (sole frontend since `43d101d`).
- **Remaining migration work:** none from legacy (deleted). Outstanding work is placeholder completion (see §19), not legacy parity.
- **Compatibility requirements:** none (legacy gone).

---

## 9. API Registry

| Endpoint | Method | Module | Authentication | Scope | Pagination | Status |
| -------- | ------ | ------ | -------------- | ----- | ---------- | ------ |
| `/api/auth/login` | POST | Auth | public | — | — | COMPLETE |
| `/api/auth/logout` | POST | Auth | auth | — | — | COMPLETE |
| `/api/auth/me` | GET | Auth | auth | — | — | COMPLETE |
| `/api/health` | GET | Health | public | — | — | COMPLETE |
| `/api/public/stats` | GET | Public | public | city | — | COMPLETE |
| `/api/workers` | GET | Workers | auth | role/kebele | yes | COMPLETE |
| `/api/workers/summary/stats` | GET | Workers | auth | role/kebele | — | COMPLETE |
| `/api/workers` | POST | Workers | admin/collector | own kebele | — | COMPLETE |
| `/api/workers/attendance/bulk` | POST | Attendance | admin/collector | own kebele | — | COMPLETE |
| `/api/workers/:id/attendance` | GET | Attendance | auth | role/kebele | yes | COMPLETE |
| `/api/workers/:id/salary` | GET | Salary | auth | role/kebele | — | COMPLETE |
| `/api/businesses` | GET | Businesses | auth | role/kebele | yes | COMPLETE |
| `/api/businesses` | POST | Businesses | admin/collector | own kebele | — | COMPLETE |
| `/api/kebeles` | GET | Kebeles | auth | — | — | COMPLETE |
| `/api/safer-zones` | GET | Safer Zones | auth | role/kebele | — | COMPLETE |
| `/api/payments` | GET | Payments | auth | role/leader | yes | COMPLETE |
| `/api/payments/summary/dashboard` | GET | Payments | auth | role/leader | — | COMPLETE |
| `/api/payments/callback/telebirr` | POST | Payments | webhook | — | — | COMPLETE |
| `/api/payments/callback/cbebirr` | POST | Payments | webhook | — | — | COMPLETE |
| `/api/inspections` | GET | Inspections | auth | role/kebele | yes | COMPLETE |
| `/api/zone-reports` | GET | Zone Reports | auth | role/kebele | yes | COMPLETE |
| `/api/gis/kebeles` | GET | GIS | auth | city | — | COMPLETE |
| `/api/gis/safer-zones` | GET | GIS | auth | role | — | COMPLETE |
| `/api/reports/payments/monthly` | GET | Reports | auth | role | — | COMPLETE |
| `/api/analytics/attendance` | GET | Analytics | auth | role | — | COMPLETE |
| `/api/analytics/zones` | GET | Analytics | auth | role | — | COMPLETE |
| `/api/users` | GET/POST | Users | admin | city | yes | COMPLETE |
| `/api/users/:id/password` | PUT | Settings | self/admin | — | — | COMPLETE |
| `/api/tools` | GET/POST | Tools | admin | city | yes | COMPLETE |
| `/api/documents` | GET | Documents | auth | role/kebele | yes | COMPLETE |
| `/api/auditLog` | GET | Audit Logs | admin | city | yes | COMPLETE |
| `/api/notifications` | GET | Notifications | auth | user | — | COMPLETE |
| `/api/sandbox/sandbox-checkout` | GET | Payments sandbox | auth | — | — | COMPLETE |

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

### Enums
`user_role`(admin,collector,leader,viewer) · `business_type`(shop,cafe,hotel,restaurant,pharmacy,market,workshop,office,school,clinic,other) · `payment_method`(cash,mobile,bank,other,telebirr,cbebirr) · `payment_status`(paid,pending,overdue,failed) · `inspection_status`(active,warning,danger) · `tool_category`(vehicle,equipment,uniform,chemical,other) · `tool_condition`(good,fair,poor,broken) · `report_status`(draft,submitted,reviewed,approved) · `document_category`(contract,photo,training,incident,report,other)

### Constraints
- FKs with cascades / SET NULL as declared.
- UNIQUE: `kebeles.name`, `kebeles.code`, `safer_zones(name,kebele_id)`, `attendance(worker_id,date)`, `payments(business_id,month,year)`, `users.username`, `workers.fayda_id`, `receipt_number`, `gateway_ref`, zone-report `(safer_zone_id,report_year,report_month)`.
- `update_updated_at()` trigger on all operational tables.

### Indexes
`idx_sz_kebele`, `idx_workers_active_zone`, `idx_users_role_active`, `idx_inspections_kebele`, `idx_businesses_active`, `idx_doc_kebele`, login_attempts indexes, GIST spatial indexes.

### Geometry
- Types: `GEOMETRY(MULTIPOLYGON, 4326)` (kebeles.boundary, safer_zones.boundary); `GEOMETRY(POINT, 4326)` (businesses.location, inspections.location, workers.location).
- SRID: 4326. GIST spatial indexes present. Boundaries owned by official municipal dataset (not yet loaded).

### Migrations & Roles
- Migration: `database/migrations/001_add_lifecycle_fields.js`; strategy SQL + `MIGRATIONS.md` + `validate-migration.js`; seed `database/postgresql/schema.sql`.
- Database roles (least privilege): `ddcms` (app), `ddcms_migrator` (migrations) — created in schema lines 491–520; app connects as `DB_USER` (default `ddcms`).

### PostGIS Configuration
- Extension enabled; SRID 4326; MULTIPOLYGON boundaries + POINT locations; validation = never fabricate.

---

## 11. Business Rules and Data Definitions

- **Active Worker** — Definition: worker with `is_active=TRUE`. Source: `GET /workers?status=active` (backend filters `w.is_active=TRUE`). Formula: count of active workers. Included: active in scope (admin=city, collector=own kebele, leader=own zone). Excluded: inactive. Scope: role/kebele. Status: COMPLETE.
- **Active Business** — Definition: business with `is_active=TRUE`. Source: `GET /businesses?status=active` (backend `b.is_active=TRUE`). Contract: `BUSINESSES_COUNT_CONTRACT.md`. Formula: count of active businesses in scope. Included/Excluded per contract. Status: COMPLETE.
- **Payment Achievement** — Definition: collected/pending/overdue totals + by-kebele collected vs target. Source: `/payments/summary/dashboard`. Formula: `SUM(amount)` by status; `SUM(b.monthly_target)` target. Status: COMPLETE.
- **Inspection %** — Definition: NOT defined (no authoritative expected-inspection baseline). Dashboard shows "Unavailable" honestly. Status: LIMITATION.
- **Attendance** — Definition: attendance record per worker per date; `UNIQUE(worker_id,date)`; bulk allowed. Status: COMPLETE.
- **Kebele** — Definition: one of 9 municipal kebeles, K01–K09; scope unit for collectors. Status: COMPLETE.
- **Safer Zone** — Definition: one of 108 zones; 12 per kebele; scope unit for leaders. Status: COMPLETE.
- **Zone Report** — Definition: monthly report per safer zone; unique per `(safer_zone_id, year, month)`; workflow draft→submitted→reviewed→approved. Status: COMPLETE.
- **Safer Zone Count (KPI)** — Definition: count of safer zones in scope, excluding `is_active=false`. Source: `GET /api/safer-zones`. Status: COMPLETE.

---

## 12. Dashboard Metric Contracts

| KPI | Definition | Source | Scope | Calculation | Status |
| --- | ---------- | ------ | ----- | ----------- | ------ |
| Kebeles | 9 (currently hardcoded) | `dashboard/page.tsx` | admin | count (backend TBD) | P1-1 |
| Safer Zones | count of zones, active-only | `GET /api/safer-zones` | role/kebele | length of returned rows `is_active!==false` | COMPLETE |
| Active Workers | count of `is_active` workers | `GET /workers?status=active` | role/kebele | count of returned workers | COMPLETE |
| Businesses | count of `is_active` businesses | `GET /businesses?status=active` | role/kebele | count (see contract) | COMPLETE |
| Payment achievement | collected vs target by kebele | `/payments/summary/dashboard` | role/leader | SUM(paid amount); target SUM | COMPLETE |
| Workers per kebele | per-kebele counts | none authoritative | kebele | "Unavailable" (no baseline) | LIMITATION |
| Inspection % | expected-vs-actual inspections | none authoritative | — | "Unavailable" | LIMITATION |

Dedicated contract: `docs/modernization/BUSINESSES_COUNT_CONTRACT.md`.

---

## 13. UI/UX Rules as PROJECT DECISIONS

Approved design decisions (recorded; implementation in `frontend-next/src/styles/tokens.css` and `src/components/ui/`):

- **Mobile-first** responsive design; sidebar (desktop) + bottom nav (mobile).
- **Design tokens** are the single source of truth — no arbitrary per-component colors.
- **Typography:** Inter + Segoe UI fallback; `--text-base 15px`, `--leading 1.5`, heading scale `--h-hero/--h-section/--h-card`.
- **Spacing:** 4–64 px scale (`--s-1..--s-16`).
- **Colors:** semantic tokens (primary/secondary/success/warning/danger/information/neutral + status mapping draft/submitted/reviewed/approved); dark-mode tokens prepared but opt-in.
- **Breakpoints:** `--bp-sm 480 / md 768 / lg 1024 / xl 1280`.
- **Radii / shadows / z-index:** token-driven (`--r-*`, `--shadow-*`, `--z-*`).
- **Icons:** centralized Lucide component (`components/ui/icon.tsx`); emojis not used in modules.
- **Component conventions:** shadcn-style primitives; server pagination in tables; react-hook-form inputs; skeleton loading, alert error, toast success, empty-state text, offline `network-status` banner.
- **Accessibility target:** WCAG AA (login Tab-order, dialog focus, aria-disabled nav, accessible labels — covered by tests).

---

## 14. Security Rules as PROJECT REQUIREMENTS

Permanent requirements (implemented and tested):

- **Server-authoritative authorization** — client-side filtering is never a security boundary (see §5).
- **Kebele isolation** — collectors scoped by SQL `kebele_id`.
- **Safer-zone isolation** — leaders scoped by `safer_zones.leader_id` (`zoneAccess`).
- **Session security** — DB `sessions` table, token header, expiry, `is_active` gate; no tokens in URLs.
- **Secret handling** — `.env` required; separate webhook secret; Phase 0 removed exposed secrets.
- **Input validation** — schema-based (`validate.js`); XSS/SQLi parameterization; CSV formula injection prevented.
- **Database least privilege** — `ddcms` / `ddcms_migrator` roles; no superuser default.
- **Auditability** — `audit_log` for admin actions; `correlationId` request logging.
- **Hardening extras:** env CORS allowlist, rate limits (`RATE_LIMIT_*`), upload security (MIME/sanitize/size), security headers.

---

## 15. GIS Requirements

- **PostGIS:** enabled; SRID 4326.
- **Geometry types:** MULTIPOLYGON boundaries (kebeles, safer_zones); POINT (businesses, inspections, workers).
- **Kebele/safer-zone boundaries:** columns exist; official municipal dataset NOT loaded.
- **Point data:** stored from inspections (GPS→PostGIS); worker/business points available.
- **Map behavior:** MapLibre component exists; web nav map disabled "Soon".
- **Mobile GIS:** Android field ops capture GPS (Phases 11–12).
- **Current GIS limitations:** no official boundaries; web map disabled; validates against real data.

> **Permanent decision: Official geographic information must not be fabricated.**

---

## 16. Testing Baseline

| Category | Command | Result | Date | Commit |
| -------- | ------- | ------ | ---- | ------ |
| Frontend | `npx vitest run` (from `frontend-next/`) | 147/147 (15 files); workers pagination intermittent under parallel load (passes solo) | 2026-09-05 | fe316b5 |
| Backend | `npm test` (from `backend/`, NODE_ENV=test) | 161 passing, 2 pending, 0 failing (10 suites) | 2026-09-05 | fe316b5 |
| Lint (frontend) | `next lint` | script present (run before changes) | — | — |
| Typecheck (frontend) | `tsc --noEmit` | run before changes | — | — |
| Build (frontend) | `next build` (no `--turbopack`) | verified (local) | prior phases | — |
| Security | `security.test.js`, `authorization.test.js` | passing | 2026-09-05 | fe316b5 |
| Database | `validate-migration.js`, `db-health-check.sh` | 9 kebeles / 108 zones verified | 2026-09-05 | fe316b5 |

Historical results are preserved with date and commit.

---

## 17. Completed Work History

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
| 2026-09-05 | Decommission legacy frontend (Next.js on 80/3000) | done | `43d101d` | §4.2 |
| 2026-09-05 | Dashboard: remove fake progress bars | done | `7304d7c` | §12 |
| 2026-09-05 | Dashboard: remove Performance "Soon" nav item | done | `4a5297e` | §19 |
| 2026-09-05 | Dashboard: 9-Kebele Overview real data | done | `ae5187a` | §12 |
| 2026-09-05 | Dashboard: Active Workers KPI | done | `879342f` | §12 |
| 2026-09-05 | Businesses Count Contract | done | `b28c2c4` | BUSINESSES_COUNT_CONTRACT.md |
| 2026-09-05 | Dashboard: Businesses KPI | done | `2a82988` | §12 |
| 2026-09-05 | Dashboard: Safer Zones KPI | done | `fe316b5` | §12 |
| 2026-09-05 | Master Project Registry (v1, v2.0, v2.1) | done | `5e72309` `9943367` | this file |
| 2026-09-05 | Agent Work Instructions created | done | (this commit) | AGENT_WORK_INSTRUCTIONS.md |

---

## 18. Incremental Improvement History

| # | Improvement | Before | After | Commit | Tests |
| - | ----------- | ------ | ----- | ------ | ----- |
| 1 | Dashboard 9-Kebele progress bars | fabricated percentages | removed (honest) | `7304d7c` | pass |
| 2 | "Performance" nav item | disabled mock "Soon" | removed | `4a5297e` | pass |
| 3 | Dashboard 9-Kebele Overview | placeholder/static | real zone counts + payment achievement | `ae5187a` | pass |
| 4 | Active Workers KPI | static/hardcoded | `GET /workers?status=active` scoped | `879342f` | pass |
| 5 | Businesses count contract | undefined | documented authoritative contract | `b28c2c4` | docs |
| 6 | Businesses KPI | static/hardcoded | `GET /businesses?status=active` scoped | `2a82988` | pass |
| 7 | Safer Zones KPI | hardcoded 108 | `GET /api/safer-zones` scoped | `fe316b5` | pass |

---

## 19. Placeholder / Incomplete Inventory

| Location | Item | Classification | Priority | Status |
| -------- | ---- | -------------- | -------- | ------ |
| `/dashboard` Operational overview | chart skeletons | PLACEHOLDER | P2-1 | BACKLOG |
| `/dashboard` Kebeles StatCard | hardcoded `9` | PLACEHOLDER | P1-1 | NEXT PENDING |
| `nav.tsx` complaints | disabled "Soon" | COMING SOON | P1-2 | UNKNOWN |
| `nav.tsx` system | disabled "Soon" | COMING SOON | P1-3 | UNKNOWN |
| `settings/page.tsx` | 5-line placeholder | PLACEHOLDER | P2-5 | BACKLOG |
| `operations/page.tsx` | placeholder | PLACEHOLDER | P2-2 | BACKLOG |
| `locations/page.tsx` | placeholder | PLACEHOLDER | P2-3 | BACKLOG |
| `businesses/page.tsx` | placeholder | PLACEHOLDER | P2-4 | BACKLOG |
| `reports/performance/page.tsx` | real page, nav removed | OBSOLETE | P2-6 | BACKLOG |
| GIS map nav | disabled "Soon" | COMING SOON | P3-1 | BLOCKED |
| 9-Kebele worker counts | "Unavailable" | REAL UNAVAILABLE STATE | — | LIMITATION |
| Inspection % | "Unavailable" | REAL UNAVAILABLE STATE | — | LIMITATION |

---

## 20. Technical Debt

- Flaky `workers.test.tsx` pagination timeout under parallel vitest (P1-4).
- Duplicate `phase-2-ui-architecture.md` / `phase-2-ui-ux-architecture.md` (identical content) — converge to one.
- `reports/performance` route orphaned after nav removal (P2-6).
- Placeholder index pages (Operations/Locations/Businesses/Settings) — deliberate backlog items, not errors.
- No live monitoring/observability tooling yet (production BLOCKED).
- Android app not in this repo's CI test matrix (deferred).
- Backend lint/format scripts exist but recent runs not recorded in this registry.

---

## 21. Production Status

```text
Application:         1.0.0 (pre-production build)
Application Commit:  fe316b5
Production Host:     NOT ASSIGNED
Public IP:           NONE
DNS:                 BLOCKED (diredawa-cleaning.gov.et unassigned)
TLS:                 BLOCKED (ACME incomplete)
Database:            PostgreSQL+PostGIS ready (local Compose verified)
Deployment:          Docker Compose (80/3000 frontend, 5000 backend) verified locally
Backups:             backup-db.sh SHA256-tested
Monitoring:          documented only; not live
Rollback:            documented (docker volumes + release-process.md)
```

**State: READY (code) / BLOCKED (infrastructure).** Do not mark LIVE.

---

## 22. External Blockers

| Blocker | Owner | Impact | Required External Action | Status |
| ------- | ----- | ------ | ------------------------ | ------ |
| Production VPS unavailable | Municipal IT | cannot deploy | allocate Ubuntu 22.04 VPS with static IP | BLOCKED |
| DNS unavailable | Municipal IT | no public domain | assign A record `diredawa-cleaning.gov.et` | BLOCKED |
| TLS unavailable | Municipal IT | no HTTPS | complete ACME/Certbot | BLOCKED |
| Official GIS dataset unavailable | Municipal IT | boundaries not loaded | supply official kebele/zone boundaries | BLOCKED |
| External payment service (live keys) | Payment providers | webhooks in sandbox | provide production credentials | BLOCKED |

References: `docs/operations/PRODUCTION_INFRASTRUCTURE.md`, `PRODUCTION_RUNBOOK.md`, `PRODUCTION_HANDOVER.md`, `FINAL_PRODUCTION_GO_LIVE.md`, `MUNICIPAL_IT_PRODUCTION_HANDOFF.md`, `PHASE_23_INFRASTRUCTURE_VERIFICATION.md`.

---

## 23. Deferred Features

| Feature | Reason Deferred | Activation Condition | Status |
| ------- | --------------- | -------------------- | ------ |
| Android/Play Store publishing | not requested; app is field-ready | explicit authorization | DEFERRED |
| Continuous worker/vehicle GPS tracking | privacy + requirement absent | explicit request | DEFERRED |
| Route optimization | not required | explicit request | DEFERRED |
| Live payment gateway | sandbox only; external keys | production credentials | DEFERRED |

---

## 24. Rejected Decisions

| Decision | Reason | Status |
| -------- | ------ | ------ |
| TanStack Query | reverted `8587bc4`; custom `lib/api.ts` preferred | REJECTED |
| Fabricated GIS/coordinates | data integrity | REJECTED |
| Weakened server authorization | security | REJECTED |
| Unnecessary database replacement | PostgreSQL+PostGIS is the foundation | REJECTED |
| Reintroducing the legacy frontend | deliberately decommissioned `43d101d` | REJECTED |

---

## 25. Known Limitations

- Production host/infrastructure unavailable (external).
- Official GIS dataset unavailable (boundary columns empty).
- Worker-per-kebele KPI and Inspection % unavailable — no authoritative baseline; UI shows "Unavailable".
- `workers.test.tsx` pagination intermittently times out under parallel vitest.
- Android build requires JAVA_HOME (not set in sandbox); verified in earlier phases.
- Live payment webhooks need production credentials.
- Backend lint/format latest pass not re-run during this documentation task.

---

## 26. Open Questions

| ID | Question | Evidence Checked | Owner | Status |
| -- | -------- | ---------------- | ----- | ------ |
| QID-001 | Implement Complaints module, or formally defer/reject it? | no route, no page; nav "Soon" | user | OPEN (P1-2) |
| QID-002 | Should Settings/"System" become a real page or be scoped down? | `settings/page.tsx`, `users.js:95` | user | OPEN (P1-3) |
| QID-003 | Re-link `reports/performance` into nav or remove the route? | `4a5297e`, page.tsx | agent (backlog) | OPEN (P2-6) |
| QID-004 | Does "Worker" exist as a login role or only as a domain entity? | `user_role` enum (no worker) | user | OPEN |

---

## 27. Prioritized Backlog

### P0 — Critical
- **P0-1** — Confirm DB least-privilege role on production provisioning. Module: Database/Deployment. Reason: security/data integrity. Dependencies: production VPS. Acceptance: app connects as least-privilege role (schema-created `ddcms`/`ddcms_migrator`), not superuser. Status: BLOCKED (external).

### P1 — Core Functionality
- **P1-1** — Dashboard Kebeles KPI from backend count. Module: Dashboard. Reason: only remaining hardcoded KPI. Dependencies: none. Acceptance: Kebeles StatCard from backend-sourced count respecting authorization; loading/error/empty states; tests pass. Status: NEXT PENDING.
- **P1-2** — Complaints decision. Module: Complaints. Reason: remove UNKNOWN status. Acceptance: implemented OR formally deferred/rejected with rationale. Status: UNKNOWN.
- **P1-3** — Settings/"System" decision. Module: Settings. Reason: remove placeholder ambiguity. Acceptance: real My Account page or scoped decision. Status: UNKNOWN.
- **P1-4** — Stabilize workers pagination test. Module: Workers/Tests. Reason: test reliability. Acceptance: 147/147 stable under parallel vitest. Status: BACKLOG.

### P2 — Important Improvements
- **P2-1** Real dashboard charts from backend dimensions (placeholder chart card). Module: Dashboard. Status: BACKLOG.
- **P2-2** Operations index page. Status: BACKLOG.
- **P2-3** Locations index page. Status: BACKLOG.
- **P2-4** Businesses index page. Status: BACKLOG.
- **P2-5** My Account/Settings page. Status: BACKLOG.
- **P2-6** Re-link or remove `reports/performance` route. Status: BACKLOG.

### P3 — Polish
- **P3-1** Enable web GIS map when official data present. Status: BLOCKED.
- **P3-2** Kebele comparisons/operational stats (no fabrication). Status: BACKLOG.
- **P3-3** Remaining loading/empty/error state gaps. Status: BACKLOG.

### FUTURE — Deferred
- Android/Play Store publishing; continuous GPS tracking; route optimization; live payment gateway. (All §23.)

---

## 28. Current Next Item

```text
Current Next Item:  P1-1 — Dashboard Kebeles KPI: replace hardcoded "9" with a backend-sourced
                    kebele count, mirroring the Safer Zones / Active Workers / Businesses KPIs.

Reason:             It is the only remaining hardcoded KPI on the Dashboard and aligns with the
                    established pattern (real backend data, authorized scope, no fabrication).
                    Highest value among unblocked, dependency-free items.

Dependencies:       None. (Kebeles already served by GET /api/kebeles with role/kebele scoping.)

Acceptance Criteria:
  - Kebeles StatCard shows a count fetched from the backend (not literal 9).
  - Request respects role authorization (admin=city; collector/leader=assigned scope).
  - Loading / error / empty states match the other KPI cards ("Unavailable" on failure).
  - Frontend tests pass; no regression in the 147-pass suite.

Status:             NEXT PENDING
```

No second "next" item.

---

## 29. Permanent Project Constraints

- PostgreSQL + PostGIS remain the database foundation.
- Dire Dawa has 9 Kebeles and 108 Safer Zones (12 per kebele).
- Authorization is server-authoritative; backend is authoritative.
- Kebele Admin is the UI term; DB role remains `collector`.
- Never fabricate municipal data or GIS.
- No TanStack Query.
- No continuous GPS tracking unless explicitly activated.
- No route optimization unless explicitly activated.
- Legacy frontend was decommissioned; do not reintroduce it.
- Mobile-first and accessibility remain mandatory.
- Do not weaken security for convenience.
- Do not change database architecture unnecessarily.
- Do not publish Android/Play Store unless explicitly activated.
- Production infra not marked live until externally verified.
- One task = one complete improvement (enforced by AGENT_WORK_INSTRUCTIONS.md).
- Test → verify → commit → update registry → STOP (enforced by AGENT_WORK_INSTRUCTIONS.md).

---

## 30. Evidence Index

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
| Agent procedures | `docs/modernization/AGENT_WORK_INSTRUCTIONS.md` |

---

## 31. Registry Change Log

| Date | Registry Change | Reason | Commit |
| ---- | --------------- | ------ | ------ |
| 2026-09-05 | v1.0 registry created (audit + roadmap) | Phase 24 master recovery | `5e72309` |
| 2026-09-05 | v2.0 restructured to canonical 39-section schema | registry standardization directive | `9943367` |
| 2026-09-05 | v2.1 removed procedural/agent instructions → separate `AGENT_WORK_INSTRUCTIONS.md`; renumbered to 31 factual sections | separation of facts from agent procedures | (this commit) |