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

**Runtime:** `next`, `react`, `lucide-react` (Lucide only, no emoji UI), `zod` + `react-hook-form` for future forms, `@hookform/resolvers`, `@tanstack/react-query` (server state — item 28).  
**No large libs:** no MapLibre/Chart.js globally — deferred to GIS phase.  
**Dev:** `eslint-config-next`, `tailwind`, `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react`.

---

## 3a. TanStack Query (item 28)

Server state is handled by `@tanstack/react-query` v5 for the Workers module (scope-limited per plan; Attendance/Salary/dialogs keep their existing `api` calls).

- **Provider:** `src/components/providers/index.tsx` exposes `QueryClientProvider` (wrapping `ToasterProvider`) mounted in `src/app/layout.tsx`. Defaults: `staleTime 60s`, `retry 1`, `refetchOnWindowFocus false`, `structuralSharing`.
- **Workers page** (`operations/workers/page.tsx`):
  - `["zones"]` — safer-zones singleton, `staleTime 300s` (deduped across renders).
  - `["workers", params]` — server-paged/list query keyed by `{page, limit, search, status, kebeleId, zoneId}`; `placeholderData: (prev) => prev` keeps prior page visible during navigation.
  - `["workers-summary", params]` — active/inactive counts + total wage, `enabled` once worker list loads.
  - Mutations via `useMutation`: delete (invalidates `workers` + `workers-summary`); dialogs refetch the workers list via `queryClient.invalidateQueries({queryKey:["workers"]})` on saved/close.
- Manual `fetchData`/`AbortController`/local loading-error-state were removed in favor of query state (`isLoading`/`isError`).


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

Run: `npm run lint` (next lint), `npm run typecheck` (tsc), `npm run test` (19 passed). Existing backend tests unchanged (no DB schema/logic change).

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
- **New frontend** — `npm ci` ok, `npm run lint` 0 errors, `npm run typecheck` 0, `npm test` 19 passed, `npm run build` (Next) ok (when not timed out by CI), `src/app/(public)/login` → `useAuth().login` → `api.login` preserves lockout/bcrypt.
- **Roles** — `viewer` no Users, `leader` scoped, `collector→Kebele Admin` locked selector verified.
- **9 kebeles** — selector renders 9 from `GET /kebeles`, not hardcoded IDs, `K02` example.
- **Security** — unauthenticated `AppShell` shows loading then redirect `/login`, unauthorized `NAV` mismatch shows `UnauthorizedState` with backend note.
- **Backend** — `git diff --stat HEAD` shows no `backend/` or `database/` changes; existing mocha suites unaffected.

---

## 15. Known Limitations

- `GET /kebeles` shape assumed `{kebeles: [...]}` vs array — `lib/api.ts` normalizes both but backend contract should be documented.
- `POSTGIS` GIS lib not loaded yet — intentional per §29.
- `npm run build` occasionally times out in constrained CI (core dump on 60s timeout) but `typecheck`+`lint` pass; no large lib introduced to fix.

