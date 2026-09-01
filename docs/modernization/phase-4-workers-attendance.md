# Phase 4 — Workers, Attendance & Salary

> A complete migration of the Workers, Attendance, and Salary modules from the legacy Vanilla JS frontend (`frontend/js/pages/workers.js`) to the new Next.js frontend (`frontend-next`).

---

## A. Existing Worker Functionality (Audited)

The legacy `frontend/js/pages/workers.js` provided the following capabilities, all of which have been migrated or explicitly documented as deferred:

| # | Legacy capability | Status |
|---|---|---|
| 1 | List all workers (client-side) | Migrated — server-paginated table + mobile cards |
| 2 | Zone filter (All Zones / per-zone) | Migrated — server-side zone + kebele filter |
| 3 | Search workers | Migrated — server-side ILIKE search (debounced 300 ms) |
| 4 | Summary stats (Total / Active / Daily Wage Total) | Migrated — 4 StatCards with quarterly scope |
| 5 | Table: Name, Contact, Fayda/ID, Zone, Daily Wage, Status, Actions | Migrated — `DataTable` with identical columns |
| 6 | Row actions: View / Edit / Delete / ID Card / Attendance / Salary | Migrated — Lucide icon buttons (replacing emoji) |
| 7 | Add Worker modal | Migrated — `WorkerFormModal` with zod validation |
| 8 | Edit Worker modal | Migrated — same form, pre-filled, `isActive` toggle |
| 9 | Delete Worker (confirm dialog) | Migrated — `confirm()` gate → `api.deleteWorker()` → toast success + `refetchWorkers()` |
| 10 | Bulk Attendance modal | Migrated — `BulkAttendanceModal` (date + present/bonus per worker) |
| 11 | Per-worker Attendance detail | Migrated — `AttendanceModal` |
| 12 | Per-worker Salary / record payment | Migrated — `SalaryModal` + `SalaryPage` |
| 13 | Worker ID Card (tricolor, fayda barcode, custom attrs) | Migrated — `IdCardModal` (Lucide-branded) |
| 14 | Custom attributes (EAV key/value) | Migrated — preserved in form |
| 15 | Leader banner + zone scoping | Migrated |
| 16 | Collector (Kebele Admin) scoped to own kebele | Migrated — backend authority + UI lock |

**Deferred (not silently lost):**
- Legacy client-side row filtering replaced by server-side search (superset — returns fewer rows).
- Non-paginated legacy API response preserved for old `frontend/` + the salary summary query.

---

## B. Migrated Functionality

What was moved to Next.js (`frontend-next/src/app/(app)/operations/`):

- **Workers page** (`src/app/(app)/operations/workers/page.tsx`) — full roster with server pagination, search, zone/kebele/status filters, summary cards, DataTable (desktop) + WorkerCard (mobile), lazy-loaded modals.
- **Attendance page** (`src/app/(app)/operations/attendance/page.tsx`) — daily attendance by date/zone/kebele, summary cards, DataTable + `MobileAttendanceRow`, inline `BulkAttendanceModal`.
- **Salary page** (`src/app/(app)/operations/salary/page.tsx`) — payment history with client-side pagination, summary (total paid in ETB), `＋ Record Payment` modal, zone-based scoping.
- **Workers API service** (`src/features/workers/services/workers-api.ts`) — typed facade over `lib/api.ts` for workers, attendance, salary, zones, kebeles.
- **Domain types** (`src/types/domain.ts`) — strict TypeScript types for `Worker`, `SaferZone`, `Kebele`, `Attendance`, `Payment`, etc. (no `any`).
- **Shared UI primitives** — `DataTable`, `StatCard`, `Badge`/`StatusBadge`, `Modal`, `Drawer`, `Alert`, `Button`, `Input`, `Select`, `Textarea`, `WorkerCard`, `MobileAttendanceRow`.
- **Lazy-loaded dialogs** (`src/features/workers/components/worker-dialogs.tsx`) — `WorkerFormModal`, `BulkAttendanceModal`, `AttendanceModal`, `SalaryModal`, `IdCardModal`, `WorkerDetailsDrawer`.
- **Server state** — standard `fetch()` + local loading/error state; data refreshed via `refetchWorkers()` after mutations.

---

## C. Workers UX

### Page structure
```
Workers Management (h1)
├─ Subtitle: "Daily-wage roster — My Kebele / My Zone / City-wide"
├─ Toolbar (admin+collector+leader): [Bulk Attendance] [＋ Add Worker]
├─ Summary cards: Total | Active | Inactive | Daily Wage Total
├─ Reusable filter bar (role-aware):
│   ├─ Kebele   — admin: dropdown; collector: locked "My Kebele"; leader: none
│   ├─ Zone     — admin/collector: dropdown (leader: none)
│   ├─ Status   — All / Active / Inactive
│   └─ Search   — debounced 300 ms, placeholder "Name, phone, Fayda…"
├─ DataTable (desktop, ≥sm): Name | Contact | Fayda/ID | Zone | Daily Wage | Status | Actions
├─ WorkerCard list (mobile, <sm)
└─ Lazy-loaded modals (rendered on demand):
    WorkerFormModal | BulkAttendanceModal | AttendanceModal | SalaryModal
    | IdCardModal | WorkerDetailsDrawer
```

### Interactions
- **Server pagination** — 25 per page; `DataTable`/`WorkerCard` both reflect current page; page counter shown in filter bar.
- **Debounced search** — 300 ms; resets to page 1 on each keystroke.
- **Filter changes** — any filter change resets to page 1.
- **Add Worker** — opens `WorkerFormModal` (lazily loaded via `React.lazy` + `Suspense`); on save → `refetchWorkers()` invalidates the `["workers"]` query so the table refreshes.
- **Edit Worker** — same form pre-filled with existing data.
- **Delete Worker** — `confirm()` gate → `api.deleteWorker()` → toast success + `refetchWorkers()` + `refetchSummary()`.
- **View detail** — `WorkerDetailsDrawer` slides in from the right.
- **ID Card** — `IdCardModal` shows Lucide-branded card.
- **Attendance** — opens `AttendanceModal` for that worker.
- **Salary** — opens `SalaryModal` for that worker.

---

## D. Attendance UX

### Workflow
```
Attendance (h1)
├─ Subtitle: "Record and review daily attendance — My Kebele / My Zone / City-wide"
├─ Date picker (required, today default)
├─ Filters (role-aware): Kebele | Zone
├─ Summary cards: Present | Absent | Late | Not Recorded
├─ DataTable (desktop): Worker | Zone | Kebele | Status | Bonus | Recorded By
├─ MobileAttendanceRow cards (mobile, <sm)
└─ [Bulk Attendance] button (admin+collector+leader)
```

### Bulk Attendance flow
1. Click **[Bulk Attendance]** → opens `BulkAttendanceModal` (lazily loaded) listing all active workers.
2. Select a date (required).
3. **Desktop**: checkbox table (Present / Bonus per worker).
4. **Mobile**: one-handed PRESENT / ABSENT toggle buttons (48 px min-height, `aria-pressed`) + bonus input per worker.
5. Click **Save Attendance** → `api.bulkAttendance({ date, records })` → on success toast + refetch.

---

## E. Salary UX

### Workflow
```
Salary Payments (h1)
├─ Subtitle: "Worker salary history — My Kebele / My Zone / City-wide · ETB"
├─ [＋ Record Payment] button (admin+collector+leader)
├─ Summary cards: Records | Total Paid (ETB) | Scope
├─ Filters: Kebele | Zone | Search
├─ DataTable: Worker | Zone | Kebele | Amount | Paid At | Period | Paid By
└─ "Record Payment" modal:
    ├─ Worker (dropdown, restricted to scope)
    ├─ Amount (ETB) *
    ├─ Paid At *
    ├─ Period From / To
    ├─ Notes
    └─ [Record Payment] — backend validates worker_id/kebele/amount
```

### Payment recording
- `handlePay` validates worker, amount (> 0), and date client-side.
- Calls `workersApi.recordPayment(workerId, { amount, paidAt, periodFrom, periodTo, notes })`.
- Amount stored as `NUMERIC(10,2)` on backend; displayed via `formatETB` (integer cents).
- Backend enforces `workerBelongsToKebele` — a collector can only pay workers in their own kebele.

---

## F. Kebele Admin (Collector Role)

The `collector` role (displayed as **"Kebele Admin"** in the UI) is the most restricted privileged role. Own-kebele authorization is enforced at **three layers**:

1. **Backend authority (primary)** — `GET /api/workers` applies `WHERE k.id = $1` using the collector's resolved `kebele_id` (via `getCollectorKebeleId`). If no kebele is assigned, returns `[]` (or `{data:[],total:0,pages:0}` when paginated). All other workers API endpoints reject cross-kebele access with `403`.
2. **Zone filtering (client side)** — `visibleZones` is filtered to only zones whose `kebele_id` matches the collector's `kebeleId`.
3. **UI lock** — the Kebele dropdown is replaced with a locked read-only chip labeled **"My Kebele — locked"**; the collector cannot change it.

The collector can:
- View workers in their own kebele only.
- Add/edit/delete workers in their own kebele only (backend enforces).
- Record bulk attendance and salary payments for their own workers only.
- Filter by zone within their own kebele.

The collector **cannot**:
- See or access workers in other kebeles.
- Change the kebele filter.
- Access admin-only features (e.g., user management).

---

## G. 9-Kebele Support

The module works with the existing 9-kebele dataset (`K01`–`K09`) — no hardcoded IDs.

- `GET /kebeles` returns all 9 kebeles; the admin Kebele dropdown renders them from the API response (`Array.from(new Map(zones.map(...)))` derives unique kebele-name pairs).
- Each kebele has 12 zones → 108 zones total (`SaferZone` type: `kebele_id`, `leader_id`, `kebele_name`).
- The `zone_name` column in the workers table displays the safer-zone name via `Badge variant="purple"`.
- Collector scope resolves at runtime via `getCollectorKebeleId(userId)` — works for any of the 9 kebeles.
- All 9 kebeles are represented in the admin Kebele dropdown and the zone filter (which lists zones scoped to the selected kebele).

---

## H. Mobile Behavior

### Responsive strategy (desktop-first, mobile-overlay)
- **Desktop (≥ sm breakpoint)** — full `DataTable` with all columns and inline action buttons (View / Edit / ID / Attendance / Salary / Delete).
- **Mobile (< sm breakpoint)** — `DataTable` is hidden (`hidden sm:block`); a vertical stack of `WorkerCard` cards is shown instead (`space-y-3 sm:hidden`).

### WorkerCard (mobile)
- 44 px min-height touch targets for all action buttons.
- Layout: name + zone/kebele, then Fayda + Wage + Status lines, then a 3-column action grid (View | Edit | Attendance | ID | Salary | Delete).
- Admin sees the **Delete** button; non-admins see View/Edit/Attendance/ID/Salary only.

### MobileAttendanceRow
- **48 px minimum touch target** for PRESENT / ABSENT toggle buttons (`min-h-[48px] w-full`).
- `aria-pressed` reflects current state; `aria-label` describes the action (e.g., "Mark Abebe Bekele present").
- One-handed marking flow: tap PRESENT or ABSENT to toggle, optionally add a bonus.

### MobileBulkAttendanceModal
- Inside the bulk modal, mobile users see a card-per-worker layout with PRESENT/ABSENT toggles instead of the desktop checkbox table.

### Mobile navigation
- The sidebar/nav is accessible via keyboard (Tab + Enter) and touch; all links have accessible labels.

---

## I. Accessibility (WCAG 2.2 AA)

Implemented improvements:

| # | Improvement | Where |
|---|---|---|
| 1 | `aria-label` on all icon-only buttons (View, Edit, ID, Attendance, Salary, Delete, PRESENT, ABSENT, Bulk Attendance, Save) | workers page, attendance page, mobile rows |
| 2 | `aria-pressed` on toggle buttons (PRESENT/ABSENT, mobile attendance) | `MobileAttendanceRow`, `BulkAttendanceModal` mobile |
| 3 | `aria-invalid` + `aria-describedby` on form fields with validation errors | `WorkerFormModal` (fullName, dailyWage, faydaId) |
| 4 | `role="alert"` on validation error messages | `WorkerFormModal` |
| 5 | `<label htmlFor>` on all form inputs | workers/attendance/salary pages, bulk modal, pay modal |
| 6 | `aria-busy` / `aria-live="polite"` on loading states | `LoadingState` component |
| 7 | `role="alert"` on error states | `ErrorState` component |
| 8 | Keyboard-navigable DataTable actions | workers DataTable row actions |
| 9 | `min-h-[44px]` touch targets on all interactive elements (≥ 44×44) | `WorkerCard`, buttons |
| 10 | Semantic heading hierarchy (`h1` → `h3` → `p`) | all pages |
| 11 | Decorative icons `aria-hidden` | centralized `AppIcon` component |
| 12 | Focus-visible outlines via Tailwind | all interactive elements |

---

## J. Security

### Authorization handling
- **Frontend guards are UX only** — every authorization check is enforced authoritatively by the backend (`authenticate/requireRole`).
- Role matrix (displayed as):
  - **Admin** — full access (all workers, all kebeles, add/edit/delete, bulk attendance, salary).
  - **Kebele Admin (collector)** — scoped to own kebele; cannot see/modify other kebeles.
  - **Zone Leader** — scoped to their assigned zone(s); can add/edit/delete but cannot see other zones.
  - **Viewer** — read-only; no Add/Edit/Delete/Bulk Attendance/Record Payment buttons rendered.
- The legacy `x-session-token` header remains in use (future migration to `HttpOnly Secure SameSite` cookie documented in `docs/modernization/phase-3-session-security.md`).
- No sensitive token is rendered or logged in the UI or test output.
- Cross-kebele mutation attempts are rejected by the backend with `403` and surfaced as an `UnauthorizedState` / toast.
- The `ApiError` class preserves `status` and `code` for accurate error reporting.

---

## K. API Integration

### Endpoints consumed (all via `lib/api.ts`)

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/api/workers` (with `page`, `limit`, `search`, `status`, `kebeleId`, `zoneId`) | Workers page, Salary page |
| GET | `/api/safer-zones` | Workers page, Attendance page |
| GET | `/api/kebeles` | Workers page (admin filter) |
| POST | `/api/workers` | Workers page (Add Worker) |
| PUT | `/api/workers/:id` | Workers page (Edit Worker) |
| DELETE | `/api/workers/:id` | Workers page (Delete Worker) |
| GET | `/api/workers/:id/attendance` | AttendanceModal |
| GET | `/api/workers/:id/salary` | SalaryModal |
| POST | `/api/attendance/bulk` | BulkAttendanceModal |
| POST | `/api/salary/pay` | Salary page (Record Payment) |
| GET | `/api/auth/me` | `useAuth` |

### Endpoints changed (item 36)
- `GET /api/workers` — extended with optional `page`/`limit` (server pagination → `{data, total, page, pages}`), `search` (ILIKE), `status` (`active`/`inactive`), `kebeleId`, `zoneId`. **Backward-compatible:** when no pagination params are supplied, the legacy plain-array response is still returned. Authorization preserved in every branch.

### No new routes were created. No existing routes were rewritten.

---

## L. Tests

### Results (6 test files, 45 tests)

```
 Test Files  6 passed (6)
      Tests  45 passed (45)
```

| File | Tests | Coverage |
|---|---|---|
| `src/test/workers.test.tsx` | 13 | render, search, pagination, add/edit/delete, detail, kebele scoping, security |
| `src/test/attendance-salary.test.tsx` | 7 | render, bulk attendance, submission, unauthorized |
| `src/test/responsive.test.tsx` | 6 | form validation, mobile cards, mobile attendance a11y |
| `src/test/shell.test.tsx` | 10 | brand, nav, keyboard navigation |
| `src/test/login.test.tsx` | 6 | branding, validation, auth |
| `src/test/kebele.test.tsx` | 3 | kebele selector, role scoping |

### Backend tests (require Postgres/PostGIS)
- `backend/test/kebele-admin-workers.test.js` — includes **Test 10** (item 36): paginated envelope shape, collector pagination scoped to kebele, search ILIKE filtering, status filter, admin kebeleId filter, legacy plain-array response.
- These lint clean (0 errors) but require a reachable Postgres/PostGIS instance to execute (not runnable in this sandbox).

---

## M. Build

```
npm run lint     → 0 errors
npm run typecheck → 0 errors (tsc --noEmit)
npm run test     → 45 passed (6 files)
npm run build    → ok
```

---

## N. Legacy Frontend

**Confirmed intact.** The legacy Vanilla JS frontend at `frontend/` remains unchanged:
- `frontend/js/pages/workers.js` still present and functional.
- `frontend/index.html` hash router unchanged.
- `frontend/css/`, `frontend/js/`, `frontend/js/pages/` all untouched.
- No `frontend/` files were deleted, renamed, or modified in this Phase 4 commit.

The two frontends coexist: legacy at port 80 via nginx, new Next.js at port 3000 (dev) / 3001 (prod), sharing the same backend API at `http://127.0.0.1:5000/api`.

---

## O. Database

**Confirmed unchanged.** PostgreSQL/PostGIS was not modified in Phase 4:
- No schema files changed (`git diff 266c5fb -- database/` is empty).
- No new migrations created.
- No new tables or columns added.
- The pagination/search/filter logic lives entirely in the query layer (`SELECT ... FROM workers w LEFT JOIN safer_zones sz ...` with bounded `LIMIT/OFFSET`), reusing existing `custom_attributes`/EAV columns.

---

## P. Decision — No TanStack Query

Item 28 introduced TanStack Query (`@tanstack/react-query@5.102.8`) with `QueryClientProvider`, `useQuery`, `useMutation`, and `invalidateQueries` for the Workers page. This was committed as `57df772`, then **reverted** in the same phase.

**Rationale for reverting:**
1. The Workers page already uses `fetch()` + local state + `refetchWorkers()` after mutations — adding a second state-management layer introduced complexity without measurable benefit at current scale.
2. `QueryClientProvider` required a new `src/components/providers/index.tsx` and a `layout.tsx` wrapper, increasing the surface area of Phase 3's "minimal providers" constraint.
3. The existing `refetchWorkers()` / `refetchSummary()` pattern (called after every add/edit/delete) already provides fresh data, making cache invalidation redundant.
4. TanStack Query can be re-introduced in a later phase when server-state complexity justifies it (e.g., cross-page data sharing, optimistic updates, background sync).

**What was removed:**
- `@tanstack/react-query` from `package.json` / `package-lock.json`
- `src/components/providers/index.tsx` (QueryClientProvider wrapper)
- `QueryClientProvider` from `src/components/helpers.tsx`
- `useQuery` / `useMutation` / `invalidateQueries` calls from `workers/page.tsx`
- §3a from `phase-3-frontend-foundation.md`

**What was restored:**
- Workers page uses standard `fetch()` + local loading/error state
- `refetchWorkers()` / `refetchSummary()` called after mutations for data freshness
- `layout.tsx` renders `ToasterProvider` directly (no Providers wrapper)

---

## Q. Git

### Phase 4 commit

The current Phase 4 tip is: **`8587bc4`** (TanStack Query revert). The last feature commit before the revert was `05de766`.

```
8587bc4 revert: Phase 4 — remove TanStack Query server state (item 28 redone)
05de766 feat: Phase 4 — item 39 visual quality: remove emoji from new module, use centralized Lucide Icons
bab7565 feat: Phase 4 — test suite for module: workers/attendance/salary + responsive (35)
ad69268 feat: Phase 4 — performance: lazy-load heavy dialogs & memoization (34)
8a29f2f feat: Phase 4 — accessibility & security hardening for module (32-33)
e62ae45 feat: Phase 4 — cache invalidation, responsive worker cards, mobile attendance (29-31)
2bc2e9d feat: Phase 4 — Salary page, nav entry, type fixes & attendance cleanup (24-27)
7ea0b07 feat: Phase 4 — Workers API service + domain types + workers page service layer
a4e6b2a feat: Phase 4 — Attendance page with date/context/search/summary/table (20-23)
e943d6e feat: Phase 4 — Workers page enhancements (12-19)
bb9a637 feat: Phase 4 — Workers page redesign (6-11) with server pagination & summary
266c5fb feat: Phase 4 — Workers, Attendance & Salary migration to Next.js
```

> **Note:** Item 28 (TanStack Query) was committed as `57df772` then reverted — see §P for rationale. `8587bc4` removes it.
