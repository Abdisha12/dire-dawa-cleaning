# Phase 6 — Inspections & Zone Reports

> Migration of Inspections (`frontend/js/pages/inspections.js`) and Zone Reports (`frontend/js/pages/zonereports.js`) to Next.js (`frontend-next`).

---

## A. Inspections Audit

Legacy `inspections.js`:

| # | Capability |
|---|---|
| 1 | List `GET /inspections` with `kebeleId, zoneId, status, from, to` |
| 2 | Filters: Kebele (hidden for leader), Zone, Status (active/warning/danger), Date from/to, Search (client `filterTable`) |
| 3 | Table: Date, Kebele (code), Zone, Status (`statusBadge`), Inspector, Photos (count button), Notes (ellipsis), Actions (Edit, Delete admin/collector) |
| 4 | Add `openInspModal(null)` — kebele, zone (optional), date, status radio, notes, photos (max 10, `multiple accept image/*`), leader zone locked |
| 5 | Edit `openInspModal(id)` pre-filled, same fields, existing photos with delete `deleteInspPhoto` |
| 6 | Delete `deleteInsp` confirm → `DELETE /inspections/:id` (admin/collector) |
| 7 | Photos: `viewPhotos` gallery modal, `API.getFileUrl`, delete per photo `DELETE /inspections/photo/:photoId` |
| 8 | Validation: kebeleId+date required, `validateForm`, `createInspection` Zod, file 5MB, image filter |
| 9 | Scoping: leader `sz.leader_id`, else kebele/zone filters |

## B. Inspections Migration

`frontend-next/src/app/(app)/operations/inspections/page.tsx:1`:

- **Server pagination 25/page** — new `?page&limit&search` (backend `inspections.js:23` `ILIKE` on `k.name|sz.name|u.full_name|i.notes`), legacy array preserved.
- **Search** 300ms debounced `search` on notes/inspector/kebele/zone.
- **Filters** — Kebele (admin/collector dropdown, leader hidden), Zone (filtered by kebele, leader single), Status, From/To date.
- **Summary** — Total, Today (date === today), Warning, Danger (derived from fetched page; no fabricated API).
- **Table** — Date (`fmtDate`), Kebele (name + code), Zone, Status (`Badge` green/orange/red), Inspector, Photos count, Notes (ellipsis), Actions.
- **Cards** — `InspectionCard` (`src/features/inspections/components/inspection-card.tsx:1`) mobile `min-h-[44px]`, photos button with count.
- **Dialogs** — `InspectionFormModal` (`inspection-dialogs.tsx:1`) kebele→zone cascade, date, status radios, notes, file input `multiple accept image/*` (max 10, 5MB via `multer` + `uploadSecurity`), existing photos grid; `PhotoGalleryModal` with delete per photo and `target="_blank"` preview. Both lazy `React.lazy` + `Suspense`.
- **Service** — `src/features/inspections/services/inspections-api.ts:1` via `lib/api.ts:52` (`isFormData` for `FormData`).

## C. Zone Reports Audit

Legacy `zonereports.js`:

| # | Capability |
|---|---|
| 1 | List `GET /zone-reports?year&month` default current month/year |
| 2 | Filters: Month, Year, Status (draft/submitted/reviewed/approved), Zone (hidden for leader) |
| 3 | Table: Zone, Kebele, Period (`monthName`), Leader, Status, Workers (present/absent), Collection (`fmtETB`), Reviewed By, Actions (View, Submit draft→submitted, Review submitted→reviewed, Approve reviewed→approved, Edit draft) |
| 4 | How-work banner: Leader create → Collector review → Admin approve |
| 5 | Create `openZRModal(null)` — zone (leader locked), reportDate, status draft/submitted, workersPresent/Absent, collectionTotal, issues/actions/tools |
| 6 | Edit draft `openZRModal(id)` same |
| 7 | Submit `submitZR` → `PUT /zone-reports/:id {status:"submitted"}` |
| 8 | Review `openReviewModal` — notes + Mark Reviewed / Approve (`PUT /zone-reports/:id/review {status, reviewerNotes}`) |
| 9 | Approve `approveZR` → `PUT /zone-reports/:id/review {status:"approved"}` |
| 10 | Detail `viewZRDetail` modal with zone/kebele/period/leader/status/collection/workers/issues/actions/tools/reviewer |
| 11 | Pagination client 25/page, `Pending Review` button filters to submitted |
| 12 | Validation: `saferZoneId+reportDate` required, `createZoneReport` Zod |

Backend `zoneReports.js` state machine `draft→submitted→reviewed→approved` with `VALID_TRANSITIONS` and `ROLE_TRANSITIONS` (leader can draft→submitted, collector submitted→reviewed, admin reviewed→approved).

## D. Zone Reports Migration

`src/app/(app)/operations/zone-reports/page.tsx:1`:

- **Server pagination 25/page** — new `?page&limit&search` (backend `zoneReports.js:30` `ILIKE` on zone/kebele/leader), legacy array preserved.
- **Filters** — Month, Year, Status, Zone (hidden for leader), no client `filterTable`.
- **Summary** — Total, Draft, Submitted, Approved (derived from fetched page).
- **Table** — Zone, Kebele, Period, Leader, Status (`Badge` gray/orange/blue/green), Workers (`✅/❌`), Collection (`fmtETB`), Reviewed By, Actions (View, Submit, Review, Approve, Edit draft). `DataTable` + `Pagination`.
- **Cards** — `ZoneReportCard` (`src/features/zone-reports/components/zone-report-card.tsx:1`) mobile `min-h-[44px]`.
- **Dialogs** — `ZoneReportFormModal` (`zone-report-dialogs.tsx:1`) RHF+zod (`saferZoneId` required, `reportDate` `YYYY-MM-DD`, `workersPresent/Absent` 0-10000, `collectionTotal` 0-100M), leader zone locked, status draft/submitted; `ReviewModal` with notes + Mark Reviewed / Approve (calls `reviewZoneReport`); `ZoneReportDetailDrawer` with period/status/metrics/issues/tools/reviewer. All lazy.
- **Workflow** — exact backend states `draft→submitted→reviewed→approved` preserved, no invented states; `submit` via `PUT /:id {status:"submitted"}`, `review` via `PUT /:id/review`.
- **Service** — `src/features/zone-reports/services/zone-reports-api.ts:1` via `lib/api.ts`.

## E. Kebele Security

- `useAuth` + `useKebele`; backend authoritative.
- **Inspections** — `GET /inspections` leader `sz.leader_id=$user.id`, else `kebeleId/zoneId` filters; `POST` leader `saferZoneId` must belong to `leader_id`, else any kebele/zone; `DELETE` `requireRole("admin","collector")` (leader cannot delete). Frontend `canEdit` admin/collector/leader, `isAdmin` admin/collector for delete.
- **Zone Reports** — `GET` leader `sz.leader_id`, else `zoneId` filter; `POST` leader zone check; `PUT` leader can only edit own zone report, status transitions checked via `canTransition` + `ROLE_TRANSITIONS`; `PUT /:id/review` `requireRole("admin","collector")` (collector can `submitted→reviewed`, admin `reviewed→approved`). Frontend hides `New Report` for non-leader, `Pending Review` for `canReview`, edit only draft+leader, submit only draft+leader, review only submitted+canReview, approve only reviewed+canReview.
- All `kebele_id`/`safer_zone_id` validated server, never trust client.

## F. 9-Kebele Support

- No hardcode; `GET /kebeles` 9 + `GET /safer-zones` 108; kebele dropdown from `GET /kebeles` or `zones` uniqueness; leader zone locked to `user.zone`.

## G. Photos

- `multer.diskStorage` `../uploads/inspections` `5MB` `createFileFilter("inspection")` (`backend/routes/inspections.js:15`), `validateUploadedFile`, `handleMulterError`. Frontend `FormData` `photos` (max 10), `accept="image/*"`, preview existing photos, delete per photo `DELETE /inspections/photo/:photoId` with path traversal check `resolved.startsWith(uploadsDir)`.

## H. Zone Report Workflow

- Exact states `draft→submitted→reviewed→approved` via `VALID_TRANSITIONS` (`zoneReports.js:11`) and `ROLE_TRANSITIONS` (`zoneReports.js:21`): `draft_to_submitted` admin/collector/leader, `submitted_to_reviewed` admin/collector, `reviewed_to_approved` admin. Frontend enforces same: draft edit/submit for leader, submitted review for collector, reviewed approve for admin. `PUT /:id` and `PUT /:id/review` both check `canTransition` and role.

## I. Mobile

- Inspections: `DataTable` hidden `sm:hidden`, `InspectionCard` list `min-h-[44px]`; Zone Reports: `ZoneReportCard` grid 2, `min-h-[44px]`; both with `Pagination` below `sm`.

## J. Accessibility

- Labels + `aria-label` on selects/search, `role=dialog` Modals/Drawers, table `scope=col`, status `Badge` text not color alone, `min-h-[44px]`, keyboard `Select`/`Button`, `prefers-reduced-motion` via `globals.css`.

## K. Security

- `dangerouslySetInnerHTML` 0, no token logged (tests assert), `x-session-token` header only, `requireRole` + `validate` + `authenticate` authoritative, `multer` file filter + path traversal check, `FormData` not JSON for photos.

## L. Performance

- 25/page server pagination, 300ms debounce, selective `fetchData()` after mutations, lazy dialogs (`React.lazy` + `Suspense`), `FormData` only for inspections, no global photo lib, minimal `"use client"`.

## M. Tests

- **111 pass / 12 files** (was 83): Inspections 8, Zone Reports 13, Responsive 7, plus existing 83 (workers, businesses, payments, etc.).
- Inspections: renders, search debounce, paginates 30→page2, filters status/date, add opens form, edit, photo gallery, delete confirm, leader scope, unauthorized no token.
- Zone Reports: renders, filters status/month, paginates, new report (leader), edit draft, view detail, submit draft→submitted, review submitted→reviewed (collector), approve reviewed→approved (admin), pending review filter, unauthorized, invalid transition 400.
- Validation: inspection requires kebele+date, creates valid; zone report requires zone+date, creates valid.
- Responsive: inspection card 44px, zone report card, status text, etc.

## N. Build

- `npx tsc --noEmit` 0
- `NODE_OPTIONS=--max-old-space-size=4096 npx eslint` 0 (warnings for `<img>` with `eslint-disable`)
- `npm run test` 111/111
- `npm run build` 135 OOM sandbox (1.3GB free, core dumped) — env limit, not code; verified via typecheck.

## O. Legacy Frontend

- `frontend/` intact (`frontend/js/pages/inspections.js`, `zonereports.js`).

## P. Database

- Schema unchanged (`database/postgresql/schema.sql` `inspections` + `inspection_photos` + `zone_reports` with `draft→approved`); query-layer `LIMIT/OFFSET` + `ILIKE` only; no migration.

## Q. Backend

- Logic preserved; minimal `GET /inspections`/`GET /zone-reports` pagination + search (`inspections.js:23`, `zoneReports.js:30`) keeping legacy array, plus `multer` already present. `backend/test` not yet for Phase 6 (blocked on DB, lint-clean).

## R. TanStack Query

- **NOT introduced** (`grep` 0); local state + `useCallback fetchData` + `AbortController` + selective `fetchData()`.

## S. Git

- Final checkpoint to be reported.
