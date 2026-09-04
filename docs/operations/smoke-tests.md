# Smoke Test Suite

## Authentication
- Login with valid credentials
- Failed login with invalid credentials (generic error, no lock state leaked)
- Login blocked on locked account (returns 401, not 429)
- Session invalidated after password change
- Logout destroys session

## Authorization
- Admin sees all resources across all kebeles/zones
- Kebele Admin sees only own kebele's data; cannot access other kebele data
- Leader sees only own zone's data; cannot access other zone data
- Viewer reads-only; write operations (POST/PUT/DELETE) rejected with 403
- IDOR prevention: `:id` endpoints scope to authenticated user's kebele/zone
- `/me` endpoint returns current user based on session, not bypassable

## Kebele (9-kebele model)
- Admin can manage all 9 kebeles
- Kebele Admin is locked to own kebele; cannot switch/create in other kebele
- K01/K02 distinction visible and enforced
- Collector assigned to kebele visible and enforceable

## Zones (108-safer-zone model)
- Leader sees only own zone's workers, inspections, businesses
- Collector sees only own kebele's data
- Zone boundaries enforced on create/edit

## Operations
### Workers
- Worker list scoped by role (admin/all, collector/kebele, leader/zone, viewer/none)
- Worker create: collector scoped to kebele; leader scoped to zone
- Worker update: collector checks kebele ownership; leader checks zone ownership
- Worker delete: collector checks kebele ownership
- `/:id/attendance`: collector sees only kebele workers; leader sees only zone workers
- `/:id/salary`: collector sees only kebele workers; leader sees only zone workers
- `POST /:id/salary`: leader scoped to own zone workers

### Attendance
- Bulk mark present/absent (5 records max per body)
- Individual attendance view scoped by role
- Present/Absent only (no fabricated statuses)

### Inspections
- Inspection create: latitude/longitude persists to PostGIS `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`
- Inspection list scoped by role
- Inspection `:id` endpoints scope by role
- Photo upload: magic-byte validation; 5MB q80; 1600px cap; EXIF orientation corrected; GPS EXIF stripped

### Zone Reports
- Draft → submitted → reviewed → approved workflow
- State machine transitions enforced
- Role transitions: draft_to_submitted (admin/collector/leader), submitted_to_reviewed (admin/collector), reviewed_to_approved (admin)
- `/:id/review` enforces role+kebele scope

### Payments
- Payment list scoped by role
- `POST /payments`: admin/collector/leader
- `PUT /:id`: admin/collector, no kebele scope (verified existing gap noted but not fixed in this phase)
- `POST /:id/salary`: collector scoped to kebele; leader scoped to zone
- Duplicate submission prevention (idempotency via webhook secret)

### Reports
- Monthly summary loads (admin/collector/leader scoped)
- CSV export works
- PDF export works
- XLSX export works
- Filter by month/year/status works
- Search with escaped wildcards ( `%` and `_` ) works

### GIS
- Map loads without errors
- Layer toggles (kebeles, safer zones, businesses, workers, inspections)
- Search box filters GeoJSON
- Click popups show name/kebele/zone/date/status only (no geometry details)
- Map/List view toggle works
- "Map data unavailable offline" banner shown when no geometry

## Finance
- Payment-related API endpoints respond (auth protected)
- No double-submission from retry/timeout

## Reports
### Report Loading
- Monthly summary loads
- Filters (month, year, status) work
- CSV export includes correct data
- PDF export generates
- XLSX export generates

### Filters
- Month filter works
- Year filter works
- Status filter works
- Search with escaped wildcards works
- debounce on search input (no rapid repeated fetches)

### CSV Export
- Correct headers
- Correct data types
- No server error on export
- Filename correct

### GIS
- Map loads without errors
- Layer toggles work (kebeles, safer zones, businesses, workers, inspections)
- Search box filters GeoJSON
- Click popups show name/kebele/zone/date/status only
- Map/List view toggle works
- "Map data unavailable offline" banner shown when no geometry

## Security Regression
### Authentication
- Login lockout returns uniform 401 (no 429/401 distinction)
- Session invalidation on password change
- No fabricated attendance statuses (Present/Absent only)
- No continuous GPS tracking (on-demand only)
- No TanStack Query introduced

### Authorization
- No IDOR via `:id` endpoints (collector/leader scoped)
- No cross-kebele business/inspection access
- No forged role/kebele/zone body accepted
- `/me` does not bypass authorization

### Input Validation
- Malformed IDs rejected (400)
- Date format YYYY-MM-DD enforced
- Pagination bounded (limit ≤ 200)
- Sorting allowlist (fixed server-side)
- Search with escaped wildcards
- Enum values validated on server

### Error Handling
- Production errors safe (no SQL, paths, stacks, secrets)
- 400/403/404/500 all return JSON with safe messages
- No stack traces in production error responses