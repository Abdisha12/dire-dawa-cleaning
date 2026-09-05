# Businesses Count Contract

## 1. KPI Name

**Businesses**

## 2. Definition

The Dashboard **Businesses** KPI counts the number of **active businesses** in the Dire Dawa Cleaning Department system, as determined by the backend `is_active=TRUE` field.

An active business is one where `is_active = TRUE` in the `businesses` PostgreSQL table. Businesses where `is_active = FALSE` are excluded.

## 2. Included Records

- Businesses with `is_active = TRUE`
- Businesses assigned to authorized kebeles/zones per the user's role

## 3. Excluded Records

- Businesses with `is_active = FALSE` (deactivated/inactive businesses)
- Businesses not authorized for the requesting user's role and scope

## 4. Scope

### Admin

- **All authorized businesses across Dire Dawa**
- Backend condition: No `kebeleId` or `saferZoneId` filter applied
- Query: `SELECT COUNT(*) FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id JOIN kebeles k ON k.id=sz.kebele_id WHERE b.is_active=TRUE`

### Kebele Admin

- **Businesses belonging to their assigned kebele**
- Backend condition: `k.id = assigned_kebele_id` (derived from `collector_id` in the `kebeles` table)
- Query includes: `AND k.id = $kebeleId` where `kebeleId` = `collector_id` lookup result
- If the collector has no assigned kebele, the count is `0` (empty result set per the API logic)

### Zone Leader

- **Businesses within their authorized operational scope**
- Backend condition: `sz.leader_id = currentUser.id` (the leader's assigned zone)
- If the leader has no assigned zone, the count follows the leader's empty-set logic per the API

## 5. Geographic Relationship

**Business → Safer Zone → Kebele**

- Each business has a `safer_zone_id` foreign key
- Each safer zone has a `kebele_id` foreign key
- The count propagates from business → zone → kebele for scoping
- The API enforces kebele scoping via: `JOIN kebeles k ON k.id=sz.kebele_id` + `AND k.id = $kebeleId`

## 6. Duplicate Handling

- The KPI counts **unique business entities** (by `business.id`)
- The backend `COUNT(*)` query on the `businesses` table naturally counts each row once
- No duplication from joins to safer_zones or kebeles because `COUNT(*)` counts rows from the business table
- If the API returns paginated `{data, total, page, pages}`, the KPI uses the `total` field as the authoritative count

## 7. Data Source

**Primary endpoint**: `GET /api/businesses?status=active`

- Backend query: `WHERE b.is_active=TRUE`
- With role/kebele scoping as defined in section 4
- The API supports both flat list (no pagination) returning `data: business[]` and paginated returning `{data, total, page, pages}`
- The KPI uses the `total` count from the paginated response, or the full array length if flat

**Fallback**: If the `status=active` parameter is omitted, the API returns all businesses (active and inactive). The KPI must always pass `status=active` to filter to active businesses only.

## 6. Pagination

The `/api/businesses` endpoint supports pagination with `page` and `limit` query parameters.

- Default limit: 50 businesses per page
- Maximum limit: 100 businesses per page

**The KPI must NOT** count only the current page of results.

- The KPI uses the `total` count from the API response (not `data.length` from the current page)
- If the API returns a flat array (no pagination metadata), the KPI uses `array.length`

## 7. Date Semantics

- The KPI represents a **current total** of active businesses
- No period-specific filtering (e.g., by `created_at`, `registered_at`)
- The `is_active` field is the authoritative filter, not date ranges
- If `is_active` is `TRUE`, the business is counted regardless of `created_at` age

## 8. Error Semantics

| Situation | KPI Display |
|-----------|-------------|
| Successful zero count | `0` |
| Successful positive count | `<number>` |
| Loading (request in flight) | `Loading…` |
| Backend/API failure (network, 500, etc.) | `Unavailable` |
| Authorization denies all access | `Unavailable` |

## 9. Security (Server-Authoritative Authorization)

The count must **never** be calculated by fetching all businesses into the browser and filtering there. The backend must always apply the scope filters.

### Admin

- Backend condition: No kebele/saferZone filter
- Query fragment: (no additional `AND` clauses for kebele/zone beyond the base JOIN)

### Kebele Admin

- Backend condition: `k.id = assigned_kebele_id`
- The `assigned_kebele_id` is derived by looking up `collector_id` in the `kebeles` table:
  ```sql
  SELECT id FROM kebeles WHERE collector_id = $1
  ```
- If no kebele is assigned to the collector, the count is `0`

### Zone Leader

- Backend condition: `sz.leader_id = currentUser.id`
- If the leader has no assigned zone, the count follows the leader's empty-set logic

### Never Trust Client

- The browser/Kebele selector must **never** be the security boundary
- A Kebele Admin selecting a different kebele in the UI must not change the count (the backend enforces the assigned kebele)
- A Zone Leader selecting a different zone in the UI must not change the count (the backend enforces the authorized zone)

## 10. Unresolved Questions

- **Zone Leader precise scope**: The existing API logic for leaders uses `sz.leader_id = currentUser.id` which references the leader's assigned zone. If a leader has no assigned zone (`leader_id` is null in the users table), the exact count behavior is documented as "leader's empty-set logic per the API" — this needs verification against actual user data.

- **Collector with no assigned kebele**: The API returns empty array `[]` with `total: 0` when a collector has no assigned kebele. This is documented but needs real-data verification.

## 11. Implementation Recommendation (for next task)

The smallest safe way to connect the Dashboard Businesses KPI:

1. **Frontend**: Call `api.getBusinesses({ status: "active" }, {})` from the Dashboard page
2. **Role scoping**: Pass `kebeleId` for Kebele Admins (`collector` role with assigned kebele) and `kebeleId` for Zone Leaders
3. **Count extraction**: Use the `total` field from the paginated API response, or `array.length` from the flat response
4. **Loading/error states**: Show `Loading…` while the request is in flight, `Unavailable` on error, `0` when the backend returns zero active businesses
5. **Never** fetch all businesses and filter in the browser — the backend must always apply the `is_active=TRUE` filter and role/kebele scoping

## Evidence (files used to establish this contract)

- `backend/routes/locations.js` — `/businesses` route handler (lines 136-214), specifically:
  - Line 144: `const status = (req.query.status || "").trim(); // active | inactive`
  - Line 189: `if (status === "active") baseSql += \`AND b.is_active=TRUE\``
  - Lines 151-171: Role-based kebele/saferZone scoping logic
  - Lines 202-210: COUNT(*) aggregation and paginated response with `total`
- `frontend-next/src/types/domain.ts` — `Business` interface, line 125-133:
  - `is_active: boolean` field
  - `safer_zone_id: number` relationship
  - `kebele_id?: number` relationship
- `frontend-next/src/lib/api.ts` — `getBusinesses` function, lines 151-156:
  - `GET /api/businesses?status=active` endpoint
  - Response type: `Business[] | {businesses: Business[]} | {data: Business[]; total; page; pages}`
- `frontend-next/src/app/(app)/dashboard/page.tsx` — current placeholder:
  - `<StatCard label="Businesses" value="—" sub="via /api/businesses" accent="orange" />`

## Validation

- All statements verified against actual code schema and routes
- No assumptions written as facts
- UNRESOLVED items explicitly listed (zone leader empty-set logic, collector-with-no-kebele)

## Commit

`docs: define businesses count contract`

No Dashboard implementation in this commit. This commit contains only the contract documentation.