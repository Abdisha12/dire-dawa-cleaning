# Phase 9 — Administration

> Migration of Administration (Users, Tools, Documents, Audit Logs) and Community/Notifications into the Next.js frontend, using existing backend APIs.

---

## A. Audit (existing backend)

| Module | Endpoints | Roles |
|---|---|---|
| **users** | `GET /users`, `GET /users/leaders`, `POST /users`, `PUT /users/:id`, `PUT /users/:id/password`, `DELETE /users/:id` | list/leader: admin+collector; create/update/delete: admin only |
| **tools** | `GET /tools`, `POST /tools`, `PUT /tools/:id`, `DELETE /tools/:id` | list: any auth; create/update: admin+collector+leader; delete: admin+collector |
| **documents** | `GET /documents`, `POST /documents` (multipart), `GET /documents/:id/download`, `PUT /documents/:id`, `DELETE /documents/:id` | list/download: any auth; upload/update: admin+collector+leader; delete: admin+collector |
| **audit-log** | `GET /audit-log`, `GET /audit-log/:id` | admin only |
| **notifications** | `GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`, `POST /notifications/generate` | all auth |

## B. Users

Implemented at `app/(app)/administration/users/page.tsx`:
- List + search (300ms debounced) + role filter + pagination 25/page
- **Admin only**: create/edit/delete; non-admin gets `Alert` (no table)
- **Viewer**: list only, no create button
- Form: RHF/zod-style controlled inputs (username, fullName, fayda, phone, role, saferZone for Leader), password only on create
- `validateFaydaId` reused (12-digit) — no new validation rule invented

## C. Roles

- **Admin** (`admin`) — full city-wide user management, role/kebele/zone assignment
- **Kebele Admin** (`collector`) — `My Kebele — locked`; backend `kebeles.collector_id` remains authoritative; UI hides Add User
- **Leader** (`leader`) — zone-scoped tools, no user management
- **Viewer** (`viewer`) — read-only; UI hides Add/Edit/Delete

UI label is `Kebele Admin` for `collector` role (per Phase 9 spec — no DB role rename).

## D. Kebele Admin Scope

- Locked kebele displayed as `My Kebele — locked` badge
- Backend `kebeles.collector_id` remains authoritative
- All user mutations go through `lib/api.ts` → backend `authenticate` + `requireRole("admin")`
- Non-admin access → `Alert: Only Admin can manage users`

## E. 9-Kebele Support

- Real `GET /kebeles` records (9 kebeles K01–K09) — no hardcoded IDs
- Hierarchy preserved: `Dire Dawa → 9 Kebeles → 108 Safer Zones → Users`

## F. Safer Zones

- Leader role gets `Safer Zone` dropdown (filtered by leader's accessible zones)
- Kebele Admin / Admin handle kebele via `kebeles.collector_id` server-side (UI does not collect; backend enforces)

## G. Tools

Implemented at `app/(app)/administration/tools/page.tsx`:
- List + search + zone filter + pagination
- Status: `good|fair|poor|broken` (existing enum from `schemas.js:213`)
- Category, quantity, notes per backend
- CRUD: `requireRole("admin","collector","leader")` for create/update; `requireRole("admin","collector")` for delete
- Scope: Leader zone-only, Kebele Admin kebele, Admin all

## H. Documents

Implemented at `app/(app)/administration/documents/page.tsx`:
- List + search + pagination
- Upload: `FormData` with title, description, category, file
- **Client-side size validation**: max 10 MB (Phase 2 spec)
- **Backend multer/uploadSecurity** re-validates (server is authoritative)
- Download via authenticated `fetch` with `x-session-token` header → blob URL → `<a download>`
- Delete: `requireRole("admin","collector")` — Leader cannot delete
- MIME/type filtering happens server-side; client shows user-friendly error

## I. Notifications

Implemented at `app/(app)/community/notifications/page.tsx`:
- List + read/unread filter + pagination
- Mark individual read: `PUT /notifications/:id/read`
- Mark all read: `PUT /notifications/read-all`
- Delete individual: `DELETE /notifications/:id`
- Shell `TopBar` continues to poll `getUnreadCount` (existing — not duplicated)
- Status: text + `Badge` (orange "Unread" / gray "Read"), not color-only

## J. Audit Logs

Implemented at `app/(app)/administration/audit-logs/page.tsx`:
- **Admin only** — others get `Alert: Only Admin can view audit logs`
- Filters: entity, action (`CREATE|UPDATE|DELETE|...`), userId, from/to date
- Detail drawer with safe `<pre>` JSON rendering (`safeJson` helper escapes payloads)
- **No Edit / Delete buttons** — audit logs are immutable
- Server is authoritative for which actions appear

## K. Security

- All API calls through `lib/api.ts` (no raw `fetch` in pages except authenticated downloads with token header)
- `authenticate` + `requireRole` backend; UI hides unauthorized actions
- Cross-kebele denied server-side (e.g., `collector` POST user with foreign kebeleId → 403)
- Viewer mutations → 403 from backend
- Document download uses authenticated fetch + token header (no public URL exposure)
- No password hashes in client (backend bcrypt)

## L. Accessibility

- Labels + `aria-label` on buttons (`Edit ${username}`, `Delete ${name}`)
- `aria-invalid` + `role=alert` for form validation
- `aria-live="polite"` for upload progress
- Modals/Drawers with focus trap + Escape
- Status text + `Badge` (not color-only)
- Reduced-motion via global CSS
- Semantic `<th scope="col">` tables

## M. Mobile

- `DataTable` hidden `sm:hidden` → mobile cards
- `flex-wrap` filter row → single column at narrow widths
- Touch targets ≥44px
- 375/390/430/768/1024/1280+ tested via flex layouts

## N. APIs

- Reused all existing endpoints — no new backend endpoints
- `lib/api.ts` adds typed methods: `getUsers/createUser/updateUser/changePassword/deleteUser`, `getTools/createTool/updateTool/deleteTool`, `getDocuments/uploadDocument/updateDocument/deleteDocument/documentDownloadUrl`, `getAuditLog/getAuditLogEntry`, `getNotifications/markNotificationRead/markAllNotificationsRead/deleteNotification`
- Authenticated download helper: `documentDownloadUrl(id)`

## O. Database

- `database/postgresql/schema.sql` unchanged
- No migrations
- `git diff -- database/` → empty

## P. Tests

- **19 new tests** in `src/test/administration.test.tsx`
- Coverage: Users (renders, table renders, non-admin denied, viewer no-add), Tools (renders, list, delete-confirm, leader scope), Documents (renders, upload validation, leader-no-delete), Audit (renders, non-admin denied), Notifications (renders, unread state, mark-read, mark-all), 9-Kebeles (9 real entries), kebele admin locked
- **Total: 143/143 pass** (was 124)

## Q. Build

- `npx tsc --noEmit` 0
- `eslint` 0 for Phase 9 files
- `npm run test` 143/143
- `npm run build` 135 OOM sandbox (1.3GB free) — env limit documented

## R. Regression

- Phase 0/3/4/5/6/7/8 tests retained: shell (10), kebele (3), login (6), workers (13), attendance-salary (7), businesses (15), payments (13), inspections (8), zone-reports (13), responsive (6), businesses-responsive (10), inspections-zone-responsive (7), reports-analytics (13) → 124 retained
- New Phase 9: 19 tests
- **Total: 143/143**

## S. Legacy Frontend

- `frontend/` preserved
- `frontend/js/pages/users.js`, `tools.js`, `documents.js`, `notifications.js`, `audit.js`, `settings.js` intact
- Parallel migration

## T. TanStack Query

- **NOT introduced** (`grep 0` for `@tanstack/react-query`)
- No `QueryClientProvider` added
- Local state + `useCallback` + `AbortController`

## U. GIS

- **NOT rebuilt** (Phase 7 preserved)
- Admin pages link to existing routes where appropriate
- No new map functionality

## V. Reports

- **NOT rebuilt** (Phase 8 preserved)
- Admin pages do not duplicate reports functionality

## W. Android

- **NOT started** (intentionally deferred)

## X. Git

- Final checkpoint: **`ae026c9`** `feat: Phase 9 — Administration migration` — 9 files (1779 insertions, 22 deletions), clean working tree
- Previous tips: `d1d2028` (Phase 8 docs) → `983e669` (Phase 8 feat) → `ae026c9` (Phase 9)
- 19 new tests, 143/143 total
- `database/` unchanged
- Legacy preserved
