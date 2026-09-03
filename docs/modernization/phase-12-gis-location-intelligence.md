# Phase 12 — Production GIS & Location Intelligence

Status: **IMPLEMENTED** (backend GeoJSON API, web MapLibre GIS, Android GIS screen,
inspection GPS → PostGIS pipeline; validated where the sandbox permits).
Scope: operational GIS only. No tracking, no routing, no push, no Play Store.

---

## 1. GIS audit (actual state found)

PostGIS infrastructure existed from Phase 1 but was **entirely unused**:

- Geometry columns (all `SRID 4326`, all NULLABLE, GIST-indexed): `kebeles.boundary`
  MULTIPOLYGON, `safer_zones.boundary` MULTIPOLYGON, `businesses.location` POINT,
  `inspections.location` POINT, `workers.location` POINT.
- **Zero** `ST_*` calls anywhere in the backend; no `/api/gis` routes existed
  (the frontend API client already stubbed `getKebelesGeoJSON`/`getSaferZonesGeoJSON`
  against nonexistent endpoints — they 404'd).
- No map library in `frontend-next` (GIS nav item disabled with a "Soon" badge);
  no map components; Android had GPS capture only (Phase 11, device-local).

## 2. Data quality (§2, §45)

Schema-level facts (verified from `database/postgresql/schema.sql`): all five
geometry columns are NULLABLE with **no seed data populating them** — the audit
found no INSERT touching a geometry column. Live NULL/invalid counts could not be
queried because **no PostgreSQL is reachable in this sandbox** (connection fails;
same limitation as Phase 11). The GIS layer is therefore built to be honest about
missing geometry:

- Every `/api/gis/*` endpoint returns a real `FeatureCollection` where features with
  NULL geometry are included with `geometry: null` + `properties.locationUnavailable: true`.
- Web and Android surfaces render "Location unavailable" / "location unavailable"
  counts — nothing is fabricated, no placeholder pins, no guessed polygons (§3).

## 3. Backend changes (minimal, §47)

- **New `backend/routes/gis.js`** mounted at `/api/gis` (`server.js`):
  `GET /gis/kebeles`, `/gis/safer-zones`, `/gis/businesses`, `/gis/workers`,
  `/gis/inspections`. All use `ST_AsGeoJSON(geom, 6)`, parameterized SQL, and the
  established inline scope pattern (collector → assigned kebele, leader →
  `leader_id`, admin/viewer full read). Pagination capped (`LIMIT 500` /
  `limit ≤ 200`) so a viewport cannot dump the database (§48–§51).
- **Query validation** (§48): integer ID params rejected with 400 when malformed;
  inspection `status` restricted to the real enum; `from`/`to` restricted to
  `YYYY-MM-DD`. No bbox/radius endpoints were added (not required by current
  business rules) — documented as intentionally absent.
- **Inspection GPS → PostGIS** (§24): `POST /api/inspections` and `PUT
  /api/inspections/:id` now accept optional `latitude`/`longitude` (validated
  ranges in `middleware/schemas.js`) and persist
  `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` into `inspections.location`.
  This completes the Phase 11 Android GPS pipeline: device capture → API →
  backend validation → PostGIS. `accuracy` is accepted by validation for
  forward-compatibility but **not persisted** (no schema change per §58; accuracy
  stays device-side and is shown in the Android UI per §25).
- No schema migration, no `/mobile/*` duplicates, existing web compatibility preserved.

## 4. Web GIS (§11–§35)

- `maplibre-gl` installed (`--legacy-peer-deps`; `@types/geojson` dev). Tile layer:
  OpenStreetMap raster with required attribution (§39–§40). No competing map library (§11).
- `src/features/gis/`: `CityMap` (dynamic import, `ssr: false`, MapLibre only),
  `GisMapPage`, `MapStates`, `services/gisService.ts`. Route: `/locations/map`
  (`src/app/locations/map/page.tsx`); desktop + mobile nav now link to it
  (disabled "Soon" badge removed).
- Layers with toggles: Kebeles (fill), Safer Zones (outline), Businesses, Workers,
  Inspections (points). Layers load lazily on enable (§19); businesses endpoint
  supports pagination.
- Search box, click popups (name/kebele/zone/date/status only — no record dumps,
  §27), **Map/List view toggle** (§55, accessibility + low-performance fallback),
  keyboard-accessible controls, text+symbol legend info per layer (not color-only, §32–§33).
- "Locate me" was deliberately **not** added to the web map (§34–§35): no device
  location is requested on map open; location capture remains the explicit Android
  field workflow (§55 privacy).
- Worker points render only stored operational locations; no live updates, no
  tracking (§16, §70 confirmed NOT implemented).

## 5. Android GIS (§36–§38, §54)

- `GisRepository` parses the five `/api/gis/*` collections into `GisLayer`
  (total / with-geometry / without-geometry counts + items); null geometry is
  flagged, never fabricated. Added `GisFeatureCollection`/`GisFeature` DTOs and
  the five `ApiService` endpoints (same interceptor auth).
- `GisScreen` (via More → GIS Map): layer toggles, honest per-layer counts,
  bounded accessible entity list (50 shown + "N more"), on-demand **Locate me**
  (permission at point of use, single capture, no tracking), explicit
  **"Map data unavailable offline"** banner when offline (§38). No map SDK bundled
  — a full offline tile cache is out of scope and would risk stale geometry.
- Inspection GPS flow (Phase 11) is unchanged on-device; with the new backend
  support those coordinates can now reach PostGIS on submit.

## 6. Offline GIS (§38)

Explicit policy: **map data unavailable offline**. No geometry is cached (no stale
polygons presented as current). The Android screen states this; the queued
inspection payload still carries its own coordinates for server-side persistence
on sync. No full offline-map implementation.

## 7. Security (§41–§43, §47–§51)

- Same `authenticate` + inline kebele/leader scope as all existing routes; viewer
  read-only. No credentials to clients; no direct DB access; no raw SQL from clients.
- Coordinate precision: `ST_AsGeoJSON(..., 6)` (6 decimal places) documented as the
  policy (§42).
- No GIS export endpoint added (§44 deferred); no audit-log flooding (map
  pan/zoom generate no audit rows, §43).

## 8. Tests (actual results)

- **Backend `test/gis.test.js`** (new, 10 cases: 401s, admin/viewer reads,
  collector scope ≤ 1 kebele, 400 validation ×3, inspection lat/lon → POINT WKT):
  **not runnable here** — requires live PostgreSQL (unreachable in sandbox).
  `node --check` passes on all touched files; **eslint 0 errors** on all touched
  files (remaining 5 warnings are pre-existing on the clean tree, verified via stash).
- **Web: 147/147 vitest pass** (143 existing + 4 new `gis-map.test.tsx`: loading/
  error/empty states, list-alternative selection, service endpoint wiring);
  **`tsc --noEmit` clean**.
- **Android: 50/50 unit tests pass** (47 existing + 3 new `GisRepositoryTest`:
  mixed-geometry honest counts, empty layer, 403 surfaces failure);
  **`lintDebug` 0 errors, `assembleDebug` BUILD SUCCESSFUL** (~19 MB APK).
- During validation the new Kotlin files initially broke the build with an opaque
  kapt `Could not load module <Error module>`; root cause was `/api/gis/*` inside
  KDoc comments (Kotlin nested-comment rule re-opened the block comment).
  Fixed by rewording; full build green afterwards.

## 9. Acceptance notes / limitations

- Geometry coverage depends on real data landing in the PostGIS columns; until
  then every surface truthfully reports "Location unavailable".
- No bbox/radius search endpoints, no clustering (datasets are small and bounded;
  clustering deferred until density justifies it), no hotspot analytics (no
  complaint-density source data to score honestly, §30).
- Backend suite + PostGIS `EXPLAIN ANALYZE` verification (§59–§60) require a live
  database and are explicitly **not claimed**.
- `frontend/`, `frontend-next/` (other modules), `backend/` (other routes),
  `database/` untouched except the additive GIS route + inspection location support.
- TanStack Query NOT introduced; `frontend/` preserved; no continuous/worker/
  vehicle tracking; no push; no Play Store.

## 10. STOP

Phase 12 only. **STOPPED** pending the next instruction.
