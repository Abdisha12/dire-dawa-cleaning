# Phase 0 Baseline — Dire Dawa Cleaning Management System

**Date:** 2026-08-29
**Git Branch:** main (no commits yet — pre-commit baseline)
**Version:** 2.0.0 (per backend/package.json)

---

## 1. Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE (3 services)               │
│                                                              │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────┐  │
│  │   Frontend    │   │    Backend       │   │    DB      │  │
│  │  Nginx:80    │──▶│  Express:5000    │──▶│ MariaDB 11 │  │
│  │  Static SPA  │   │  Node.js 20      │   │            │  │
│  └──────────────┘   └──────────────────┘   └────────────┘  │
│       │                    │                     ↑          │
│   index.html          /api/*              schema.sql        │
│   js/*.js            /uploads/*           (16 tables)       │
│   css/main.css       services/                              │
│                     middleware/                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Browser loads `index.html` from Nginx (port 80)
2. Nginx serves static JS/CSS files directly
3. Nginx proxies `/api/*` and `/uploads/*` to backend (port 5000)
4. Backend connects to MariaDB (port 3306, internal network only)
5. All rendering happens client-side via Vanilla JS SPA
6. Hash-based routing (`#dashboard`, `#businesses`, etc.)

---

## 2. Current Versions

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20.19.0 | Runtime |
| npm | 10.8.2 | Package manager |
| MariaDB | 11 | Docker image `mariadb:11` |
| Nginx | Alpine | Docker image `nginx:alpine` |
| Express.js | ^4.18.3 | HTTP framework |
| mysql2 | ^3.9.2 | Database driver |
| bcryptjs | ^2.4.3 | Password hashing |
| helmet | ^7.1.0 | Security headers |
| express-rate-limit | ^7.2.0 | Rate limiting |
| multer | ^1.4.5-lts.1 | File uploads |
| pdfkit | ^0.19.1 | PDF generation |
| exceljs | ^4.4.0 | Excel export |
| winston | ^3.12.0 | Logging |
| winston-daily-rotate-file | ^5.0.0 | Log rotation |
| uuid | ^9.0.1 | Session tokens |
| Chart.js | 4.4.1 | CDN, dashboard charts |
| Mocha | ^10.2.0 | Test runner (dev) |
| Supertest | ^6.3.4 | HTTP testing (dev) |
| Chai | ^4.3.7 | Assertions (dev) |
| Sinon | ^15.2.0 | Mocks (dev) |

---

## 3. Current Services (Docker Compose)

| Service | Container | Image | Port | Volume |
|---------|-----------|-------|------|--------|
| `db` | ddcms_db | mariadb:11 | Internal | `db_data` → /var/lib/mysql |
| `backend` | ddcms_backend | Custom (node:20-alpine) | Internal (5000) | `uploads_data` → /app/uploads, `logs_data` → /app/logs |
| `frontend` | ddcms_frontend | Custom (nginx:alpine) | 80 → ${FRONTEND_PORT} | None |

**Network:** `ddcms_net` (bridge driver)
**Restart policy:** `unless-stopped` on all services
**DB healthcheck:** `healthcheck.sh --connect --innodb_initialized`

---

## 4. Current Database Schema

### 16 Tables

| # | Table | Columns | Keys | Indexes |
|---|-------|---------|------|---------|
| 1 | `users` | id, username, password_hash, full_name, fayda_id, phone, role, is_active, created_at, updated_at | PK: id, UQ: username, UQ: fayda_id | — |
| 2 | `sessions` | id, user_id, expires_at, created_at | PK: id, FK: user_id→users | — |
| 3 | `kebeles` | id, name, code, collector_id, created_at | PK: id, UQ: name, UQ: code, FK: collector_id→users | — |
| 4 | `safer_zones` | id, name, kebele_id, leader_id, description, created_at, updated_at | PK: id, FK: kebele_id→kebeles, FK: leader_id→users, UQ: (name,kebele_id) | — |
| 5 | `businesses` | id, name, owner_name, owner_fayda_id, owner_phone, type, monthly_target, safer_zone_id, is_active, notes, created_at, updated_at | PK: id, FK: safer_zone_id→safer_zones | — |
| 6 | `payments` | id, business_id, amount, method, status, month, year, paid_at, receipt_number, notes, collected_by, gateway_name, gateway_ref, payment_url, created_at, updated_at | PK: id, FK: business_id→businesses, FK: collected_by→users, UQ: (business_id,month,year), UQ: receipt_number, UQ: gateway_ref | — |
| 7 | `inspections` | id, kebele_id, safer_zone_id, date, status, notes, inspected_by, created_at, updated_at | PK: id, FK: kebele_id→kebeles, FK: safer_zone_id→safer_zones, FK: inspected_by→users, UQ: (safer_zone_id,date) | — |
| 8 | `inspection_photos` | id, inspection_id, file_path, uploaded_at | PK: id, FK: inspection_id→inspections | — |
| 9 | `workers` | id, full_name, contact, fayda_id, daily_wage, safer_zone_id, is_active, custom_attributes, created_at, updated_at | PK: id, UQ: fayda_id, FK: safer_zone_id→safer_zones | — |
| 10 | `attendance` | id, worker_id, date, present, bonus, notes, recorded_by, created_at | PK: id, FK: worker_id→workers, FK: recorded_by→users, UQ: (worker_id,date) | — |
| 11 | `salary_payments` | id, worker_id, amount, paid_at, period_from, period_to, notes, paid_by, created_at | PK: id, FK: worker_id→workers, FK: paid_by→users | — |
| 12 | `tools` | id, name, category, quantity, condition_status, safer_zone_id, notes, acquired_date, created_at, updated_at | PK: id, FK: safer_zone_id→safer_zones | — |
| 13 | `zone_reports` | id, safer_zone_id, report_date, report_month, report_year, submitted_by, status, workers_present, workers_absent, collection_total, issues_reported, actions_taken, tools_status, reviewed_by, reviewed_at, reviewer_notes, created_at, updated_at | PK: id, FK: safer_zone_id→safer_zones, FK: submitted_by→users, FK: reviewed_by→users | — |
| 14 | `audit_log` | id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at | PK: id, FK: user_id→users | idx_audit_entity, idx_audit_user, idx_audit_date |
| 15 | `notifications` | id, user_id, type, title, message, link, is_read, created_at | PK: id, FK: user_id→users | idx_notif_user_read, idx_notif_date |
| 16 | `documents` | id, title, description, category, file_path, file_name, file_size, mime_type, safer_zone_id, kebele_id, uploaded_by, created_at, updated_at | PK: id, FK: safer_zone_id→safer_zones, FK: kebele_id→kebeles, FK: uploaded_by→users | idx_doc_category, idx_doc_zone |

### Seed Data
- **7 users:** admin, collector1, collector2, leader_k1z1, leader_k1z2, leader_k2z1, viewer1 (all password: `password`)
- **9 kebeles:** K01–K09, each assigned to collector1 or collector2
- **108 safer zones:** 12 per kebele (Zone A–L), only 3 have leaders assigned
- **5 businesses:** Sample businesses in zones 1, 2, 3, 13
- **5 workers:** Sample workers in zones 1, 2, 13
- **5 tools:** Sample equipment in zones 1, 2

### Schema Gaps (Known)
- No indexes on `payments.status`, `attendance.date`, `workers.safer_zone_id`, `zone_reports.status/month/year`
- No unique constraint on `zone_reports(safer_zone_id, report_month, report_year)`
- No `ON DELETE` behavior for `payments.collected_by` and `inspections.inspected_by`
- No audit fields (`created_at`/`updated_at`) missing from some logical entities
- Sessions table has no automatic cleanup

---

## 5. Current API Endpoints

### Auth (3 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| POST | `/api/auth/login` | No | — |
| POST | `/api/auth/logout` | Yes | any |
| GET | `/api/auth/me` | Yes | any |

### Users (6 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/users` | Yes | admin, collector |
| GET | `/api/users/leaders` | Yes | admin, collector |
| POST | `/api/users` | Yes | admin |
| PUT | `/api/users/:id` | Yes | admin |
| PUT | `/api/users/:id/password` | Yes | admin or self |
| DELETE | `/api/users/:id` | Yes | admin |

### Locations — Kebeles, Zones, Businesses (11 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/kebeles` | Yes | any |
| PUT | `/api/kebeles/:id` | Yes | admin |
| GET | `/api/safer-zones` | Yes | any |
| GET | `/api/safer-zones/:id` | Yes | any |
| POST | `/api/safer-zones` | Yes | admin |
| PUT | `/api/safer-zones/:id` | Yes | admin |
| DELETE | `/api/safer-zones/:id` | Yes | admin |
| GET | `/api/businesses` | Yes | any |
| GET | `/api/businesses/:id` | Yes | any |
| POST | `/api/businesses` | Yes | admin, collector, leader |
| PUT | `/api/businesses/:id` | Yes | admin, collector, leader |
| DELETE | `/api/businesses/:id` | Yes | admin |

### Payments (9 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| POST | `/api/payments/callback/telebirr` | No | — |
| POST | `/api/payments/callback/cbebirr` | No | — |
| GET | `/api/payments/summary/dashboard` | Yes | any |
| GET | `/api/payments` | Yes | any |
| POST | `/api/payments` | Yes | admin, collector, leader |
| GET | `/api/payments/:id/verify` | Yes | any |
| PUT | `/api/payments/:id` | Yes | admin, collector |
| DELETE | `/api/payments/:id` | Yes | admin |

### Inspections (6 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/inspections` | Yes | any |
| GET | `/api/inspections/:id` | Yes | any |
| POST | `/api/inspections` | Yes | admin, collector, leader |
| PUT | `/api/inspections/:id` | Yes | admin, collector, leader |
| DELETE | `/api/inspections/photo/:photoId` | Yes | admin, collector, leader |
| DELETE | `/api/inspections/:id` | Yes | admin, collector |

### Workers (8 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/workers/summary/stats` | Yes | any |
| POST | `/api/workers/attendance/bulk` | Yes | admin, collector, leader |
| GET | `/api/workers` | Yes | any |
| POST | `/api/workers` | Yes | admin, collector, leader |
| PUT | `/api/workers/:id` | Yes | admin, collector, leader |
| DELETE | `/api/workers/:id` | Yes | admin, collector |
| GET | `/api/workers/:id/attendance` | Yes | any |
| GET | `/api/workers/:id/salary` | Yes | any |
| POST | `/api/workers/:id/salary` | Yes | admin, collector, leader |

### Tools (4 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/tools` | Yes | any |
| POST | `/api/tools` | Yes | admin, collector, leader |
| PUT | `/api/tools/:id` | Yes | admin, collector, leader |
| DELETE | `/api/tools/:id` | Yes | admin, collector |

### Zone Reports (6 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/zone-reports` | Yes | any |
| GET | `/api/zone-reports/:id` | Yes | any |
| POST | `/api/zone-reports` | Yes | admin, collector, leader |
| PUT | `/api/zone-reports/:id` | Yes | admin, collector, leader |
| PUT | `/api/zone-reports/:id/review` | Yes | admin, collector |
| DELETE | `/api/zone-reports/:id` | Yes | admin |

### Reports (5 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/reports/payments/monthly` | Yes | any |
| GET | `/api/reports/payments/yearly` | Yes | any |
| GET | `/api/reports/workers/monthly` | Yes | any |
| GET | `/api/reports/inspections` | Yes | any |
| GET | `/api/reports/monthly-summary` | Yes | any |

### Audit Log (2 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/audit-log` | Yes | admin |
| GET | `/api/audit-log/:id` | Yes | admin |

### Notifications (6 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/notifications` | Yes | any |
| GET | `/api/notifications/unread-count` | Yes | any |
| PUT | `/api/notifications/:id/read` | Yes | any |
| PUT | `/api/notifications/read-all` | Yes | any |
| DELETE | `/api/notifications/:id` | Yes | any |
| POST | `/api/notifications/generate` | Yes | admin, collector |

### Analytics (5 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/analytics/attendance` | Yes | any |
| GET | `/api/analytics/payments` | Yes | any |
| GET | `/api/analytics/inspections` | Yes | any |
| GET | `/api/analytics/zones` | Yes | any |
| GET | `/api/analytics/trends` | Yes | any |

### Documents (5 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/documents` | Yes | any |
| POST | `/api/documents` | Yes | admin, collector, leader |
| GET | `/api/documents/:id/download` | Yes | any |
| PUT | `/api/documents/:id` | Yes | admin, collector, leader |
| DELETE | `/api/documents/:id` | Yes | admin, collector |

### Public & Sandbox (3 endpoints)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/public/stats` | No | — |
| GET | `/api/public/sandbox-checkout` | No | — |
| POST | `/api/public/sandbox-callback-trigger` | No | — |

### Health (1 endpoint)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/health` | No | — |

**Total: ~80 API endpoints across 15 route modules**

---

## 6. Current Frontend Routes/Pages

| # | Page Key | Render Function | File | Lines | Description |
|---|----------|-----------------|------|-------|-------------|
| 1 | `landing` | `renderLanding` | `js/pages/landing.js` | 288 | Public landing page |
| 2 | `login` | `renderLogin` | `js/pages/login.js` | 59 | Login form |
| 3 | `dashboard` | `renderDashboard` | `js/pages/dashboard.js` | 235 | Analytics dashboard |
| 4 | `businesses` | `renderBusinesses` | `js/pages/businesses.js` | 233 | Business CRUD |
| 5 | `inspections` | `renderInspections` | `js/pages/inspections.js` | 195 | Inspection + photos |
| 6 | `workers` | `renderWorkers` | `js/pages/workers.js` | 441 | Worker mgmt + attendance + salary |
| 7 | `payments` | `renderPayments` | `js/pages/payments.js` | 289 | Payment mgmt + gateway |
| 8 | `tools` | `renderTools` | `js/pages/tools.js` | 175 | Tool/equipment inventory |
| 9 | `zonereports` | `renderZoneReports` | `js/pages/zonereports.js` | 270 | Zone report workflow |
| 10 | `reports` | `renderReports` | `js/pages/reports.js` | 265 | Reports + CSV/PDF/XLSX export |
| 11 | `documents` | `renderDocuments` | `js/pages/documents.js` | 223 | Document management |
| 12 | `notifications` | `renderNotifications` | `js/pages/notifications.js` | 139 | Notification center |
| 13 | `auditlog` | `renderAuditLog` | `js/pages/auditlog.js` | 156 | Audit trail (admin) |
| 14 | `users` | `renderUsers` | `js/pages/users.js` | 192 | User management (admin) |
| 15 | `settings` | `renderSettings` | `js/pages/settings.js` | 228 | Settings + assignments |

**Navigation items (sidebar):** 13 items (landing/login not in sidebar)
**Mobile bottom nav:** 5 items (dashboard, inspections, workers, payments, notifications)

### Frontend File Inventory
| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 40 | SPA entry point |
| `css/main.css` | 389 | Complete design system |
| `js/api.js` | 158 | API client (all endpoints) |
| `js/utils.js` | 124 | Utilities (toast, modal, formatters) |
| `js/main.js` | 214 | Router + app shell |
| **15 page files** | **~2,847** | Individual page modules |
| **Total frontend** | **~3,672** | |

---

## 7. How the Application Starts

### Local Development (without Docker)

```bash
# Terminal 1: Backend
cd backend
cp .env.example .env   # edit with real credentials
npm install
npm run dev             # runs: nodemon server.js

# Terminal 2: Frontend
cd frontend
npx http-server -p 3000
# OR: python3 -m http.server 3000

# Browser: http://localhost:3000
```

**Backend .env configuration:**
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=dire_dawa_cleaning
PORT=5000
NODE_ENV=development
SESSION_SECRET=change_this_to_a_long_random_string_min_32_chars
SESSION_EXPIRY_HOURS=8
MAX_FILE_SIZE_MB=5
```

### Docker Compose

```bash
cd dire-dawa-cleaning
docker compose up --build -d

# Frontend: http://localhost:80 (or ${FRONTEND_PORT})
# Backend API: http://localhost:5000 (internal only)
# Database: localhost:3306 (internal only)
```

**Root .env configuration:**
```
DB_PASSWORD=ddcms_root_pass
SESSION_SECRET=change_this_to_a_long_random_string_min_32_chars
SESSION_EXPIRY_HOURS=8
MAX_FILE_SIZE_MB=5
FRONTEND_PORT=80
```

### npm Scripts (backend)
- `npm run dev` → `nodemon server.js`
- `npm start` → `node server.js`
- `npm test` → `mocha test/ --timeout 10000`

---

## 8. Existing Test Status

### Test Files
| File | Tests | Framework |
|------|-------|-----------|
| `backend/test/health.test.js` | 1 test | Mocha + Chai + Supertest |

### Test Coverage
- **Backend:** 1 test (health endpoint only) — 0% business logic coverage
- **Frontend:** 0 tests
- **Integration:** 0 tests
- **E2E:** 0 tests

### Test Infrastructure
- Mocha test runner with 10s timeout
- Supertest for HTTP assertions
- Chai for assertions
- Sinon for mocks/stubs (available but unused)
- Tests can run without database (graceful DB connection failure handling)

### CI Pipeline (GitHub Actions)
- Triggers on push/PR to main/master
- Spins up MariaDB 11 service container
- Uses Node.js 18
- Imports schema with `|| true` (failures silently ignored)
- Runs `npm ci && npm test` in backend

---

## 9. Known Vulnerabilities (from Audit)

### CRITICAL
| # | Issue | Location |
|---|-------|----------|
| 1 | `.env` files committed to git with DB password and session secret | `backend/.env`, `.env` |
| 2 | XSS in sandbox checkout page — query params injected into HTML | `routes/sandbox.js` |
| 3 | SQL injection in dead code — `leaderZoneFilter` concatenates user ID | `routes/workers.js:18` |

### HIGH
| # | Issue | Location |
|---|-------|----------|
| 4 | CORS `origin:"*"` allows any website | `server.js:38` |
| 5 | Session token accepted via URL query parameter | `middleware/auth.js:6` |
| 6 | No current-password verification on password change | `routes/users.js:65` |
| 7 | No file type validation on document uploads | `routes/documents.js:52` |
| 8 | Root DB password = App DB password | `docker-compose.yml:9,12` |
| 9 | Hardcoded session secret fallback | `docker-compose.yml:44` |

### MEDIUM
| # | Issue | Location |
|---|-------|----------|
| 10 | No account lockout after failed login | `routes/auth.js` |
| 11 | Weak receipt generation using `Math.random()` | `routes/payments.js:15` |
| 12 | CSV injection risk in report export | `routes/reports.js` |
| 13 | No state machine for zone report workflow | `routes/zoneReports.js` |
| 14 | SESSION_SECRET used as payment HMAC key | `services/paymentService.js:78` |
| 15 | QR code via third-party API leaks payment URLs | `js/pages/payments.js` |
| 16 | No Content-Security-Policy headers | `frontend/nginx.conf` |
| 17 | innerHTML XSS risk in toast/confirmDialog | `js/utils.js` |
| 18 | CI pipeline has hardcoded root password | `.github/workflows/ci.yml` |
| 19 | No database indexes on frequently queried columns | `database/schema.sql` |

---

## 10. Changes Planned in Phase 0

### Phase 0 Objectives
Make the existing system **safe, stable, measurable, and ready** for later modernization phases. No framework migration, no visual redesign.

### 10.1 Git Baseline (this document)
- Record current state in `docs/modernization/phase-0-baseline.md`
- Create initial commit with full project state

### 10.2 Security Fixes (Critical + High)
| Fix | Priority | What Changes |
|-----|----------|-------------|
| Remove `.env` from git tracking | Critical | Add `.env` to `.gitignore`, rotate secrets |
| Fix XSS in sandbox page | Critical | Sanitize all query params before HTML injection |
| Remove dead SQL injection code | Critical | Delete unused `leaderZoneFilter` in workers.js |
| Restrict CORS | High | Change from `*` to configured allowed origins |
| Remove token from URL | High | Remove `?token=` support, use header-only auth |
| Add current-password check | High | Require current password for password changes |
| Add file type validation | High | Restrict document uploads to safe file types |
| Separate DB passwords | High | Use different passwords for root vs app user |
| Fix session secret fallback | High | Remove hardcoded fallback, require explicit config |

### 10.3 Database Indexes
```sql
-- Add to schema.sql (or as migration)
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_month_year ON payments(month, year);
CREATE INDEX idx_payments_collected_by ON payments(collected_by);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_worker_date ON attendance(worker_id, date);
CREATE INDEX idx_workers_zone ON workers(safer_zone_id);
CREATE INDEX idx_workers_active ON workers(is_active);
CREATE INDEX idx_zonereports_status ON zone_reports(status);
CREATE INDEX idx_zonereports_period ON zone_reports(report_month, report_year);
CREATE INDEX idx_zonereports_zone_period ON zone_reports(safer_zone_id, report_month, report_year);
CREATE INDEX idx_inspections_date ON inspections(date);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_zone ON inspections(safer_zone_id);
CREATE INDEX idx_tools_zone ON tools(safer_zone_id);
CREATE INDEX idx_tools_category ON tools(category);
```

### 10.4 Development Safeguards
| Fix | What Changes |
|-----|-------------|
| Add `.gitignore` | Prevent .env, node_modules, uploads, logs from being committed |
| Add ESLint + Prettier | Consistent code style, catch common errors |
| Fix `.env.example` | Make it a true template with placeholder values |
| Remove unrelated files | Delete `20260616211058_shelly-install_deepin-camera.log` |
| Fix VSCode launch.json | Remove hardcoded path |

### 10.5 Backend Hardening
| Fix | What Changes |
|-----|-------------|
| Add input validation | Add Zod or express-validator to all routes |
| Add proper error handling | Generic error messages in production |
| Add graceful shutdown | Handle SIGTERM/SIGINT |
| Fix background scanner errors | Log errors instead of silently swallowing |
| Add session cleanup | Background job to purge expired sessions |

### 10.6 Test Infrastructure
| Fix | What Changes |
|-----|-------------|
| Add backend API tests | Test all CRUD endpoints (target: 80% coverage) |
| Add auth tests | Test login, logout, token validation, role enforcement |
| Add validation tests | Test input validation and error handling |
| Fix CI pipeline | Don't ignore schema import failures |

### What Phase 0 Does NOT Change
- No React migration
- No frontend visual redesign
- No PostgreSQL migration
- No GIS integration
- No mobile/PWA development
- No new features
- No removal of existing functionality
- No dependency upgrades (unless security-critical)
- No database schema changes (only indexes)

---

## Appendix A: File Inventory

### Backend (31 source files)
```
backend/
├── package.json
├── server.js
├── .env
├── .env.example
├── Dockerfile
├── .dockerignore
├── config/
│   ├── db.js
│   └── logger.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── locations.js
│   ├── payments.js
│   ├── inspections.js
│   ├── workers.js
│   ├── tools.js
│   ├── reports.js
│   ├── zoneReports.js
│   ├── public.js
│   ├── sandbox.js
│   ├── auditLog.js
│   ├── notifications.js
│   ├── analytics.js
│   └── documents.js
├── services/
│   ├── auditService.js
│   ├── paymentService.js
│   ├── notificationService.js
│   ├── pdfService.js
│   └── excelService.js
└── test/
    └── health.test.js
```

### Frontend (19 source files)
```
frontend/
├── index.html
├── Dockerfile
├── nginx.conf
├── package-lock.json
├── css/
│   └── main.css
└── js/
    ├── api.js
    ├── utils.js
    ├── main.js
    └── pages/
        ├── landing.js
        ├── login.js
        ├── dashboard.js
        ├── businesses.js
        ├── inspections.js
        ├── workers.js
        ├── tools.js
        ├── payments.js
        ├── zonereports.js
        ├── reports.js
        ├── notifications.js
        ├── auditlog.js
        ├── documents.js
        ├── users.js
        └── settings.js
```

### Infrastructure
```
dire-dawa-cleaning/
├── docker-compose.yml
├── .env
├── .dockerignore
├── .github/workflows/ci.yml
├── .vscode/launch.json
├── database/
│   └── schema.sql
└── README.md
```

---

## Appendix B: Default Login Credentials

All passwords: `password`

| Username | Role | Zone/Kebele |
|----------|------|-------------|
| admin | admin | All |
| collector1 | collector | K01, K02, K05, K07, K09 |
| collector2 | collector | K03, K04, K06, K08 |
| leader_k1z1 | leader | Zone A - Kezira Main (zone 1) |
| leader_k1z2 | leader | Zone B - Kezira North (zone 2) |
| leader_k2z1 | leader | Zone A - Sabian Main (zone 13) |
| viewer1 | viewer | Read-only (no zone) |

---

## Appendix C: Business Types (ENUM)

shop, cafe, hotel, restaurant, pharmacy, market, workshop, office, school, clinic, other

## Appendix D: Payment Methods (ENUM)

cash, mobile, bank, other, telebirr, cbebirr

## Appendix E: Payment Status (ENUM)

paid, pending, overdue, failed

## Appendix F: Inspection Status (ENUM)

active, warning, danger

## Appendix G: Tool Categories (ENUM)

vehicle, equipment, uniform, chemical, other

## Appendix H: Tool Condition (ENUM)

good, fair, poor, broken

## Appendix I: Zone Report Status (ENUM)

draft, submitted, reviewed, approved

## Appendix J: Document Categories (ENUM)

contract, photo, training, incident, report, other
