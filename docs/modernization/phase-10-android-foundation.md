# Phase 10 — Android / Mobile Application Foundation

Continuing the Dire Dawa Cleaning Department modernization from the completed
**Phase 9 — Administration** checkpoint.

**Status:** Foundation developed as a production-ready Android project source tree
under `android/`. **Build verified in-session:** `test` (34/34), `lint` (0 errors),
`assembleDebug` all pass. See [O. Build](#o-build) for the exact commands and
results.

---

## A. Audit — Existing mobile/backend capabilities discovered

Before implementation, the repository was audited (`frontend-next/`, `backend/`,
`database/postgresql/`, `docs/modernization/`) to determine which existing backend
APIs are suitable for mobile use. **No undocumented APIs were assumed.**

### Authentication (single system — reused, not duplicated)
- `POST /api/auth/login` — `{username, password}` → `{token, user}`. Enforces
  bcrypt, session UUID, 8h expiry, failed-login lockout (5/15m). Returns
  `user.role` and, for leaders, `user.zone`.
- `POST /api/auth/logout` — invalidates the session in the DB.
- `GET /api/auth/me` — returns `{id, username, fullName, role, zone}`.
- Token header: the backend accepts **`x-session-token`** (canonical) and
  `Authorization: Bearer` (auth middleware fallback). Session persisted in a DB
  `sessions` table; `authenticate` rejects missing/expired tokens with 401.

### Roles (backend-authoritative)
- `admin` (Admin), `collector` (backend role; displayed as **Kebele Admin**),
  `leader` (Zone Leader), `viewer` (Viewer). `collector` is **not** renamed in the
  database — display mapping only (§6).

### Domain endpoints verified for mobile use (read/light ops)
- `GET /api/kebeles` — real 9 kebeles (K01–K09), includes `collector_name`,
  `zone_count`. Sources the 9-kebele context (§7) — no hardcoded IDs.
- `GET /api/safer-zones` — real zones; leader-scoped when role is `leader`;
  `kebeleId` filter supported. Supports the 108 real safer zones.
- `GET /api/workers` — list, paginated; leader/kebele scoped; `zoneId` filter.
- `GET /api/workers/summary/stats` — worker summary (used by web, optional mobile).
- `GET /api/notifications`, `GET /api/notifications/unread-count`,
  `PUT /api/notifications/{id}/read`, `PUT /api/notifications/read-all` — real
  notification API, user-scoped by `user_id`. No fabricated notifications.
- GIS `GET /api/gis/*` (GeoJSON) exist from Phase 7 but are **not wired** into the
  mobile foundation (see [K. GIS](#k-gis)).

### Admin-oriented endpoints (NOT copied into mobile foundation)
`/users`, `/users/leaders`, `/tools`, `/documents`, `/audit-log`, `/reports/*`,
`/analytics/*`, payment business-mutations — administrative functions are not
migrated to mobile in this phase (§5), as the mobile prioritizes field workers.

### Backend + database unchanged
- **Backend:** zero backend code changes (§38). No new endpoints were required for
  the foundation.
- **Database:** `git diff -- database/` is empty — `schema.sql` untouched (§39).

---

## B. Android — Project and architecture

- **Location:** `android/` — isolated from `frontend-next/` and `frontend/` (§3).
- **Language:** Kotlin 2.0.20 (strict typing, immutable state where practical).
- **UI:** Jetpack Compose + Material 3.
- **Build:** Android Gradle Plugin 8.5.2, Gradle Kotlin DSL, Gradle wrapper 8.9.
- **Concurrency:** Coroutines + StateFlow + ViewModel.
- **Architecture (single direction):**
  ```
  UI (Compose)
    ↓
  ViewModel
    ↓
  Repository
    ↓
  API service (Retrofit + AuthInterceptor)  →  existing backend
  ```

### Package ID
`app.diredawa.cleaning` — documented stable application identity based on the
project. (Finalize to an organization-owned reverse-domain before Play publishing;
Play publishing is explicitly out of scope for this phase.)

### Source layout (recommended structure mirrored)
```
android/
└── app/src/
    ├── main/java/app/diredawa/cleaning/
    │   ├── data/
    │   │   ├── api/        ApiService, ApiClient, ApiResult, ErrorMapper,
    │   │   │               AuthInterceptor, NetworkIOException
    │   │   ├── auth/       SecureTokenStore (SessionStorage), SessionManager
    │   │   ├── repository/ AuthRepository, LocationRepository, OperationsRepository
    │   │   └── model/      Dtos.kt (API DTOs)
    │   ├── domain/
    │   │   ├── model/      Models.kt (Role, Zone, AuthenticatedUser, scope)
    │   │   └── usecase/    ResolveScopeUseCase
    │   └── ui/
    │       ├── navigation/ AppNavHost, AppViewModelFactory, Destinations
    │       ├── theme/      Theme.kt
    │       ├── components/ States.kt, UiState.kt
    │       └── screens/
    │           ├── auth/        LoginScreen + AuthViewModel
    │           ├── home/        HomeScreen + HomeViewModel
    │           ├── operations/  OperationsScreen
    │           ├── notifications/ NotificationsScreen + NotificationsViewModel
    │           └── more/        MoreScreen
    ├── CleaninApplication.kt, MainActivity.kt, AppContainer.kt
    └── src/test/...          JVM unit tests
```

---

## C. Authentication — Reusing the existing backend

- Login/logout/`/me` use the **existing** backend endpoints (§8) — no parallel auth.
- Token is attached exactly as the backend expects via `AuthInterceptor`:
  `X-Session-Token` header (+ `Authorization: Bearer` for parity with the web app).
- **Secure storage:** token + a minimal user snapshot live in
  `SecureTokenStore` (EncryptedSharedPreferences via AndroidX Security, AES-GCM).
  Passwords are never persisted.
- **Session expiry:** on a backend 401, `AuthInterceptor` signals `sessionExpired`;
  the app invalidates the local session and the nav graph returns to Login.
- **Logout:** calls `/api/auth/logout` then clears local secure storage.
- `SessionManager` exposes `isAuthenticated`, `currentUser` StateFlows for the
  nav layer.

Never logged: passwords, tokens, authorization headers, secrets (§9).

---

## D. Roles — Admin / Kebele Admin / Leader / Viewer

Role display mapping (§6) is centralized in `Role`:

| Backend role | Display in mobile |
|--------------|-------------------|
| `admin`      | Admin             |
| `collector`  | **Kebele Admin**  |
| `leader`     | Zone Leader       |
| `viewer`     | Viewer            |

- **Admin** → `OperationalScope.CityWide`.
- **Kebele Admin (`collector`)** → `OperationalScope.Kebele`, displayed as
  "My Kebele". Locked to their assigned kebele — never changeable from the mobile
  UI (§18). Backend enforces kebele scope on all data endpoints.
- **Leader** → `OperationalScope.Zone` from `/me.zone`, shown as "My Safer Zone".
  The leader cannot select a different zone to bypass auth (§19); the scope is
  derived from what the backend reports.
- **Viewer** → read-only UI; mutation controls are hidden (§20).

**Important:** These are UX-level scope derivations for display/navigation only.
The **backend is the security authority** (§37) — a Kebele Admin cannot request
another kebele's data, a Leader cannot request another zone, and a Viewer cannot
mutate, regardless of what the mobile UI shows.

---

## E. 9 Kebeles — real data + scope

- The app calls `GET /api/kebeles` to load the real 9 kebeles (fetched, not
  hardcoded) (§7).
- No `Kebele 1 … Kebele 9` literals anywhere. Ancillary context (`My Kebele`)
  comes from backend data.
- Kebele Admin is locked to their assigned kebele by the backend; the mobile does
  not permit changing it.

## F. Safer Zones — zone-scoping

- Zones are loaded from `GET /api/safer-zones` (108 real zones).
- For a Leader, the backend returns only their zone (`WHERE sz.leader_id=$1`); the
  mobile reflects that single zone as "My Safer Zone".
- Zone-scoping behavior is backend-authoritative; the UI derives scope from `/me`
  only for display.

---

## G. Security

- **Token storage:** EncryptedSharedPreferences (AES-GCM), never plaintext
  SharedPreferences/logs/analytics (§9).
- **API auth:** `x-session-token` + Bearer injected by `AuthInterceptor`; nothing
  else.
- **Authorization:** backend-authoritative (role + zone middleware untouched).
- **Network transport:** HTTPS required in release (§29). `network_security_config`
  in `main` forbids cleartext. A **debug-only** overlay permits HTTP solely to
  `10.0.2.2`/`localhost` for local dev; `usesCleartextTraffic=false` is set.
- **Logging:** debug-only `HttpLoggingInterceptor` at `BASIC` level; token/headers
  never logged. Release builds disable logging.
- **Backups:** `allowBackup=false`, `fullBackupContent=false` (§31).
- **Storage:** minimal; no passwords/audit payloads/unrestricted API dumps (§28).
- **Screenshots/exported activities/deep links:** single-activity; no
  exported intent filters beyond the launcher; no privileged deep links (§32).
- **Permissions:** none requested beyond `INTERNET` (§30). No location/camera/
  storage/microphone in this phase.

---

## H. UX — Mobile navigation and design system

- **Primary destinations (§16):** Home, Operations, Notifications, More — a small
  bottom navigation bar. Field workflows (Workers / Attendance / Inspections /
  Zone Reports) are nested under Operations, not added as bottom items.
- **Home (§17–19):** shows authenticated context — user, role label, kebele/zone
  ("My Kebele" / "My Safer Zone") from real backend `/me` data. No invented KPIs.
- **Material 3 theme (§13)** with municipal identity tokens centralized in
  `ui/theme/Theme.kt`: Primary `#1d4ed8`, Success `#16a34a`, Warning `#ea580c`,
  Danger `#dc2626`, Information `#2563eb`. Consistent typography/spacing/rounded
  surfaces. No emoji as primary UI icons.

## I. Accessibility (§14)

- TalkBack-friendly via semantic labels/content descriptions (loading, buttons).
- Material 3 components with accessible contrast; scalable text; 44dp+ touch targets
  via Material components; reduced motion honored by Compose where applied.
- Keyboard/label conventions follow Android accessibility guidelines.

---

## J. Offline (§27)

- **Not implemented.** No fake offline sync, no silent queueing.
- The app distinguishes connection/error states (loading / content / error via
  `UiState`), and classifies `NetworkError` (NETWORK / UNAUTHORIZED / FORBIDDEN /
  NOT_FOUND / CONFLICT / VALIDATION / RATE_LIMITED / SERVER / TIMEOUT).
- A future offline strategy is documented here only; no conflict resolution exists.

## K. GIS (§26)

- **Foundation-only.** GIS is prepared as the architecture for a future
  map→kebeles→zones→workers/businesses/inspections stack, but **no map is built**
  and no coordinates are fabricated. The mobile foundation does not consume
  `GET /api/gis/*` yet — no real geometry has been fabricated. When mobile GIS is
  implemented, real backend GeoJSON from Phase 7 will be used.

## L. Backend

**No changes.** Existing APIs suffice for the foundation (§38). No new endpoint,
no API redesign.

## M. Database

**Unchanged.** `git diff -- database/` is empty. `database/postgresql/schema.sql`
was not modified (§39).

## N. Tests — actual results

JVM unit tests under `android/app/src/test` cover (§36–37):
API auth-config header flow, login success, login failure, session expiry,
role mapping, Kebele Admin scope, Leader zone scope, Viewer read-only behavior,
401/403 handling, Home state, loading/empty/error states, and notification/worker
data-loading. **Executed in-session: all 34 tests pass** on both `testDebugUnitTest`
and `testReleaseUnitTest` (see [O. Build](#o-build)).

(Preferred commands: `./gradlew test`, `./gradlew lint`, `./gradlew assembleDebug`.)

## O. Build — actual results

> **Verified in-session.** The full toolchain was assembled in the sandbox and the
> build was executed successfully:

- JDK: Amazon Corretto 17 (`/home/abdi/android-sdk/jdk17`).
- Android SDK (via `sdkmanager`): `platforms;android-34`, `build-tools;34.0.0`,
  `platform-tools`; licenses accepted.
- Gradle 8.9 distribution + Android Gradle Plugin 8.5.2; Gradle wrapper generated
  `gradle-wrapper.jar` (wrapper jar is a generated binary and is git-ignored).
- `./gradlew test` → **BUILD SUCCESSFUL** — **34/34 unit tests pass** on both
  `testDebugUnitTest` and `testReleaseUnitTest` (0 failures).
- `./gradlew lint` → **BUILD SUCCESSFUL** — 0 errors, 18 warnings (version-pin
  "newer available" notices, navigation-lint obsolete-check notices, and a couple
  of resource hygiene notes; no correctness/security findings).
- `./gradlew assembleDebug` → **BUILD SUCCESSFUL** — debug APK produced at
  `android/app/build/outputs/apk/debug/app-debug.apk`.

Compile fixes made during the build (all resolved, verified compiling):
- Manifest: `android:networkSecurityConfig` moved from an (invalid) element to the
  `<application>` attribute; added adaptive launcher icon, `dataExtractionRules`,
  `fullBackupContent` for backup hardening.
- Domain: nested `OperationalScope` data classes referenced top-level `Kebele`/
  `Zone` with fully-qualified types to avoid shadowing; added `val user` to the
  sealed interface.
- Networking: replaced the external Retrofit↔kotlinx bridge dependency with a
  minimal self-contained `KotlinxSerializationConverterFactory` (no extra artifact),
  using kotlinx-serialization's public `serializerOrNull(Type)`.
- Misc: `override` modifiers on the `SessionStorage` impl, `.collectAsState()`
  (import) in the login screen, `Icons.AutoMirrored.Filled.List`, and unit-test
  async-state polling `awaitState` helper for MockWebServer-driven ViewModel tests.

## P. Web Regression

- `npm run typecheck` — pass (0 errors).
- `npm run lint` — pass (0 warnings).
- `npm run test` — **143/143 tests pass** across 14 files. Android work introduced
  **no** web regressions; `frontend-next/` is untouched.

## Q. Legacy Frontend

`frontend/` remains **intact** — not deleted or migrated as part of Android
foundation work (§41).

## R. TanStack Query

Confirmed **NOT introduced.** No `@tanstack/react-query` in web or Android.
Android uses its native architecture (ViewModel + Repository + Coroutines), and
web continues without TanStack Query (§42).

## S. Git

Phase 10 checkpoint commit — see final commit hash at the end of this phase
(per git discipline §47, only Phase 10 files / `android/` + docs are committed).

---

## Future mobile roadmap / limitations (clearly marked)

- **Workers/Attendance/Inspections/Zone Reports:** navigation architecture is
  prepared but **full workflows are not implemented** in this foundation (§21–24).
- **GIS/map:** prepared only; not implemented (§26).
- **Offline sync & conflict resolution:** not implemented (#27).
- **Push notifications:** not implemented.
- **Play Store publishing:** out of scope.
- **Kebele assignment UI for collectors:** not implementable from the session
  alone (backend returns the kebele authoritatively); left to a future phase.