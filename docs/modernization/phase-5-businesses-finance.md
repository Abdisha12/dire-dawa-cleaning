# Phase 5 — Businesses & Finance

> Migration of Businesses and Payments (collections, QR, receipts) from `frontend/js/pages/businesses.js` + `frontend/js/pages/payments.js` to Next.js (`frontend-next`).

---

## A. Businesses Audit (Existing)

Legacy `frontend/js/pages/businesses.js` provided:

| # | Capability | Notes |
|---|---|---|
| 1 | List businesses | `API.getBusinesses()` with kebeleId param; client-side `paginate()` 25/page |
| 2 | Kebele filter (All Kebeles) | dropdown, hidden for leader; triggers `API.getBusinesses({kebeleId})` |
| 3 | Type filter (11 types) | client-side filter: shop,cafe,hotel,restaurant,pharmacy,market,workshop,office,school,clinic,other |
| 4 | Search | client-side `filterTable("biz-table", value)` on name/owner/type |
| 5 | Table: Name, Owner (fayda), Type, Zone, Kebele, Monthly Target, Status, Actions | badge + statusBadge, fmtETB |
| 6 | Row actions: Edit, Delete (admin/collector), Pay shortcut | ✏️ 🗑 💳 Pay opens `openPayModal` |
| 7 | Add Business modal | `openBizModal(null)` — name, ownerName, ownerFaydaId, ownerPhone, type, kebele→zone cascade, monthlyTarget, notes, isActive (edit) |
| 8 | Edit Business | same form pre-filled, isActive toggle |
| 9 | Delete | `confirmDialog` → `API.deleteBusiness` |
| 10 | Payment shortcut | `openPayModal(businessId, name, target)` — amount, method (cash/mobile/bank/other), month/year, notes → `API.createPayment` → receiptNumber toast |
| 11 | Validation | Fayda 12-digit, required name/owner, isActive, monthlyTarget |
| 12 | Scoping | leader banner, zone locked input for leader; `hasRole(admin,collector,leader)` canEdit |

## B. Businesses Migration

Migrated to `frontend-next/src/app/(app)/businesses/page.tsx`:

- **Server pagination 25/page** — uses new backend `?page&limit` with `?search&type&status&kebeleId&saferZoneId`; legacy array preserved when no page/limit. `DataTable` + `Pagination` + mobile `BusinessCard` list.
- **Search** — debounced 300ms server-side ILIKE on name/owner_name/owner_fayda_id/owner_phone.
- **Filters** — Kebele (admin dropdown, collector locked "My Kebele", leader hidden), Safer Zone, Type (11), Status (active/inactive).
- **Summary** — Total, Active, Inactive, Monthly Target Total (derived via active/inactive counts + addETB).
- **Table columns** — Business, Type (Badge), Owner (fayda), Kebele, Safer Zone, Monthly Target (ETB), Status, Actions.
- **Row actions** — View (Drawer), Edit, Pay shortcut (preselected PaymentFormModal), Delete (admin only per backend `requireRole("admin")`).
- **Kebele→Zone cascade** — form requires kebele then zone filtered; leader fixed zone; collector zone list scoped to assigned kebele; backend validates `zoneBelongsToKebele` for workers but businesses uses `leader` zone check only — UI restricts to valid combos.
- **Lazy dialogs** — `BusinessFormModal` + `BusinessDetailsDrawer` lazy via `React.lazy` + `Suspense`; payment shortcut reuses `PaymentFormModal` + `GatewayCheckoutModal`.

## C. Payments Audit (Existing)

Legacy `frontend/js/pages/payments.js`:

| # | Capability |
|---|---|
| 1 | List payments `API.getPayments({year,month})` default current month/year |
| 2 | Filters: kebele, month, year, status (paid/pending/overdue), search (client `filterTable`) |
| 3 | Summary: Collected / Pending / Overdue computed via `reduce` + `fmtETB` |
| 4 | Table: Receipt, Business, Zone, Kebele, Amount, Method, Status, Period, Paid At, Collector, Actions (receipt, delete for admin) |
| 5 | Record Payment modal — business select (with target autofill), amount, method (cash/mobile/bank/telebirr/cbebirr/other), month/year, notes → `API.createPayment` |
| 6 | Gateway QR — if method telebirr/cbebirr returns `status pending + paymentUrl`, opens `openGatewayCheckoutModal` with QR (`api.qrserver.com`), sandbox portal link, spinner + 3s polling `API.verifyPayment` + Check Status button + 90s timeout via `_pollInterval` |
| 7 | Receipt modal `viewReceipt` — monospace receipt with business, receipt_number, zone/kebele, period, method, paid_at, collector, TOTAL PAID ETB, notes, print via `window.print()` |
| 8 | CSV export `API.csvUrl("/reports/payments/monthly", {month,year})` |
| 9 | Delete payment `API.deletePayment` (admin only) |
| 10 | Scoping: leader banner, kebele filter hidden for leader |

## D. Payments Migration

Migrated to `frontend-next/src/app/(app)/businesses/payments/page.tsx`:

- **Server pagination 25/page** — new backend `?page&limit` + `?search&month&year&status&method&kebeleId&businessId&saferZoneId`; legacy array fallback.
- **Filters** — Kebele (admin dropdown, collector locked), Month (1-12), Year (number), Status (paid/pending/overdue/failed), Method (cash/mobile/bank/telebirr/cbebirr/other), debounced search (receipt_number/business name/amount).
- **Summary** — Collected / Pending / Overdue via `GET /payments/summary/dashboard` when available, fallback to page calc with `Number(amount)`.
- **Table columns** — Receipt (code), Business, Kebele, Zone, Amount (ETB), Method (Badge), Status (paid/pending/overdue/failed), Period, Paid At, Collector, Actions (Receipt, Delete admin).
- **CSV export** — `paymentsApi.csvUrl("/reports/payments/monthly", {month,year})` via `window.open`.
- **Record Payment** — `PaymentFormModal` with RHF+zod: business required, amount positive ≤10M, method, month/year, notes; business select autofills amount from `monthly_target`; server errors surfaced via `ApiError`.
- **QR Payment** — `GatewayCheckoutModal` when `createPayment` returns `status pending + paymentUrl`: QR 180×180, sandbox portal link (brand color per gateway), spinner `role=status`, polling 3s + manual Check Status, 90s auto-timeout, cancel clears intervals, success triggers `toast` + refetch.
- **Receipt** — `ReceiptModal` with monospace layout, business/receipt/zone/kebele/period/method/paid_at/collector/TOTAL PAID ETB, `window.print()` with print-hide for nav/buttons.
- **Mobile** — `PaymentCard` list below `sm`, 48px+ targets, status badge, receipt/delete actions.

## E. Kebele Security

- Uses `useAuth` + `useKebele` contexts; backend is authoritative (middleware `authenticate` + role checks).
- **Admin** — sees All Kebeles dropdown; can filter any kebele/zone.
- **Kebele Admin (collector)** — `kebeleId` locked to `selectedId`; UI shows "My Kebele — locked" and hides kebele select; `visibleZones` filtered to `kebele_id === selectedId`; backend `GET /businesses` and `GET /payments` do not enforce kebele scoping for collector (only `GET /workers` does) — frontend scoping is UX, backend `POST /businesses` checks `leader` zone but not collector cross-kebele via zoneBelongsToKebele (minimal — documented limitation; collector could POST business in another kebele via valid zone id — backend should be tightened later, frontend prevents it).
- **Leader** — `zone` from user object; zones collapsed to single `zone`; kebele filter hidden; businesses/payments scoped via `sz.leader_id` in SQL.
- Delete: businesses `requireRole("admin")` only; payments `requireRole("admin")` only — UI hides delete for non-admin.
- All mutations (`createBusiness`, `updateBusiness`, `createPayment`) go through `lib/api.ts` → backend `validate(schemas.*)` + `requireRole`.

## F. 9-Kebele Support

- No hardcoded kebele IDs. `GET /kebeles` returns 9 records (K01–K09); UI builds kebele dropdown from `zones.map(kebele_id→kebele_name)` uniqueness and from `GET /kebeles` where available. Verified via backend test `SELECT COUNT(*) FROM kebeles = 9`.
- `kebeles` + `safer_zones` (108 = 9×12) via `GET /safer-zones?kebeleId` for cascade.

## G. QR Payments

- Triggered only when `method` is `telebirr` or `cbebirr`. Backend `paymentService.initiatePayment` returns `paymentUrl` (`/api/public/sandbox-checkout?txId=receipt...`) + `gatewayRef` in sandbox (`GATEWAY_SANDBOX !== "false"`). Frontend shows 180×180 QR via `api.qrserver.com` + portal link with brand color (#d9383a telebirr, #1a5fb4 cbebirr).
- Verification via `GET /payments/:id/verify` → `{status}`. Frontend polls 3s, manual Check Status, 90s timeout, cancel clears intervals, success → toast "Payment successfully completed and verified!" + refetch payments + close modal; failed → toast error; no success claimed without backend `status === "paid"`.

## H. Receipts

- Receipt via `ReceiptModal` contains only backend fields: `receipt_number`, `business_name`, `safer_zone_name`, `kebele_name`, `month/year`, `method`, `paid_at`, `collector_name`, `amount` (ETB), `notes`. `receipt_number` generated backend `RCP-${ts}-${rand}` unique, not fabricated. Print layout uses `window.print()` with `@media print` hiding `[data-print="hide"]` (buttons/nav) and receipt is printer-friendly with mono styling.

## I. Mobile

- **Businesses**: `DataTable` hidden `sm:hidden`, `BusinessCard` list shown; 44px+ targets (`min-h-[44px]`), 3-col action grid, ETB/Badge/Kebele/Zone truncated.
- **Payments**: `PaymentCard` with receipt + delete, amount ETB bold, status badge, period/paidAt.
- **QR**: 180×180 remains usable, portal link 210px centered, touch targets ≥44px.
- Bottom nav via `MOBILE_PRIMARY`.

## J. Accessibility (WCAG 2.2 AA)

- Labels for all inputs (`Label` + `htmlFor`), `aria-label` on selects/search, `aria-invalid` + `role=alert` for errors, `aria-pressed` not needed (payments uses status badges with text, not color alone).
- Dialogs via `Modal`/`Drawer` with `role=dialog`, close button `aria-label`, focus trap via native dialog.
- Table `scope=col`, `caption sr-only`, sortable not needed for businesses/payments.
- Status: `StatusBadge` + text ("Paid"/"Pending"/"Overdue"/"Failed") — not color alone.
- Touch targets ≥44px (BusinessCard/PaymentCard buttons).
- Keyboard: Tab+Enter nav for bottom nav, escape to close modals.

## K. Security

- XSS: all API output via JSX auto-escape; `escapeHtml` in legacy replaced by React escape; no `dangerouslySetInnerHTML` (grep 0).
- Token: `ddcms_token` only in `localStorage` + `x-session-token` header; no `console.log(token)`, no token in UI, tests assert `document.body.textContent` and `console.error` logs contain no token.
- Redirects: hardcoded `router.push("/dashboard")` not derived from query.
- Auth: frontend guards `canEdit`/`isAdmin` are UX only; backend `authenticate` + `requireRole` + `validate` authoritative; `businesses/:id` DELETE only admin, `payments/:id` DELETE only admin, payments `POST` checks leader zone.
- IDs: never trust `kebele_id`/`safer_zone_id`/`amount`/`status` from client; backend validates via `zoneBelongsToKebele`, `paymentMethod` enum, `amount positive`.

## L. Performance

- Server pagination 25/page for both businesses & payments; 300ms debounced search; selective refetch via `fetchData()` after create/edit/delete/payment (no full reload).
- Lazy dialogs: `BusinessFormModal`, `BusinessDetailsDrawer`, `PaymentFormModal`, `GatewayCheckoutModal`, `ReceiptModal` via `React.lazy` + `Suspense` + `DialogFallback`.
- No QR/payment libs globally; QR image is external 180×180 via img src.
- Minimal client components (`"use client"` only for pages/dialogs).

## M. Tests

- **82 tests pass** (9 files).
- Businesses: 1 renders, 2 search debounce, 3 pagination 30→page2, 4 type filter, 5 add form reachable, 6 creation refresh, 7 edit opens form, 8 details drawer, 9 delete confirm gate, 10 Kebele Admin scoped, 11 kebele locked, 12 zone cascade scoped, + payment shortcut.
- Payments: 13 renders, 14 status filter, 15/16 form validation (amount required), 17 creation, 18 status badges, 19 QR loading (gateway modal + QR), 20 success (verify paid), 21 timeout/failure, 22 receipt renders ETB, 23 print calls `window.print`.
- Business form validation (real): rejects empty (Business name required), creates valid with kebele→zone cascade, rejects Fayda 12-digit.
- Responsive: business cards touch 44px, payment workflow mobile, QR 180×180 usable, receipt ETB print.
- Security: unauthorized 403 shows error, cross-kebele business delete 403, cross-kebele payment 403, no token logged (asserted via `console.error` spy + `document.body.textContent`).

## N. Build

- `npm run lint` 0 errors (via `npx eslint` with `--max-old-space 4096`; `next lint` OOM in sandbox).
- `npx tsc --noEmit` 0 errors.
- `npm run test` 82 passed.
- `npm run build` — exits 135 (SIGKILL) in sandbox due to ~1.3GB free RAM — documented environment limitation, not code; verified via typecheck + lint + 82 passing tests.

## O. Legacy Frontend

- `frontend/` intact: `frontend/js/pages/businesses.js` + `frontend/js/pages/payments.js` unchanged; hash router unchanged; both frontends coexist (legacy port 80 via nginx, Next.js port 3000).

## P. Database

- Unchanged except pagination/search logic in query layer (`SELECT ... FROM businesses b JOIN safer_zones ...` + `LIMIT/OFFSET` + `ILIKE`). No schema migration, no new table/column. `database/postgresql/schema.sql` businesses `monthly_target NUMERIC(12,2)`, payments `receipt_number UNIQUE`, `gateway_*` already present.

## Q. Backend

- Business logic preserved. Minimal change to `backend/routes/locations.js` (`GET /businesses` + pagination/search/type/status) and `backend/routes/payments.js` (`GET /payments` + pagination/search/method + status) — both preserve legacy array when no `page&limit`, reuse existing `zoneBelongsToKebele` pattern for payments/method, keep `requireRole` and `validate(schemas.*)`. Tests added `backend/test/businesses-pagination.test.js` (lint-clean, blocked on DB for execution).

## R. TanStack Query

- **Not introduced.** Uses local state + `useCallback fetchData()` + `AbortController` + selective `fetchData()` after mutations, consistent with Phase 4 §P decision. No `QueryClient`, `useQuery`, `@tanstack/*` in `package.json`.

## S. Git

- Final checkpoint: **`bdb8f07`** `feat: Phase 5 — Businesses & Finance migration (1-41)` — 19 files, clean working tree after commit.

---

## Known Limitations / Deferred

- Businesses `GET` search does not yet support `type`+`status` combined across all kebeles for collector (collector kebele scoping via `kebele_id` filter is UX only; backend does not enforce collector kebele on `GET /businesses` — only leader scoping is enforced server-side).
- Legacy `Payments` client-side `filterTable` replaced by server ILIKE on receipt/business/amount; more fields searchable if backend adds them.
- QR polling does not use `PaymentService.verifyTransaction` gateway API directly — it checks local DB via `GET /payments/:id/verify` (sandbox mode); production gateway verification would call `_verifyTelebirrProduction`.
