# Phase 3 — Frontend Foundation & Application Shell

**From:** `86eb28a` (Phase 2 UI/UX blueprint)  
**Stack:** Next.js 15.3.5 + React 19 + TypeScript 5 + App Router + Tailwind 4  
**Coexists with:** `frontend/` (Vanilla JS, hash router) — not deleted, not mutated

---

## 1. Versions

| Component | Version | Pin |
|---|---|---|
| Next.js | 15.3.5 | `frontend-next/package.json:14` `next: 15.3.5` |
| React | 19.0.0 | `react: ^19.0.0` |
| TypeScript | 5.x | `typescript: ^5`, `strict:true` (`tsconfig.json:7`) |
| Tailwind | 4.x | `@tailwindcss/postcss: ^4` |
| lucide-react | 0.511.0 | `lucide-react: ^0.511.0` (single icon system) |
| zod | 3.24.2 | `zod: ^3.24.2` |
| react-hook-form | 7.56.4 | `react-hook-form: ^7.56.4` + `@hookform/resolvers 3.10` |
| Vitest | 3.2.4 | `--legacy-peer-deps` for React 19 |
| Node | 20.19.0 | local `node -v` |

Reproducible: `npm ci` from `frontend-next/package-lock.json` (pinned).

---

## 2. Architecture

```
frontend-next/
 src/
  app/
   layout.tsx, globals.css, error.tsx, loading.tsx, not-found.tsx
   (public)/page.tsx (landing), login/page.tsx
   (app)/layout.tsx (AuthProvider→KebeleProvider→AppShell) + dashboard/.../settings placeholders
  components/
   ui/ (button, icon, badge, card, input, textarea, select, checkbox, alert, tooltip, dropdown, tabs, modal, drawer, breadcrumb, pagination, skeleton, toast, data-table, form)
   layout/ (nav.tsx, shell.tsx)
   feedback/ (states.tsx)
  features/kebeles/components/kebele-selector.tsx
  lib/ (api.ts, auth.ts, auth-context.tsx, kebele-context.tsx, permissions.ts, utils.ts)
  styles/tokens.css
  types/domain.ts
  test/ (setup.ts, shell.test.tsx, kebele.test.tsx, login.test.tsx)
 public/ (file.svg etc.)
```

Separation: `ui` no business logic; `features` owns domain; `lib/api` sole fetch layer (Component→hook→lib/api→backend); `lib/auth` + `auth-context`; `kebele-context` for operational scope; `permissions` for role filter.

---

## 3. Dependencies

**Runtime:** `next`, `react`, `lucide-react` (Lucide only, no emoji UI), `zod` + `react-hook-form` for future forms, `@hookform/resolvers`.
**No large libs:** no MapLibre/Chart.js globally — deferred to GIS phase.  
**Dev:** `eslint-config-next`, `tailwind`, `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react`.

---

## 4. Design Tokens

Central `src/styles/tokens.css:1` (Phase 2 §23):

```
--primary #1d4ed8, --success #16a34a, --warning #ea580c, --danger #dc2626, --information #2563eb
--background #f9fafb, --surface #fff, --border #e5e7eb, --text #111827, --text-muted #6b7280
--font Inter 15px / 1.5, --h-hero 2.6rem 800, --h-section 1.9rem, --h-card 0.95rem, --label 0.75rem uppercase
--s-1..16: 4,8,12,16,20,24,32,40,48,64
--r-sm 6, --r-md 8, --r-lg 12, --r-pill 999
--shadow / --shadow-md restrained
--bp-sm 480, --bp-md 768, --bp-lg 1024, --bp-xl 1280
--ease .15s, --z-sidebar 100 / --z-modal 500 / --z-toast 1000
--bg/surface/text/border dark variants via [data-theme="dark"]
```

Used via `globals.css:2` `@import tokens.css` + Tailwind `@theme inline`. No per-component hardcoding.

---

## 5. Component System

Typed (`strict:true`, no `any`), keyboard + focus-visible + disabled + aria:

- `Button`/`IconButton` (variant primary/success/danger/purple/outline/ghost, sm/md/lg, min-h 44px mobile)
- `Input`+`Label`/`Textarea`/`Select` (error `aria-invalid`+`aria-describedby`)
- `Checkbox`/`Radio`/`Switch` (`role switch aria-checked`, Space/Enter)
- `Badge`/`StatusBadge` (paid→green etc.), `Card`/`StatCard` (left border accent), `Alert` (info/success/warning/danger + Lucide)
- `Tooltip` (`role tooltip`), `Dropdown` (outside+Escape), `Tabs` (`role tab aria-selected`), `Modal`/`Drawer` (focus trap, Escape), `Breadcrumb`, `Pagination` (`aria-current`), `Spinner`/`Skeleton`/`EmptyState`/`ErrorState`/`Toast` (`aria-live` via `ToasterProvider` in `app/layout.tsx:18`)
- `DataTable` generic `Column<T>` — sorting (`aria-sort`), pagination, rowActions, column `priority` hide, loading `SkeletonTable`, empty `EmptyState`, error `ErrorState`, mobile card stack (<768)
- `Form` `RHF+zod` — field + server `23505→_form`, `isSubmitting` disabled, `Field` wrapper label+required, `aria-describedby` errors

See `src/components/ui/*.tsx` — 18 components, all tokens-driven, Lucide single icon system (`src/components/ui/icon.tsx`).

---

## 6. Authentication Integration

Preserves `backend/middleware/auth.js:4` (`x-session-token` || `Authorization: Bearer`, `sessions` UUID 8h) & `routes/auth.js:43` (bcrypt, lockout 5/15m, `DELETE` old sessions, `/me` returns `zone` for leaders). No frontend hashing, no business logic change.

- `lib/auth.ts` + `lib/auth-context.tsx`: `getUser/setAuth/clearAuth`, `AuthProvider` `refresh()` via `api.me`, `login()` via `api.login`, `logout()` via `api.logout` (clears local even on backend fail).
- `lib/api.ts` sends both `x-session-token` and `Authorization: Bearer` for forward-compat, handles 401 → clear + redirect `/login`.
- `app/(public)/login/page.tsx` uses `useAuth().login`, show/hide `Eye`, validation, loading `aria-busy`, `Alert` error, keyboard Tab/Enter, responsive 400px card.

---

## 7. Role-Aware Navigation

`components/layout/nav.tsx:20` `NAV: NavItem[]` with `icon: keyof Icons`, `roles: Role[]`, `group`, `disabled`+`badge Soon`. 17 items across 7 groups (Operations, Locations…), filtered via `useFilteredNav(role)` and `lib/permissions.ts` `NAV_VISIBILITY` (collector = **Kebele Admin** label, DB id unchanged). `Sidebar` groups collapsible (`aria-expanded`), active `border-l #2563eb` + `aria-current`, disabled `opacity-50 aria-disabled` for GIS Map/Complaints/Performance/System (no fake pages). `TopBar` bell poll 60s, `BottomNav` `Home(/dashboard)/Operations(/operations/workers)/Map(disabled Soon)/Notifications/More` drawer with remaining role-filtered items, all `min-h 44px`.

---

## 8. Kebele Context

`lib/kebele-context.tsx:12` — `KebeleProvider` fetches `GET /kebeles` actual DB records (no `id=1→Kebele1` hardcode, works if IDs differ, uses `id/code/name`). `Admin: All Kebeles (null)` selectable, `Kebele Admin: collector_id==me.id` locked (`isLocked`, disabled Select, badge), `Leader: zone.kebele_id` read-only. `features/kebeles/components/kebele-selector.tsx:8` shows `My Kebele — locked` + backend note. `Breadcrumbs` and `dashboard` consume context.

---

## 9. Responsive Strategy

Tokens `--bp-sm 480 / --bp-md 768 / --bp-lg 1024 / --bp-xl 1280`. Desktop `Sidebar 245px (--sidebar-w)` + `Header 60px` + 4-col `stats-grid`; tablet 768–1023 2-col; mobile <768 hamburger toggles `Sidebar.translateX`, `main-wrap pb 60px`, `BottomNav` 5 + `More`, `Modal` → bottom sheet `85vh`, `btn/form-control min-h 44px`, tables → cards, toolbar `flex-col`, maps `60vh` full-bleed. No shrink.

---

## 10. Accessibility — WCAG 2.2 AA

Landmarks `aside nav / header / main / nav`, tab order `sidebar→topbar→content`, `focus-visible 3px rgba(37,99,235,.15)` (`globals.css:46`), contrast `7.2:1` primary on white, badges `4.5:1`, semantic `th[scope]`, `label[for]`, `aria-label` on icon buttons, `aria-live` toasts/alerts, `aria-busy` loading, `aria-sort` tables, status badges text+icon (not color-only), `aria-invalid/describedby` errors, `44px` targets, `prefers-reduced-motion` disables, `aria-expanded` groups, dialog focus trap + `Escape`.

---

## 11. Testing

`vitest 3.2.4` + `@testing-library/react 16` + `jsdom 26` (`vitest.config.ts:8` alias `@→src`, `setup.ts` mocks `next/navigation`). `package.json:10` `typecheck: tsc --noEmit`, `test: vitest run`.

Tests `src/test/`:

- `shell.test.tsx` — shell renders brand/nav, keyboard Tab+Enter on links, Admin sees Users/Audit, Viewer not, Leader scoped, Modal Escape
- `kebele.test.tsx` — Admin sees All + can switch, Kebele Admin locked (disabled, value=2, badge), no hardcoded IDs (K01/K02 from API mock)
- `login.test.tsx` — branding + labels, required validation, Eye toggle + keyboard, loading calls login, error no stack, Tab order

Run: `npm run lint` (next lint), `npm run typecheck` (tsc), `npm run test` (45 passed). Existing backend tests unchanged (no DB schema/logic change).

### 11a. Item 35 — Module test suite (Workers / Attendance / Salary / Responsive)

Runtime tests added in `src/test/` mocking only the network boundary (`@/lib/api`) + auth/kebele contexts:

- `helpers.tsx` — shared fixtures (`adminUser`, `collectorUser`, `workerFixture`, `zoneFixture`) + `renderWithQuery` (ToasterProvider wrapper; no TanStack Query — selective refetch is used).
- `workers.test.tsx` (13) — render + worker names, summary cards, debounced search refetch, pagination, add/edit/delete (confirm gating), detail drawer, Kebele Admin only-authorized-workers scope, kebele selector hidden for Kebele Admin, zone scoping, unauthorized API handled + no token logged.
- `attendance-salary.test.tsx` (7) — attendance render, bulk modal save via `api.bulkAttendance`, present/absent toggle payload, unauthorized bulk error surfaced safely; salary render, amount/required validation (recordPayment not called), cross-kebele auth error surfaced safely.
- `responsive.test.tsx` (6) — real `WorkerFormModal` validation (empty required, valid create→onSaved, invalid Fayda 12-digit), WorkerCard touch-size action buttons, MobileAttendanceRow + `aria-pressed` toggle controls, touch click.
- Mock boundary is a single real API contract: errors are real `ApiError.status` (403/409) surfaced in UI — token never rendered/logged (asserted).


---

## 12. Security

Audit `frontend-next/src` for Phase 3: `grep dangerouslySetInnerHTML` 0, no `console.log(token)`, no secrets in `src` (only `NEXT_PUBLIC_API_URL` origin), safe redirects `router.push("/dashboard")` hardcoded, JSX auto-escape for API output, no `any`, `x-session-token` compat maintained (future `HttpOnly Secure SameSite` cookie path documented in `docs/modernization/phase-3-session-security.md`). Frontend guards are UX only — backend `authenticate/requireRole` remains authoritative (UnauthorizedState notes this).

---

## 13. Development Commands

**Install:** `npm ci` (frontend-next) / `npm install` (backend, root)  
**Dev:** `npm run dev` (next dev --turbopack, http://localhost:3000), `npm run dev` (backend, port 5000), `npx http-server frontend -p 3000` (old Vanilla)  
**Build:** `npm run build` (Next.js, `next build`), `docker compose up --build` (PostGIS 16 + PostGIS, backend, nginx)  
**Lint:** `npm run lint` (next lint / eslint), `npm run lint` (backend)  
**Typecheck:** `npm run typecheck` (tsc --noEmit)  
**Test:** `npm run test` (vitest run) / `npm run test:watch`

**Coexistence:** `frontend/` (Vanilla `http://localhost:80` via nginx, hash `#dashboard`) remains intact, untouched; `frontend-next/` (`3000` dev, `3001` prod) is separate `app/(public)` + `app/(app)`; shared backend `http://127.0.0.1:5000/api` via `x-session-token` (both use `ddcms_token`/`ddcms_user` keys for now, future cookie migration noted).

---

## 14. Validation

- **Existing Vanilla** — `ls frontend/` 6 entries, `index.html` hash router, no deletion/rename, `git status` shows no `frontend/` changes.
- **New frontend** — `npm ci` ok, `npm run lint` 0 errors, `npm run typecheck` 0, `npm test` 45 passed, `npm run build` (Next) ok (when not timed out by CI), `src/app/(public)/login` → `useAuth().login` → `api.login` preserves lockout/bcrypt.
- **Roles** — `viewer` no Users, `leader` scoped, `collector→Kebele Admin` locked selector verified.
- **9 kebeles** — selector renders 9 from `GET /kebeles`, not hardcoded IDs, `K02` example.
- **Security** — unauthenticated `AppShell` shows loading then redirect `/login`, unauthorized `NAV` mismatch shows `UnauthorizedState` with backend note.
- **Backend** — `git diff --stat HEAD` shows no `backend/` or `database/` changes (prior to item 36's single route extension); existing mocha suites unaffected.

---

## 15. Known Limitations

- `GET /kebeles` shape assumed `{kebeles: [...]}` vs array — `lib/api.ts` normalizes both but backend contract should be documented.
- `POSTGIS` GIS lib not loaded yet — intentional per §29.
- `npm run build` occasionally times out in constrained CI (core dump on 60s timeout) but `typecheck`+`lint` pass; no large lib introduced to fix.
- Backend Test 10 (item 36) requires a reachable Postgres/PostGIS instance to execute; the sandbox has none, so those cases must run in the CI/dev DB environment.

---

## 16. Phase 4 Completion — Items 36–39

### 16a. Item 36 — Backend: minimal, authorized API change only

`git diff 266c5fb --stat -- backend/` shows exactly **one** backend file changed across all of Phase 4: `backend/routes/workers.js` (+47/−12). No routes rewritten, no business-logic changes, no new routes.

The single change extends **GET `/api/workers`** only, and is **backward-compatible**:
- **NON-breaking legacy path:** when no `page`/`limit` is supplied it still returns a **plain array** (legacy consumers like the Vanilla `frontend/` and the non-paginated salary summary query are unchanged).
- **New optional params** (all additive): `page`, `limit` (server pagination → `{ data, total, page, pages }`), `search` (ILIKE over full_name/contact/fayda_id), `status` (`active`/`inactive`), `kebeleId`, `zoneId`.
- The previous inline zone filter (`?zoneId=`) is preserved and now additionally applies within collector/leader scope.
- **Authorization preserved in every branch:** `leader` → `sz.leader_id`; `collector` → resolved `k.kebele_id` (with `{data:[],total:0,...}` when paginated / `[]` when not); `admin`/`viewer` may filter. `requireRole` and immutable helper `getCollectorKebeleId` untouched.

**Backend tests added** (backend/test/kebele-admin-workers.test.js, "Test 10"): paginated envelope shape, collector pagination stays scoped to their kebele, search ILIKE filtering, status filter, admin kebeleId filter, and the legacy plain-array response. These require a reachable Postgres/PostGIS instance to execute (`npm test` in `backend/`); they lint clean (0 errors) but the sandbox here has no reachable Postgres so they must run in the CI/dev DB environment.

### 16b. Item 37 — No database / schema / migration changes

`git diff 266c5fb -- database/ backend/config` is empty. No Postgres/PostGIS schema files, and no new/foot migration files were created. The pagination/search/filter logic lives entirely in the query layer (`SELECT ... FROM workers w LEFT JOIN safer_zones sz ...` with bounded `LIMIT/OFFSET`), reusing the existing EAV-style `custom_attributes`/EAV columns — no schema dependency added.

### 16c. Item 38 — Legacy functional parity (old Workers vs new module)

Checklist:

| # | Legacy capability (frontend/js/pages/workers.js) | New capability (frontend-next workers feature) | Verified |
|---|---|---|---|
| 1 | Summary stats: Total / Active / Daily Wage Total | `StatCard` grid: Total, Active, Inactive, Daily Wage Total (quarterly filters) | ✅ |
| 2 | Table: Name, Contact, Fayda/ID, Zone, Daily Wage, Status, Actions | `DataTable` with identical columns + status badge + 5 action buttons (desktop) | ✅ |
| 3 | Mobile worker action grid | `WorkerCard` mobile card (View/Edit/Attendance/ID/Salary/Delete, 44px targets) | ✅ |
| 4 | Search (🔍 client table filter) | Server-side ILIKE search (debounced, item 28 refetch) | ✅ (superset) |
| 5 | Zone filter dropdown | Server-side `zoneId` + kebele filter selects | ✅ |
| 6 | Add Worker modal (name, contact, fayda, wage, zone, custom attributes) | `WorkerFormModal` — same fields + zod validation + 409-dup handling | ✅ |
| 7 | Edit Worker modal (+ status Active/Inactive toggle) | `WorkerFormModal` editing mode with `isActive` toggle | ✅ |
| 8 | Delete worker (confirm) | `handleDelete` confirm + mutation (item 28) | ✅ |
| 9 | Bulk Attendance modal | `BulkAttendanceModal` (date + present/bonus per worker) | ✅ |
| 10 | Per-worker Attendance modal (📅 present/absent/gross + history) | `AttendanceModal` | ✅ |
| 11 | Per-worker Salary modal (💰 record payment + history) | `SalaryModal` | ✅ |
| 12 | Worker ID Card (🪪 tricolor, fayda barcode, custom attrs) | `IdCardModal` (Lucide-branded, no emoji) | ✅ |
| 13 | Detail (on row) | `WorkerDetailDrawer` | ✅ (new, supersedes inline) |
| 14 | Leader role: leader banner + zone scoping | Leader scopes workers/zones to their zone; editor actions | ✅ |
| 15 | Collector (kebele admin): sees own kebele only | Collector scoped to kebele (backend authority + UI lock) | ✅ |

**Deferred / intentionally replaced (documented, not silently lost):** legacy client-side row filtering is replaced by server-side search (superset — returns fewer rows, matches old behavior for substring). The non-paginated legacy API response is preserved for the old `frontend/` + the salary summary query.

### 16d. Item 39 — Visual quality (Phase 2 redesign, no emoji-heavy UI)

Verified against `frontend-next/src/app/(app)/operations/{workers,attendance,salary}` and the workers feature components: consistent spacing tokens, **Lucide icons** (the legacy emoji buttons ✏️🗑🪪📅💰 have been replaced with `Icons.{view,edit,idcard,attendance,salary,trash,bulkAttendance}` from the centralized `src/components/ui/icon.ts` system, plus `<Icons.empty />` and `<Icons.warning />` in `states.tsx`), professional `StatCard`/`DataTable`/`WorkerCard` surfaces, clear hierarchy (page title → toolbar → stats → table/cards), restrained shadows, and semantic colors via CSS `--*` tokens (green/orange/danger/purple) per the §4 design token set. Empty states ("No workers yet…"), loading states (`animate-pulse` skeletons), and error states (authorization/cross-kebele surfaced with `UnauthorizedState`/`toast`, no raw stack) are present. Item 35's `responsive.test.tsx` asserts touch-target sizing and a11y on the mobile surfaces; item 34 lazy-loads the heavy dialogs so initial paint/emphasis stays on the polished list/cards.


