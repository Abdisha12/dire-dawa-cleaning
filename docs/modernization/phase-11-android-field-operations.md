# Phase 11 — Android Field Operations

Status: **IMPLEMENTED** (build + unit tests green on the Phase 10 Android foundation).
Scope: Attendance, Inspections, Photos, GPS, Offline Queue, and Sync — all consuming the
existing Phase 10 backend/auth/Postgres. No invented data or workflows.

---

## 1. Workflows implemented

Each workflow reuses the **real backend endpoints** (verified against source in the Phase 10
contract audit) and the existing auth/session/role model. Nothing is fabricated.

| Workflow | § | App entry | Backend contract used |
|---|---|---|---|
| Attendance | §9–§14 | Home → Record Attendance (`AttendanceScreen`) | `GET /api/workers` (scoped), `POST /api/workers/attendance/bulk`, `GET /api/workers/:id/attendance` |
| Inspections | §15–§27 | Home → New Inspection (`InspectionCreateScreen`) | `GET /api/zones` (scoped), `GET /api/kebeles`, `POST /api/inspections` multipart |
| Zone Reports | §28–§30 | Home → Zone Reports (`ZoneReportsScreen`) | `GET/POST/PUT /api/zone-reports` |
| Notifications | §31–§32 | Notifications | `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all` |
| Workers (view) | §7–§8 | More → Workers | `GET /api/workers`, `GET /api/workers/summary/stats` |
| Sync status | §43–§44 | More → Sync status | Room queue + `SyncScheduler` |

## 2. Key decisions and backend-conformance

- **Attendance `present` is boolean** — the backend has no Late/Excused/Half-Day. The UI
  offers Present/Absent only. (#)
- **Bulk endpoint idempotency** — `POST /api/workers/attendance/bulk` uses
  `UNIQUE(worker_id, date)` upsert, so a queue replay after a retry is safe (§14).
- **Notified read is `PUT`** — `PUT /api/notifications/:id/read` (Phase 10 incorrectly used
  POST; corrected in this phase).
- **Inspections have NO backend location/business column** — GPS is captured on-device and
  kept in the local draft (§20–§22); it is shown to the user but **not** grafted into the
  multipart payload. Documented as a limitation.
- **Zone report transitions are ONLINE-ONLY** — `draft → submitted → reviewed → approved`
  state machine must be validated live by the backend (§29, §40, §69). Only the draft
  **create** is queueable offline.
- **Client never trusts a kebele/zone id** — kebele is derived from a backend-scoped safer
  zone (§4). No cross-kebele/zone bypass on the client.

## 3. GPS & Photos

- **GPS** (`field/LocationProvider.kt`): platform `LocationManager`, no Google Play services.
  On-demand single update with a 15s timeout; reports the actual accuracy the OS provides,
  never a claimed value (§20). Permission is requested **at the point of use** in
  `InspectionCreateScreen` (§18, §19). Real coordinates only — never fabricated.
- **Photos** (`field/PhotoProcessor.kt`): system `ACTION_IMAGE_CAPTURE` via a MediaStore
  output Uri (no CameraX/Coil). Each photo is downscaled to 1600px, JPEG q80, capped at 5MB,
  EXIF orientation corrected, and GPS EXIF stripped before upload (§23–§27). Up to 10 photos.

## 4. Offline queue & sync architecture

- **Room DB** `field.db` v1 (`data/offline/local/`):
  - `pending_operations` — queued mutations only. **No tokens are stored** in this table (§37, §45).
  - `cached_workers` — minimal worker cache for offline attendance reading, 12h TTL (§35).
- **`SyncQueue`** interface + `RoomSyncQueue` + `JsonQueuePayloadCodec` (keep `SyncEngine` JVM-testable).
- **`SyncEngine`** (framework-free): classifies failures —
  - RETRYABLE: network / timeout / 5xx / 429 → keep PENDING, increment attempt.
  - PERMANENT: 400/403/404/409 → mark FAILED, stop retrying, surface to user.
  - NEEDS_AUTH: 401 → **preserve payload**, mark NEEDS_AUTH, require reauth (§42).
  - Confirmed ops are deleted from the queue on 2xx (dedupe-safe via idempotent backend).
- **`SyncWorker`** (WorkManager): skips when unauthenticated, never deletes queued work.
- **`SyncScheduler`**: periodic 30-min pass + expedited one-shot (both connectivity-gated,
  unique work names; §44–§45).
- **Truthfulness** (§14, §33): queued is **never** presented as server-confirmed. The UI shows
  distinct `ServerConfirmed` / `Queued` / `Failed` states.

## 5. Bug found & fixed by tests

- **`ErrorMapper` mapped HTTP 400 → `SERVER`** which made `FieldRepository` treat validation
  rejections as transport errors and **queue them for retry**. The backend uses 400 for
  validation (see `backend/routes/workers.js`, `zoneReports.js`, `errorHandler.js`). Fixed to
  map `400, 422 → VALIDATION` (permanent, shown to user, never queued). Covered by
  `FieldRepositoryTest.attendance_validationError_isFailed_notQueued`.
  - This was a genuine correctness bug; the backend was already correct, no backend change needed.

## 6. Test results

- **Android unit tests: 47/47 pass, 0 failures.**
  - `SyncEngineTest` (8 tests): success dedupe, 500 retry, 401 preserves payload + NEEDS_AUTH,
    403/404/409 permanent, 429 retry, max-attempts cap.
  - `FieldRepositoryTest` (5 tests): attendance confirmed vs queued truthfulness, transport
    queueing, validation never queued, zone-report **update online-only + never queued**,
    zone-report draft create queueable.
  - Plus existing 34 Phase 10 tests still green (incl. updated HomeViewModelTest for new KPI calls).
- **Android lint: 0 errors** (`lintDebug` BUILD SUCCESSFUL).
- **Android assembleDebug: BUILD SUCCESSFUL** (debug APK ~20 MB, up from 18.5 MB with Room +
  WorkManager added).
- **Frontend regression** (`frontend-next`): **143/143 vitest tests pass**, `tsc --noEmit` clean.
- **Backend**: no files modified. Its test suite requires a live PostgreSQL + `PAYMENT_WEBHOOK_SECRET`;
  unavailable in this sandbox (psql not present) — pre-existing environment limitation, no regression.

## 7. Files changed (all under `android/`)

- `app/build.gradle.kts` — kapt plugin, Room 2.6.1, work-runtime-ktx 2.9.1.
- `AndroidManifest.xml` — `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA` (declared only).
- `data/api/ApiService.kt`, `ErrorMapper.kt`, `data/model/Dtos.kt` — field-operation contracts + 400→VALIDATION fix.
- `data/repository/` — `OperationsRepository` (markRead PUT, worker stats/attendance); new `FieldRepository`.
- `data/offline/` — queue/sync layer (Room, codec, engine, worker, scheduler, network monitor).
- `field/` — `LocationProvider`, `PhotoProcessor`.
- `domain/` — model extensions, `DatePolicy`.
- `ui/screens/` — attendance, inspections, zonereports, notifications (mark-read), workers/detail, sync.
- `ui/navigation/` — `Destinations` + `AppNavHost` wiring; `AppViewModelFactory`.
- Tests: `SyncEngineTest`, `FieldRepositoryTest`, `FakePendingOperationDao`, updated `HomeViewModelTest`.

## 8. Known limitations / not claimed

- **Instrumentation/on-device validation not performed** — no emulator/device in this sandbox (§66).
- Backend test suite not run (needs live DB); backend intentionally untouched.
- `next build` OOM (exit 135) and `maplibre-gl` ERESOLVE are pre-existing sandbox blockers,
  unrelated to Android changes; `next lint` Hangs/core-dumps in sandbox. `tsc` + vitest verified.

## 9. STOP

Per the task’s STOP condition: no tracking, no Play Store, no deletion of the legacy
`frontend/`, no backend changes. **STOPPED** pending the next instruction.
