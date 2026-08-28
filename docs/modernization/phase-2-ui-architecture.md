# Phase 2 — UI/UX Architecture & Design System

**From:** `f15498c` (PostgreSQL+PostGIS complete)  
**Status:** Design/architecture — no full rewrite, no React migration yet  
**Goal:** Define the municipal operations platform the redesign will build toward.

---

## 1. Audit — Existing Vanilla JS Frontend

**Stack:** `index.html` → `api.js` (fetch + `x-session-token`) → `utils.js` → 14 page modules + `main.js` hash router (`#dashboard`). `main.css` 389 lines. `Chart.js 4.4.1` CDN. Nginx SPA.

**Router (`js/main.js`):** `PAGES = {landing, login, dashboard, businesses, inspections, workers, tools, payments, zonereports, reports, documents, notifications, auditlog, users, settings}`. `NAV` 13 items (emoji icons). `PUBLIC_PAGES = [landing,login]`. Shell `renderShell()` role-filters nav, shows `avatar-${role}`, `zone-badge` for leaders, bell `#notif-badge` polled 60s, hamburger + mobile bottom-nav (5 items).

### Per-Page Inventory

| # | Route | Label/Roles | Core UI | Forms / Modals | Tables / Lists | Charts | States |
|---|---|---|---|---|---|---|---|
| 0 | `landing` | public | nav, hero (9kebele/108zone mock-browser), 8 live stats (`getPublicStats`), 8 features, about, demo, contact, footer | — | — | mock bars | spinner / “Stats unavailable” |
| 1 | `login` | public | `.auth-card` hierarchy banner, user+pass(+toggle) | login (`API.login`) | — | — | inline `#login-error` |
| 2 | `dashboard` | all | `leaderBanner` + `hierarchy-chain` + 4 stats (collected/pending/overdue/attendance) + progress bar + 3 charts + 2 tables | — | leaderboard (rank/zone/kebele/revenue/attendance/score) + kebele breakdown (target/collected/%) | bar (monthly rev), doughnut (methods), pie (inspection dist) | spinner/empty/error |
| 3 | `businesses` | all; add/edit: admin/collector/leader | filters: kebele, type (11), search; toolbar `+ Add Business` | `biz-modal` (name, owner, fayda 12d, phone, type, kebele→zone, target, status, notes) + `pay-quick-modal` | `Name/Owner/Type/Zone/Kebele/Target/Status/Actions` (edit admin-collector + delete, pay) paginated 25 | — | empty 🏪 |
| 4 | `inspections` | admin/collector/leader | filters: kebele (if not leader), status, from/to, search; `+ Add` | `insp-modal` (kebele, zone, date=today, status radio, notes, photos×10, thumbs), `photos-modal` gallery | `Date/Kebele/Zone/Status/Inspector/Photos/Notes/Actions` | — | empty 🔍 |
| 5 | `workers` | admin/collector/leader | zone filter (not leader), search, 3 stats (total/active/wage) | `worker-modal` (name, contact, fayda, wage, zone, status, custom attrs builder) + `attend-modal` bulk (present/bonus grid) + `worker-attend-modal` + `salary-modal` + `worker-card-modal` (ID card print) | `Name/Contact/Fayda/Zone/Wage/Status/Actions` (edit, card, attendance, salary, delete) — no pagination | — | empty 👷 |
| 6 | `tools` | admin/collector/leader | zone+category filters, 4 stats (good/fair/poor-broken/total qty) | `tool-modal` (name, category, qty, condition, zone, date, notes) | `Name/Category/Qty/Condition/Zone/Kebele/Notes/Actions` paginated | — | — |
| 7 | `payments` | admin/collector/leader | kebele/month/year/status filters, 3 stats, CSV | `pay-modal` (business→amount prefill, method, month/year, notes) + `gateway-modal` (telebirr/cbebirr QR via `api.qrserver.com`, poll `verifyPayment` 3s) + `receipt-modal` (print) | `Receipt/Business/Zone/Kebele/Amount/Method/Status/Period/PaidAt/Collector/Actions` paginated | — | — |
| 8 | `zonereports` | admin/collector/leader | info banner, filters month/year/status/zone, `+ New` (leader), `Pending Review` count | `zr-modal` (zone, date, draft/submit, present/absent, collection, issues/actions/tools) + `review-modal` (notes→reviewed/approved) + `zr-detail-modal` | `Zone/Kebele/Period/Leader/Status/Workers/Collection/Reviewed/Actions` (view, submit, review, approve, edit) | — | — |
| 9 | `reports` | admin/collector/viewer (no leader) | header Print, consolidated `monthly-summary` xlsx | — params per card: payment monthly/yearly, worker monthly, inspection range | Payment table, Yearly table + bar, Worker table, Inspection table grouping `i.id` | `report-chart` bar (collected/pending/overdue) | spinner/empty red error |
| 10 | `documents` | all; upload admin/collector/leader | cat tabs (contract/photo/training/incident/report/other), search, zone filter, `Upload` | `upload-doc-modal` (title, category, zone, file 10MB, desc) | card grid (icon, badge, image preview, title, file+size, uploader+date, download/delete) | — | empty 📂 |
| 11 | `notifications` | all | title + `Mark All Read` + `Trigger Alert Scan` (admin/collector), filter All/Unread/Read | — | card list (icon by type, title+New badge, date, msg, link, mark-read, delete) paginated 20 | — | empty 🔔; bell badge |
| 12 | `auditlog` | admin only | filters: entity, action, from/to, `Filter Logs` | — diff modal | `Timestamp/User/Action/Entity/IP/Details (View Diff)` pre `safeJsonDisplay` paginated 25 | — | guard “Access restricted” |
| 13 | `users` | admin only | role filter, search, `+ Add User`, chain text | `user-modal` (username readonly edit, pw min6, fullName, phone, fayda, role, status) + `pw-modal` (current if self, new 8+letter+number, confirm) | `Username/FullName/Phone/Fayda/Role/Zone/Status/Actions` (edit/pw/delete) | — | guard |
| 14 | `settings` | all (admin = 4 cards, others = password only) | non-admin: password form (480px); admin: `Kebele—Collector` table (collector select+Save), `Zone—Leader` (add, kebele filter, leader select+Save, delete), `Leaders Overview`, password | `add-zone-modal` (name, kebele, leader, desc) | `Kebele/ Zones badge/Collector` etc. | — | — |

**Reusable primitives (`utils.js`):** `escapeHtml/Attr/JsStr`, `safeJsonDisplay`, `toast`, `confirmDialog`, `buildModal/openModal/closeModal`, `validateForm`, `statusBadge` (paid/pending/overdue/active/warning/danger/role/draft…/approved/good/fair/poor), `fmtETB`, `fmtDate`, `todayISO`, `monthName`, `paginate`+`renderPagination`, `filterTable`, `downloadCSV`, `spinnerHTML`, `leaderBanner`, `validateFaydaId/formatFaydaId`.

**Loading/empty/error/mobile:** every page `spinnerHTML` → empty `.empty .icon` → error `⚠️ escapeHtml`. `main.css`: `.table-wrap` scroll, `.toolbar` flex-wrap, `mobile-bottom-nav` <768px, `modal` → bottom sheet <768px, `stats-grid` 4→2→1, print hides sidebar/topbar.

### Mapping — Existing → Future

| Existing screen | Existing functionality | Future redesigned screen | Future navigation |
|---|---|---|---|
| `landing` | public stats, features, contact | **Public / Landing** (outside app shell) | `/(public)` |
| `login` | auth | **Sign In** | `/(public)/login` |
| `dashboard` | 4 stats + progress + 3 charts + leaderboard + kebele breakdown | **Dashboard** (see §5-6: City → Kebele → Zone contexts) | `Dashboard` |
| `businesses` | 11-type shops, kebele/zone filter, pay shortcut | **Businesses** under `Locations → Businesses` + quick-pay | `Locations/Businesses` |
| `inspections` | daily inspections + photos | **Inspections** (with future map pins) | `Operations/Inspections` |
| `workers` | workers + attendance bulk + salary + ID card | **Workers** + **Attendance** as sibling under `Operations` | `Operations/Workers`, `Operations/Attendance` |
| `tools` | 5 categories inventory | **Tools & Equipment** | `Administration/Tools & Equipment` (ops-adjacent) |
| `payments` | collections + telebirr/cbebirr QR poll + receipts | **Payments** (Collections) | `Finance/Payments` |
| `zonereports` | draft→submitted→reviewed→approved workflow | **Zone Reports** | `Operations/Zone Reports` |
| `reports` | monthly/yearly/worker/inspection + CSV/PDF/XLSX | **Reports & Analytics** split: `Reports` (exports) + `Analytics` (trends) | `Reports & Analytics/…` |
| `documents` | 6 categories + image preview + zone assoc | **Documents** | `Administration/Documents` (or `Operations/Documents`) |
| `notifications` | 3 alert types + bell poll | **Notifications** (Community/Alerts) | `Community/Notifications` |
| `auditlog` | entity/action/date filters + diff | **Audit Logs** | `Administration/Audit Logs` |
| `users` | CRUD + role + fayda + pw | **Users** + **Roles & Permissions** | `Administration/Users` |
| `settings` | kebele↔collector, zone↔leader, pw | **Locations/Kebeles** (collector assignment), **Locations/Safer Zones** (leader assignment) + **Settings/My Account** | `Locations/…` + `Settings` |

No functionality removed — Complaints (if present), GIS Map, Routes, Tasks are **future** placeholders (§4).

---

## 2. User Roles — UI Reflects Authorization

Backend roles (`users.role` enum `admin|collector|leader|viewer`) stay. UI label **Kebele Admin** = `collector` (never “Kebele Collector”). Internal `collector` identifier unchanged.

| Role | Label | Scope enforced by backend | UI sees |
|---|---|---|---|
| System Administrator | Admin | all 9 kebeles, all zones, `users` CRUD, `auditlog`, `settings` assignments | City-wide: 9-kebele overview, system analytics, Users, Roles, Tools, Audit, all ops |
| Kebele Admin | Kebele Admin (`collector`) | `kebeles.collector_id` → zones in that kebele; `workers`/`businesses` filtered via `sz.kebele_id` | **My Kebele** context: auto-scoped kebele selector locked, workers/safer zones/businesses/inspections/reports for that kebele only; cannot see other kebeles even if selector is spoofed |
| Zone Leader | Leader | `safer_zones.leader_id` one zone | **My Safer Zone** context: `leaderBanner`, all lists filtered `sz.leader_id = me`, hide other zones |
| Viewer | Viewer | read-only, no create/update | Dashboards + Reports + Documents view, no mutating modals |
| (future) Collector/field ops | — | if discovered, under Kebele Admin hierarchy | not invented now |

Rule: frontend role filtering is convenience; every `PUT/POST/DELETE` re-checks `requireRole` + ownership in `backend/middleware/auth.js` and per-route `leader_id`/`kebele_id` clauses.

---

## 3. 9-Kebele Information Architecture

```
Dire Dawa
 └─ 9 Kebeles (K01–K09, `kebeles` table)
     └─ Safer Zones (108, `safer_zones.kebele_id`, leader_id)
         └─ Operational Area: Business / Worker / Inspection / Report / Route (future LINESTRING)
```

Kebele is an **operational boundary**, not a filter. Reusable components (future):

- `KebeleSelector` — locked for Kebele Admin (their 1), dropdown for Admin (9), with `code` + `collector` badge
- `KebeleSummaryCard` — target/collected/achievement, zones count, leaders assigned
- `KebeleDashboard` — see §6 (compare 9)
- `KebeleStatistics` — worker counts, inspection completion, payments
- `KebeleMap` (future) — `kebeles.boundary MULTIPOLYGON` via PostGIS `ST_AsGeoJSON`
- `KebeleStatus` — operational status (reports submitted/approved)

Admin: system-wide 9-kebele grid. Kebele Admin: auto-scoped to `their kebele` (selector disabled, API params forced). Zone Leader: scoped to `their safer_zone` (kebele shown read-only).

---

## 4. New Global Navigation

Evolved from prompt starter, pruned to **actual modules**; future items marked `(future)`.

```
Dashboard
Operations
 ├── Workers
 ├── Attendance          [splits workers bulk attendance]
 ├── Inspections
 ├── Zone Reports
 └── Cleaning Operations (future)
Locations
 ├── Kebeles             [ex-settings: collector assignment]
 ├── Safer Zones         [ex-settings: leader assignment]
 └── GIS Map (future)    [PostGIS boundaries/routes]
Businesses & Finance
 ├── Businesses
 ├── Payments            [telebirr/cbebirr, receipts]
 └── Inspections          (also under Operations; cross-link)
Community
 ├── Notifications       [overdue/pending- report/absent]
 └── Complaints (future)
Reports & Analytics
 ├── Reports             [payment monthly/yearly, worker monthly, inspection range + CSV/PDF/XLSX]
 ├── Analytics           [attendance, payment, inspection, zone trends]
 └── Performance         [leaderboard, kebele breakdown]
Administration
 ├── Users
 ├── Tools & Equipment   [5 categories]
 ├── Documents           [6 categories + previews]
 └── Audit Logs
Settings
 ├── My Account          [password]
 └── System              [admin: kebele/zone assignment moved to Locations]
```

Dark-grey sidebar `245px` + top-bar `60px` + mobile bottom-nav 5 items retained as layout pattern; hash routes become `/dashboard` etc. in future Next.js but mapping above preserves every existing screen (no deletion).

---

## 5. Dashboard Design — Operational Decisions

**Principle:** show actions/risks, not decoration.

**Global stats (top):** total kebeles (9), active workers, active businesses, inspections last 30d, collected this month (`fmtETB`), pending/overdue, overdue items count, operational performance (attendance %), alerts (unread).

- **Admin:** city-wide 4 stats + progress bar (`Monthly Revenue Target %` green≥80/orange≥50/red) + revenue bar + methods doughnut + inspection pie + leaderboard + kebele breakdown.
- **Kebele Admin:** **My Kebele** — replace city stats with kebele stats (workers in kebele, businesses, inspections in kebele, collection vs kebele target, reports completion for its 12 zones). Selector locked.
- **Zone Leader:** **My Safer Zone** — single-zone stats (my workers present, my inspections, my payments, my zone report status) + `leaderBanner` hierarchy.

---

## 6. Dashboard — 9-Kebele Overview (admin)

Card grid 3×3 for K01–K09. Each card: kebele name+code, collector avatar, 12-zone mini progress, metrics: worker count, operational status (submitted/approved reports), inspection completion %, payment achievement `collected/target`, complaint count (future). Sort by lowest achievement first.

Compare table (current `Kebele Breakdown`): `Kebele | Code | Target | Collected | Achievement badge` with `badge-green≥80/orange≥50/red`. Future: sparkline per kebele, click-through `→ Locations/Kebeles/:id`.

Not overloaded — only municipal decisions: which kebele needs workers, which zones missed reports, where payments lag.

---

## 7. Design System

**Typography:** `Inter` (fallback `Segoe UI, system-ui`). Heading: `800` hero `2.6rem→2.1rem→1.75`, section `1.9rem`, card title `0.95rem 600`. Body `15px/1.5`, label `0.75rem 500 uppercase 0.05em`, small `0.68rem`. Numerical: `1.5rem 700` stats, `fmtETB` tabular.

**Spacing scale:** `4, 8, 12, 16, 20, 24, 32, 48, 64` — `--radius 8px → modal 10-12 → hero 14`. Gaps: `toolbar 12, stats-grid 16, section 64`.

**Borders:** radius `6` inputs/buttons/badges, `8` cards, `10-12` modals, `999px` badges/pills. `border: 1px solid var(--gray-200)` cards/tables; `border-left: 3-4px solid status` stat cards.

**Shadows:** restrained — `--shadow: 0 1px 3px rgba(0,0,0,.12)`, `--shadow-md: 0 4px 6px rgba(0,0,0,.1)`, mock-browser `0 25px 60px -15px rgba(29,78,216,.35)`. No heavy floating.

**Icons:** **one** system — `Lucide` (outline, 1.5px stroke) replaces current emoji mix `📊🔔🏪🔍👷🔧💳📝📁📋📜👥⚙️`. Emoji only for `landing` illustration. Future icons sized `1.1rem` nav, `2rem` feature.

**Components (tokens):**
- Buttons: `primary (#1d4ed8→#1e40af)`, `success`, `danger`, `purple`, `outline` + `sm/lg`, `disabled 0.5`, `min-h 44px` mobile
- Inputs/selects/search/filters: `.form-control` `1px #d1d5db` focus `primary + 3px rgba(37,99,235,.15)`, error `#dc2626`
- Badges: `badge-green/orange/red/blue/purple/gray` pill `999px`
- Alerts/toasts: `toast-success/error/info` bottom-right slideIn
- Cards: `.card` `radius 8 + shadow` + `.stat-card` left border status
- Tables: `thead #f9fafb 0.75rem uppercase`, `tbody hover #f9fafb`, `table-wrap` scroll
- Pagination: `.page-btn` + `.active` primary
- Modals: overlay `rgba(0,0,0,.5)` + sticky header/footer + bottom-sheet <768px
- Drawers/tabs/breadcrumbs/dropdowns/tooltips: future (not in current but specced for reports/analytics)
- Charts: `Chart.js` bar/doughnut/pie tokens (primary `#1d4ed8`, blue `#93c5fd`, green `#16a34a`, orange `#ea580c`, red `#dc2626`)
- Maps (future): MapLibre + PostGIS `ST_AsGeoJSON`, neutral basemap
- Timelines/activity feeds: for `auditlog` diff + `notifications` card list
- Empty `#empty` icon 2.5rem + “No …”, loading `spinnerHTML`+`loading-overlay`, error `⚠️` red text + toast — all three states per page.

---

## 8. Color System — Municipal

**Core:** primary `#1d4ed8` (trust), green `#16a34a` (cleanliness), purple `#7c3aed` (zone), light tints `*-l` for badges. Neutrals `gray-50→900`, white, sidebar `#111827`.

**Semantic tokens (not hardcoded per component):**

```
success:  #16a34a bg #dcfce7
warning:  #ea580c bg #fff7ed
danger:   #dc2626 bg #fee2e2
info:     #2563eb bg #eff6ff
neutral:  #6b7280 bg #f3f4f6
active:   #1d4ed8
disabled: #d1d5db on #f3f4f6 0.5 opacity
draft:    #374151 #f3f4f6 | submitted #2563eb #eff6ff
reviewed: #ea580c #fff7ed | approved #16a34a #dcfce7
```

All via `var(--green)` etc.; design tokens file `tokens.css` future.

---

## 9. Dark Mode — Evaluation

**Recommended: prepare tokens, do not ship yet.** Inverting `#111827→#f9fafb` would break status left-borders and chart legibility.

If implemented, semantic tokens:

```
background:      light #f9fafb → dark #0f172a
surface:         light #ffffff → dark #1e293b (cards, modals)
surface-raised:  light #ffffff → dark #334155
text-primary:    light #111827 → dark #f1f5f9
text-secondary:  light #6b7280 → dark #94a3b8
border:          light #e5e7eb → dark #334155
input-bg:        light #ffffff → dark #1e293b
chart-grid:      light #e5e7eb → dark #334155
map-basemap:     light neutral → dark “dark-matter”
```

Charts: swap `Chart.js` palette to high-contrast (e.g., `#22d3ee` for primary on dark). Maps: switch to dark basemap. Forms: `focus` ring stays primary. Requires `prefers-color-scheme` + `data-theme` toggle, not inversion.

**Decision:** Phase 2 defines tokens (`--bg`, `--surface`, `--text`, `--border`, `--chart-*`); Phase 3 (React) implements with `next-themes` if municipal ops need night-shift use.

---

## Next Steps (not in this phase)

Proof of concept `frontend-next/` (Next.js + Tailwind + `tokens.css` + `KebeleSelector` + `Dashboard` with city/kebele/zone contexts) only to validate architecture before full rewrite. No page implementations until Phase 3.

