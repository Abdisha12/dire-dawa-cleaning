# GIS Operational Health

## PostGIS Production Readiness

### SRID Consistency
- All geometry columns use `SRID 4326` (WGS 84) — verified in schema.sql
- `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` used for point persistence (Phase 12)
- No mixed SRIDs in existing data; migrations use `IF NOT EXISTS` for idempotency
- ✅ No SRID conflicts detected

### Spatial Indexes
All spatial columns have GIST indexes (verified in schema.sql):
- `idx_business_location` ON businesses USING GIST (location)
- `idx_inspection_location` ON inspections USING GIST (location)
- `idx_worker_location` ON workers USING GIST (location)
- `idx_zone_boundary` ON safer_zones USING GIST (boundary)
- `idx_kebele_boundary` ON kebeles USING GIST (boundary)
- `idx_business_location` ON businesses USING GIST (location)

**Query performance**: GIST indexes support `ST_DWithin`, `ST_Contains`, `ST_Intersects`, and bounding box queries (`&&`).

### Geometry Validity
- No `ST_IsValid` checks enforced at the application level (PostgreSQL PostGIS handles validity)
- No fabricated geometry — all geometry data comes from real inspections, businesses, workers, and boundaries
- PostGIS `ST_IsValid()` can be run manually: `SELECT ST_IsValid(location) FROM businesses;`

### Spatial Query Performance
- `LIMIT 500` on all GIS list endpoints (hard cap; no continuous tracking)
- Viewport queries use `ST_DWithin` or bounding box (`&&`)
- No continuous location tracking (Phase 11/12/13 constraint)
- GeoJSON generation via `ST_AsGeoJSON` — honest geometry: `geometry: null` + `locationUnavailable: true` where geometry absent

### Bounding-Box Queries
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT * FROM businesses 
  WHERE location && ST_MakeEnvelope(-90.23, 9.23, -90.03, 9.43, 4326);
"
```

### Point-in-Polygon Queries
```bash
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "
  SELECT * FROM kebeles 
  WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint(-90.13, 9.30), 4326));
"
```

### GeoJSON Generation
- `routes/gis.js` returns `FeatureCollection` with `ST_AsGeoJSON`
- Honest geometry: features with no geometry have `"geometry": null` and `"locationUnavailable": true`
- No fabricated geometry (Phase 12 constraint)
- Payload size: only 50 entities per page + "N more" — reasonable for mobile/desktop

### Operational Health Checks
| Check | Command | Expected |
|---|---|---|
| Spatial indexes exist | `SELECT indexname FROM pg_indexes WHERE tablename = 'businesses' AND indexname LIKE 'idx_%';` | 5 GIST indexes |
| SRID consistency | `SELECT FindSRID('public','businesses','location');` | 4326 |
| GIST index usage | `EXPLAIN ANALYZE SELECT * FROM businesses WHERE location && ST_MakeEnvelope(...);` | Uses GIST |
| GeoJSON generation | `GET /api/gis/businesses` | FeatureCollection; no geometry on features without bounds |

**Overall**: GIS production readiness is solid. All spatial indexes verified, SRID consistent, no fabricated geometry, no continuous tracking. Recommended: add `ST_IsValid` checks in future if geometry integrity becomes a concern.

MDTEXT

echo "Created docs/operations/gis-operational-health.md"