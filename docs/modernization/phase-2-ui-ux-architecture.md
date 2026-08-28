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

## 10. Responsive Design

**Breakpoints:** `360` (small phone) → `480` (phone) → `768` (tablet) → `1024` (laptop) → `1280` (desktop). `main.css` already uses `768`/`480`/`900`; new tokens: `--bp-sm: 480px`, `--bp-md: 768px`, `--bp-lg: 1024px`, `--bp-xl: 1280px`.

**Desktop/laptop (≥1024):** sidebar `245px` + `main-wrap` + 4-col `stats-grid`, toolbar row, tables full, modal centered `560px`.

**Tablet (768–1023):** sidebar still fixed but `stats-grid 2-col`, `form-grid 1-col`, `table-wrap` horizontal scroll with sticky first col option, filters wrap.

**Android phones (<768):** not shrunk desktop — hamburger toggles `sidebar.open` (slide), `main-wrap padding-bottom 60px`, `mobile-bottom-nav` 5 primary actions (Dashboard, Inspections, Workers, Payments, Notifications) `flex` (existing `main.js:89`), `modal` → bottom sheet `max-h 85vh` with drag handle, `btn/form-control min-h 44px`, `stats-grid 1-col` at `480`, tables → card transform (see §12), forms single column, toolbar `flex-col`.

**Maps on small screens:** full-bleed `height 60vh`, floating search + layer button (not sidebar), collapsible legend/drawer, touch gestures (pinch, long-press), bottom `Detail panel` sheet.

---

## 11. Accessibility — WCAG 2.2 AA by Design

- **Keyboard:** tab order sidebar→top-bar→content, `focus` ring `3px rgba(37,99,235,.15)` on `form-control`/`btn`/`nav-link` (`:focus-visible`), modals trap focus, `Esc` closes.
- **Focus states:** defined in tokens, not browser default.
- **Contrast:** primary `#1d4ed8` on white `7.2:1`, text `111827` on `f9fafb` `15:1`, badges `*-l` backgrounds keep `4.5:1` text.
- **Semantic HTML:** `aside nav`, `header`, `main`, `table > thead/tbody th[scope]`, `form > label[for]`, `dialog[aria-modal]`.
- **Labels:** every `input/select` has `label`, icon buttons `aria-label` (e.g., hamburger “Menu”), `zone-badge` not icon-only.
- **Screen-reader:** `aria-live` toasts, `aria-busy` loading, `aria-sort` tables, status badges include text + icon (not color-only: `✓ Paid` vs `⏳ Pending`).
- **Errors:** inline `form-error` + `aria-describedby` + `aria-invalid`, toast for server errors, not color-only.
- **Touch:** `44px` min target (already `main.css:371`), spacing prevents mis-tap.
- **Reduced motion:** `@media (prefers-reduced-motion)` disables `slideIn 0.25s`/`spin 0.6s`/`transform` hover.
- **Non-color indicators:** status via badge text+icon+left-border, not left-border alone.

---

## 12. Data Table System — Reusable

Current pages implement tables independently (`paginate`+`filterTable` per page). Future: single `DataTable` component.

**Features:**
- Search (debounced 300ms, `filterTable` but server `?search=` for large sets), filtering (selects: kebele/type/status/month), sorting (click `th` → `?sort=&order=`), pagination (server `?page&limit=25`, `page-btn` + `limit` selector), column visibility (gear menu), export (CSV/Excel/PDF `format` param → `API.csvUrl`), row actions (edit/delete/view), bulk actions (checkbox + toolbar `Bulk Attendance`), loading skeleton, empty (icon + CTA), error (red + retry), mobile card.

**Mobile transformation:** <768px `table → card stack` — each row becomes card with `title` (name/business) + `2×2` field grid + `Actions` bottom row; hide low-priority cols via `priority` prop. `documents` already uses card grid — unify.

**Props:** `columns: {key,label,sortable,priority,render}`, `data`, `loading`, `emptyCTA`, `onSort`, `onPage`, `rowActions`, `bulkActions`.

---

## 13. Form System

**Architecture:** `Form` wrapper + `Field` + `useForm` hook (future React Hook Form + Zod matching backend `validate.js`).

**States:** `idle` → `validating` → `submitting` (btn `disabled` + spinner `Signing in…` as in `login.js`) → `success` (toast `Worker added` + close modal) / `error` (inline `form-error` + `toast` for server `err.code 23505→“Already exists”`). `disabled` propagates to all controls.

**Validation:** field (required `validateForm`, `validateFaydaId 12d`, Fayda `formatFaydaId`) + server Zod errors mapped to `form-error` per field, not toast-only.

**Confirmation:** `confirmDialog` for delete (`Delete this worker and all records?`), `review-modal` for state change.

**Unsaved:** `beforeunload` + modal “Discard changes?” if `dirty`, `Reset` link.

**Success feedback:** `toast` + row update + `leaderBanner` refresh. **Accessible errors:** `aria-describedby` links label→error, focus first invalid field.

Covers: workers (attrs builder), businesses (kebele→zone cascade), inspections (photos×10), payments (business→target prefill), reports, users (role, pw), tools.

---

## 14. GIS UI Foundation — Future (no build yet)

DB already: `kebeles.boundary MULTIPOLYGON`, `safer_zones.boundary MULTIPOLYGON`, `businesses/inspections/workers.location POINT` (SRID 4326) + GIST.

**Future components (designed, not implemented):**
- `CityMap` — base (MapLibre + OSM/Carto light), Kebele `MULTIPOLYGON` fills (color by achievement), Zone outlines, `LINESTRING` routes (future), `POINT` clusters (inspections/complaints/collection/hotspots/vehicles/workers) via `ST_AsGeoJSON`.
- Controls: `LayerControls` (checkboxes kebele/zone/route/points), `Search` (kebele/zone/business), `Filters` (status/date), `Legend` (status colors), `Popup` (on click: name+status+actions), `SelectedFeature` highlight, `DetailPanel` (bottom sheet mobile, side drawer desktop with full record + `View Details` link).

Operational, not decorative — e.g., tap hotspot → `Inspections` filtered list.

---

## 15. Mobile Field Workflow (future)

**Designed flow (no offline sync yet — just UX):**

```
Login → My Kebele / My Zone (auto-scoped) → Today's Tasks (inspections/reports due, absent alerts)
→ Worker / Inspection / Complaint card → Capture (fields + required photo/GPS if inspection)
→ Submit (toast + sync badge) → Sync (future offline queue)
```

Screens: `Today` (list of 3 alert types from `notifications`), `Capture` (form with `Photo / GPS where required` toggle, `form-control` touch-friendly), `Submit` (offline banner if queued). Offline capability defined as `IndexedDB queue + background sync` but **not implemented** — document only.

---

## 16. Notification System

**Architecture:** `in-app` card list (`notifications.js`) + bell `🔔` + badge poll 60s (`updateHeaderNotifBadge`).

**Types (existing 3 + future):** `overdue_payment` 💳, `pending_report` 📝, `absent_worker` 👷, (future) `inspection_reminder`, `payment_alert`, `complaint_update`, `system` 🔔.

**Severity:**

- `informational` — blue `badge-blue` (pending report)
- `warning` — orange `badge-orange` (pending inspection)
- `urgent` — red `badge-red` + `border-left 4px primary` + `notif-unread` bg `blue-l` (overdue)
- `success` — green `badge-green` (report approved)

Differentiated by badge+icon+left-border+priority sort (urgent top). Future push via poll/WebSocket (not yet).

---

## 17. Empty / Error / Loading / Success States

Every page already has 3; future standardizes.

- **Loading:** `skeleton` (stats: 4 gray blocks pulse, table: 5 rows `height 44px` + shimmer) or `loading-overlay` spinner (current `spinnerHTML`). `aria-busy`.
- **Empty:** `.empty` `icon 2.5rem` + title `No workers` + description `No businesses found` + primary CTA `+ Add Business` (role-gated). Current: `🏪 No businesses found`, `🔍 No inspections`, `📂 No documents` — keep.
- **Error:** red `⚠️ escapeHtml(err.message)` + `Retry` button (re-calls `loadData`) + toast, no stack. Network error → `Unable to connect to backend (…5000)`.
- **Success:** `toast` `✅ Worker added` + modal close + row inserted at top; zone report `submitted` badge change.

No blank white pages — `boot()` hashes to `landing` if unauthenticated.

---

## 18. Search — Unified Strategy (not built yet)

**UX:** global `⌘K` bar in `top-bar` (next to bell), placeholder `Search workers, businesses, zones…`. Debounced 300ms, min 2 chars, grouped results: `Workers (3) / Businesses (2) / Kebeles / Zones / Inspections / Reports` with `Rank` by relevance: exact name > owner > zone match > notes. Keyboard `↑↓` + `Enter` → detail. Scoped by role (Leader only sees their zone results). History/recent.

Ranking kept server-side `ILike %q%` + `priority` weight; future `pg_trgm` GIN not needed yet. Define only.

---

## 19. Mobile Navigation

Not desktop sidebar shrunk. <768px: `sidebar` hidden → `hamburger` toggles slide `translateX`; primary field actions in `mobile-bottom-nav` (Dashboard, Inspections, Workers, Payments, Alerts) — existing 5 matches most frequent ops per audit. Secondary navigation via `More` drawer (Tools, Reports, Documents, Settings). Auth pages full-width, landing hamburger. Priority: 1-tap to `Today's Tasks` / `Add Inspection` / `Mark Attendance`.

---

## 20. Page Inventory — Future (every major existing module)

| Page | Roles | Purpose | Major Components | Primary Actions | Data Displayed | Filters | GIS | Mobile |
|---|---|---|---|---|---|---|---|| **Dashboard** | all (scoped) | operational decisions city/kebele/zone | `KebeleSelector` locked/auto, 4 stats, progress bar, `ChartBar/Doughnut/Pie`, `Leaderboard` table, `Kebele Breakdown` | — (read) + drill-through to kebele | collected/pending/overdue/attendance, monthly rev 12m, methods, inspection dist, rank score `0.6*rev+0.4*att`, target/collected/% | `year/month` forced for Kebele Admin | card click → future `KebeleMap` | stats 4→1, charts stack, table→cards |
| **Workers** | admin/collector/leader | manage daily-wage roster per zone/kebele | search+zone filter toolbar, 3 stats, `DataTable` + `worker-modal` (fayda 12d, zone cascade), `ID Card` | `+ Add`, ✏️ edit, 🪪 card/print, 📅 attendance, 💰 salary, 🗑 delete, `Bulk Attendance` | `Name/Contact/Fayda/Zone/Wage/Status` 25pp, wage sum | zone, search, `is_active` | worker `POINT` cluster future | table→cards, bulk grid scroll, 44px inputs |
| **Attendance** | admin/collector/leader | mark present/bonus daily | same workers list + `attend-modal` date+checkbox grid | mark present/bonus → `bulkAttendance` | `Worker/Zone/Wage/Present/Bonus` per date, worker history `Present/Absent/Gross` | `date`, `zone` | — | checkbox full-width, date picker bottom sheet |
| **Inspections** | admin/collector/leader | field cleanliness checks+photos+GPS | filters, `DataTable`, `insp-modal` photos×10, `photos-modal` | `+ Add`, ✏️, 🗑, delete photo | `Date/Kebele/Zone/Status/Inspector/Photos/Notes` | kebele, status, from/to, search | `POINT` pin per inspection → `CityMap` popup | form single col, gallery swipe |
| **Zone Reports** | admin/collector/leader | monthly `draft→submitted→reviewed→approved` | `KebeleSelector`+month/year/status/zone filters, `DataTable`, `zr-modal`+`review-modal`+detail | `+ New` (leader), `Submit`, `Mark Reviewed`, `Approve`, ✏️ (draft), 👁 view | `Zone/Kebele/Period/Leader/Status/Workers/Collection/Reviewed` | month/year/status/zone | zone `MULTIPOLYGON` highlight | actions collapse to ⋯ |
| **Businesses** | all; mut admin/collector/leader | registry for fee collection | kebele→zone cascade filter, `DataTable`+`biz-modal`+`pay-quick-modal` | `+ Add`, ✏️, 🗑, `Pay` | 11 types, target `fmtETB`, active/inactive | kebele, type, search | business `POINT` future | card grid already mobile-ready |
| **Payments** | admin/collector/leader | collections + telebirr/cbebirr | kebele/month/year/status filters, 3 sums, `DataTable`, `pay-modal`+`gateway-modal` QR poll+`receipt-modal` | `+ Record`, 🧾 view receipt, 🗑 delete (admin), CSV | `Receipt/Business/Zone/Kebele/Amount/Method/Status/Period/PaidAt/Collector` | kebele/month/year/status/search | — | filters wrap, QR full-width |
| **Tools & Equipment** | admin/collector/leader | inventory per zone | zone+category filters, 4 stats, `DataTable`+`tool-modal` | `+ Add`, ✏️, 🗑 | goods by condition, qty sum | zone, category, search | — | stats 2+2→1 |
| **Reports** | admin/collector/viewer (no leader) | exports for audits | params per card, `DataTable`s + `report-chart` bar | `Load`+`CSV/XLSX/PDF`, `Download Package .xlsx`, Print | payment yearly/monthly, worker payroll, inspection from/to, monthly-summary | report-specific | — | print hides nav |
| **Analytics** | admin/collector (new split) | trends | same as reports but `Chart.js` trends | filters | attendance/payment/inspection zone trends | year/month | kebele choropleth future | charts responsive 260px |
| **Kebeles** | admin (view all), Kebele Admin (own) | 9 kebeles + collector | `KebeleSummaryCard` grid 3×3, table `Kebele/Zones/Collector` | Save collector `PUT /kebeles/:id` | zones count badge, collector select | — | boundary `MULTIPOLYGON` | grid 1-col |
| **Safer Zones** | admin (view all), Kebele Admin (own kebele) | 108 zones + leader | `KebeleSelector`+zone table, `add-zone-modal` | `+ Add Zone`, Save leader, 🗑 delete | `Zone/Kebele/Leader` badge | kebele, search | boundary `MULTIPOLYGON` outlines | table→cards |
| **Documents** | all; upload admin/collector/leader | contracts/photos/training | cat tabs, search+zone filter, card grid, `upload-doc-modal` | `Upload`, ⬇ download auth, 🗑 delete | 6 cats, image preview 120px, file+size, uploader+date | cat, search, zone | — | grid `280px` min |
| **Notifications** | all | alerts | `Mark All Read`+`Trigger Scan` toolbar, filter, card list + bell badge poll | `Mark Read`, `Delete`, mark-all, generate | icon by type `💳/📝/👷/🔔`, `New` badge | All/Unread/Read | — | cards full-width |
| **Users** | admin | 4 roles + fayda | role filter+search, `DataTable`+`user-modal`+`pw-modal` | `+ Add`, ✏️, 🔑 pw, 🗑 delete | `Username/FullName/Phone/Fayda/Role/Zone/Status` leader `badge-purple` zone | role, search | — | table→cards |
| **Audit Logs** | admin | append-only trail | entity/action/date filters, `DataTable`+diff pre `safeJsonDisplay` | `View Diff` | `Timestamp/User/Action/Entity/IP/Details` + `old→new` JSON | entity, action, from/to | — | filters stack, diff stacked |
| **Settings/My Account** | all (admin = system, others = pw) | password (+ system future) | password form `my-pw-*` | `Update Password` (8+letter+number) | current user only | — | — | 480px centered |

Future `GIS Map`, `Routes`, `Tasks/Complaints` shown as placeholders in nav but detailed in §14-15.

---

## 21. Frontend Technology Decision

**Current:** Vanilla JS SPA (hash router, `api.js` 3.5KB, `utils.js` 166 lines). Maintainable for 14 pages but no component reuse, no code-splitting, global `PAGES` map, emoji icon inconsistency, tests only backend.

**Evaluation:**

| Criterion | Vanilla JS (keep) | React/Next.js |
|---|---|---|
| Maintainability | low — copy-paste `paginate`/`buildModal` per page, no types | high — typed `features/workers/components/`, hooks, reuse `DataTable`/`Form` |
| Performance | small bundle but no split, all pages loaded via single `index.html` | route-level code-splitting, lazy modals, `next/image` |
| Component reuse | low | high — `KebeleSelector`, `StatusBadge`, `ChartCard` shared |
| Mobile | manual media queries, `mobile-bottom-nav` hand-rolled | `next` + Tailwind responsive, proven patterns |
| A11y | manual `aria-*` per page | headless `Radix` + `react-aria` + lint |
| GIS | would inject MapLibre imperatively | `react-map-gl` declarative layers tied to PostGIS `ST_AsGeoJSON` |
| Testing | none frontend | `Vitest`+`RTL`+`Playwright` per feature |
| Productivity | low onboarding, but scaling pain | municipal long-term: hiring, docs, types |

**Recommendation:** **Next.js 14 (App Router) + TypeScript** (not generic React CSR).

- **Why:** Municipal platform lives 5-10y, needs typed contracts with `backend/services`, file-based routing matches §4 navigation, SSR for `landing`/`public stats` SEO, image optimization, API routes for `ST_AsGeoJSON` proxy, future PWA offline easily via `next-pwa`.
- **Routing:** `app/(public)/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/operations/workers/page.tsx` etc. mirroring §4 hierarchy; `middleware.ts` for `x-session-token` check.
- **State:** server state via **TanStack Query** (`useQuery` for `getWorkers`, `getPayments`, cache + dedupe + poll `notifications` 60s), client UI state via `zustand` (`KebeleSelector`, filters). No Redux needed.
- **Data fetching:** `lib/api.ts` typed wrapper around existing `api.js` contracts (`BASE /api`), `useQuery` + `queryKey: ['workers', {kebeleId, zoneId, page}]`.
- **Forms:** `React Hook Form` + `zod` (same schemas as `backend/middleware/schemas.js`) — `validateFaydaId`, `onSubmit` → `mutation` → `toast` + `invalidateQueries`.
- **Components:** `components/ui` (Button/Input/Badge/Card/Table/Modal/Drawer — `shadcn/ui` on Radix), `features/{workers,businesses,…}/components`, `layouts/Shell` (sidebar 245px + top-bar + bottom-nav), `lib/hooks/useRole`, `services/api`.
- **Auth:** `services/auth.ts` stores `ddcms_token`/`ddcms_user` in `localStorage` (keep current) + `httpOnly` future; `authenticate` middleware contract unchanged; `hasRole` → `useRole()`.
- **GIS:** `react-map-gl` + `MapLibre` + `lib/geo.ts` `ST_AsGeoJSON` → `GeoJSON` layers (kebele fills, zone outlines, POINT clusters), `LayerControls` as React state.

**Do not migrate yet** — validate with `frontend-next/` proof (shell + tokens + dashboard).

---

## 22. Frontend Architecture

```
frontend-next/
 app/
  (public)/landing/page.tsx  login/page.tsx
  (app)/layout.tsx           // Shell: Sidebar + TopBar + BottomNav + Toaster
         dashboard/page.tsx
         operations/{workers,attendance,inspections,zone-reports}/page.tsx
         locations/{kebeles,safer-zones,map}/page.tsx
         businesses/page.tsx  finance/payments/page.tsx
         community/notifications/page.tsx
         reports/page.tsx  analytics/page.tsx
         admin/{users,tools,documents,audit-logs}/page.tsx
         settings/page.tsx
 components/
  ui/          // Button, Input, Select, Badge, Card, Table/DataTable, Modal, Drawer, Tabs, Breadcrumbs
  layout/      // Sidebar, TopBar, BottomNav, KebeleSelector, Breadcrumbs
  gis/         // CityMap, LayerControls, Legend, Popup
 features/
  workers/     // components/WorkerTable, WorkerForm, hooks/useWorkers, services/workers.api
  businesses/ …
  … (one folder per domain: mirrors backend/routes)
 layouts/      // Shell layout, AuthLayout
 lib/
  api.ts       // typed fetch + BASE + x-session-token
  auth.ts      // getToken/getUser/hasRole
  geo.ts       // ST_AsGeoJSON helpers
  tokens.ts    // design tokens re-export
  utils.ts     // escapeHtml already server-side
 hooks/        // useRole, useKebele, usePagination
 services/     // per-entity API (or auto-gen from backend)
 types/        // User, Kebele, SaferZone, Worker, Business, Payment (from backend)
 styles/
  tokens.css   // §23
  globals.css  // Tailwind base
```

Boundaries: `ui` no business logic; `features/*` own logic + `services/*` API + `hooks/*` state; `lib/api` is sole fetch layer; `auth` guards `app/(app)`; `gis` isolated via `lib/geo`; `DataTable`/`Form` generic in `ui`.

---

## 23. Design Tokens — Central Control

`styles/tokens.css` is source of truth — no `hardcode #1d4ed8` per component.

```css
:root {
 /* colors (municipal) */
 --primary: #1d4ed8; --primary-d: #1e40af; --primary-l: #eff6ff;
 --green: #16a34a; --green-l: #dcfce7; --orange: #ea580c; --orange-l: #fff7ed;
 --red: #dc2626; --red-l: #fee2e2; --purple: #7c3aed; --purple-l: #ede9fe;
 --gray-50:#f9fafb; --gray-100:#f3f4f6; --gray-200:#e5e7eb; --gray-300:#d1d5db;
 --gray-500:#6b7280; --gray-700:#374151; --gray-900:#111827; --white:#fff;
 /* semantic */
 --success:#16a34a; --warning:#ea580c; --danger:#dc2626; --info:#2563eb;
 --bg:#f9fafb; --surface:#fff; --text:#111827; --text-muted:#6b7280; --border:#e5e7eb;
 /* typography */
 --font: Inter, 'Segoe UI', system-ui, sans-serif; --text-base:15px; --leading:1.5;
 --h-hero:2.6rem 800; --h-section:1.9rem 800; --h-card:0.95rem 600;
 --label:0.75rem 500 uppercase 0.05em;
 /* spacing 4-64 */
 --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px; --s-8:32px; --s-12:48px; --s-16:64px;
 /* radii */
 --r-sm:6px; --r-md:8px; --r-lg:12px; --r-pill:999px;
 /* shadows */
 --shadow:0 1px 3px rgba(0,0,0,.12); --shadow-md:0 4px 6px rgba(0,0,0,.1);
 /* breakpoints */
 --bp-sm:480px; --bp-md:768px; --bp-lg:1024px; --bp-xl:1280px;
 /* transitions */
 --ease:.15s ease; --ease-modal:.25s ease; --spin:.6s linear infinite;
 /* z-index layers */
 --z-sidebar:100; --z-topbar:50; --z-bottomnav:400; --z-modal:500; --z-toast:1000;
}
```

Future dark mode swaps `bg/surface/text/border` via `data-theme="dark"` (see §9).

---

## 24. UI Security — Permission-Aware States

Backend is authoritative (`backend/middleware/auth.js` + per-route `leader_id`/`kebele_id`). Frontend hides/disables for UX, never for security.

| State | Mean | Example |
|---|---|---|
| **visible** | allowed for role | Admin sees `+ Add User`, Leader sees `+ Add Inspection` |
| **disabled** | allowed but not now (needs context) | `Save` disabled until `validateForm` passes; Leader’s `Zone` select disabled with value set |
| **hidden** | not allowed for role | Viewer no `+ Add` buttons, Leader no `Reports` nav, non-admin no `Audit Log` |
| **read-only** | data visible, no mutate | Viewer sees `Businesses` table but `Actions` column hidden, payments `Update` hidden for Leader |

Patterns: nav filtered `NAV.filter(n=>n.roles.includes(role))` (current `main.js:34`), toolbar `canEdit=hasRole(...)`, table `Actions if canEdit`, modal fields `readonly` if edit. Guard pages `if (!hasRole) renderGuard("Access restricted")`.

---

## 25. Performance — Designed, Not Premature

- **Code splitting:** Next.js route-level (`app/operations/workers/page.tsx` chunk), modal lazy (`dynamic(() => import(...))`).
- **Pagination:** server `?page&limit=25` already; `DataTable` keeps `limit` selector, `prefetch` next page via TanStack Query.
- **Virtualized:** only `attendance` bulk grid (>100 workers) uses `react-virtual` window; others unnecessary (<500 rows).
- **Images:** `next/image` for `documents` previews + inspection thumbs (80→160), `photo-thumb` lazy.
- **Map layers:** `ST_AsGeoJSON` simplified (`ST_Simplify`) + cluster `POINT` + tile on demand, not all 108 zones at once.
- **Caching/dedupe:** TanStack `staleTime 60s` for `notifications` poll, `GET /kebeles` singleton, `GET /safer-zones?kebeleId` keyed.
- **Optimistic UI:** only safe `markNotifRead` (revert on error); payments/reports never optimistic.
- **JS budget:** `api.js 3.5KB → lib/api.ts` tree-shakable, `Chart.js` dynamic import per dashboard, no `lodash`.
- **Mobile network:** `page limit 20` on notifications vs 25 elsewhere, `debounce 300ms` search, `compress` photos before upload (max 5MB).

---

## 26. Implementation Plan

**Order (adapted to actual app):**

1. **Design tokens** `tokens.css` + Tailwind config
2. **Application shell** `app/(app)/layout.tsx` (Sidebar 245px, TopBar, BottomNav, `KebeleSelector`, `updateHeaderNotifBadge` → Query)
3. **Authentication** `login/page.tsx` + `landing` + `middleware`
4. **Navigation** role-filtered `NAV` + `hasRole` + mobile drawer
5. **Dashboard** city/kebele/zone contexts + 9-kebele overview + 3 charts
6. **Reusable** `DataTable` + `Form` + `Badge`/`Modal`/`Toast`
7. **Workers** (roster + ID card) → **Attendance** (bulk) → **Salary**
8. **Businesses** (kebele→zone cascade)
9. **Inspections** (photos×10 + gallery)
10. **Payments** (QR + receipt) → **Finance**
11. **Zone Reports** workflow (draft→approved)
12. **Kebele/Safer Zone management** (ex-settings)
13. **GIS** `CityMap` layers (PostGIS)
14. **Documents/Notifications/Audit/Users**
15. **Reports/Analytics** exports
16. **Mobile optimization** skeletons, bottom sheets, 44px pass

Proof `frontend-next/` validates tokens+shell+dashboard before steps 6–16.

---

## 27. Documentation & Diagrams

Primary: this file `docs/modernization/phase-2-ui-ux-architecture.md` (also `phase-2-ui-architecture.md` legacy name).  
Supporting: `docs/modernization/phase-1-postgresql-postgis.md` (DB), `docs/migration/POSTGRES_MIGRATION.md` (flow).

**If useful, diagrams in `docs/modernization/diagrams/`:**

- `ia-9-kebele.mmd` (`Dire Dawa → 9 Kebeles → 108 Zones → Ops`)
- `nav-structure.mmd` (§4 tree)
- `dashboard-contexts.mmd` (Admin/Kebele Admin/Leader scopes)
- `gis-layers.mmd` (`CityMap` layers stack)

No code generation yet — diagrams are hand-authored Mermaid for review.

---

## Next Steps (not in this phase)

