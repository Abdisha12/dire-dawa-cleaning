// backend/routes/gis.js — GeoJSON endpoints for GIS/PostGIS layer (§8–§10)
// Returns ST_AsGeoJSON FeatureCollections with kebele/zone authorization.
// Every endpoint validates scope — a kebele admin cannot access another kebele's geography.
const express=require("express");
const db=require("../config/db");
const {authenticate}=require("../middleware/auth");
const router=express.Router();
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────

/** Parse an optional integer query param. Returns undefined when absent,
 *  a positive int when valid, or NaN-marker null-invalid via {invalid:true}. */
function parseIdParam(raw) {
  if (raw === null || raw === undefined || raw === "") return { value: undefined };
  const n = parseInt(String(raw), 10);
  if (!Number.isSafeInteger(n) || n <= 0) return { invalid: true };
  return { value: n };
}

// ── GET /api/gis/kebeles — GeoJSON FeatureCollection ─────────
router.get("/kebeles", async (req, res, next) => {
  try {
    let sql;
    const params = [];
    if (req.user.role === "collector") {
      // Collector sees only their assigned kebele boundary.
      sql = `SELECT k.id,k.code,k.name,
                    ST_AsGeoJSON(k.boundary,6) AS geojson
             FROM kebeles k WHERE k.collector_id=$1
             ORDER BY k.code`;
      params.push(req.user.id);
    } else if (req.user.role === "leader") {
      // Leader sees the kebele their safer zone belongs to.
      sql = `SELECT DISTINCT k.id,k.code,k.name,
                    ST_AsGeoJSON(k.boundary,6) AS geojson
             FROM kebeles k JOIN safer_zones sz ON sz.kebele_id=k.id
             WHERE sz.leader_id=$1 ORDER BY k.code`;
      params.push(req.user.id);
    } else {
      // Admin/viewer sees all kebeles (viewer = read-only).
      sql = `SELECT k.id,k.code,k.name,
                    ST_AsGeoJSON(k.boundary,6) AS geojson
             FROM kebeles k ORDER BY k.code`;
    }
    const result = await db.query(sql, params);
    const features = result.rows
      .filter(r => r.geojson !== null && r.geojson !== undefined)
      .map(r => ({
        type: "Feature",
        id: r.id,
        geometry: JSON.parse(r.geojson),
        properties: { id: r.id, code: r.code, name: r.name },
      }));
    // Also include null-geometry kebeles as features with null geometry
    // so the UI can show a list alternative.
    const nullFeatures = result.rows
      .filter(r => r.geojson === null || r.geojson === undefined)
      .map(r => ({
        type: "Feature",
        id: r.id,
        geometry: null,
        properties: { id: r.id, code: r.code, name: r.name, locationUnavailable: true },
      }));
    res.json({
      type: "FeatureCollection",
      features: [...features, ...nullFeatures],
    });
  } catch (err) { next(err); }
});

// ── GET /api/gis/safer-zones — GeoJSON FeatureCollection ─────
router.get("/safer-zones", async (req, res, next) => {
  try {
    const {kebeleId} = req.query;
    let idx = 1;
    const baseFrom = `FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id`;
    let where = `WHERE 1=1`;
    const whereParams = [];

    if (req.user.role === "leader") {
      where += ` AND sz.leader_id=$${idx}`; whereParams.push(req.user.id); idx++;
    } else if (req.user.role === "collector") {
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if (!assignedKebele) {
        return res.json({ type: "FeatureCollection", features: [] });
      }
      where += ` AND sz.kebele_id=$${idx}`; whereParams.push(assignedKebele); idx++;
    } else {
      const parsed = parseIdParam(kebeleId);
      if (parsed.invalid) return res.status(400).json({ error: "Invalid kebeleId" });
      if (parsed.value !== undefined) { where += ` AND sz.kebele_id=$${idx}`; whereParams.push(parsed.value); idx++; }
    }

    const sql = `SELECT sz.id,sz.name,sz.code,k.name AS kebele_name,k.code AS kebele_code,
                  ST_AsGeoJSON(sz.boundary,6) AS geojson
           ${baseFrom} ${where} ORDER BY k.code,sz.name`;

    const result = await db.query(sql, whereParams);
    const features = result.rows
      .filter(r => r.geojson !== null && r.geojson !== undefined)
      .map(r => ({
        type: "Feature",
        id: r.id,
        geometry: JSON.parse(r.geojson),
        properties: { id: r.id, name: r.name, code: r.code, kebeleName: r.kebele_name, kebeleCode: r.kebele_code },
      }));
    const nullFeatures = result.rows
      .filter(r => r.geojson === null || r.geojson === undefined)
      .map(r => ({
        type: "Feature",
        id: r.id,
        geometry: null,
        properties: { id: r.id, name: r.name, code: r.code, kebeleName: r.kebele_name, kebeleCode: r.kebele_code, locationUnavailable: true },
      }));
    res.json({ type: "FeatureCollection", features: [...features, ...nullFeatures] });
  } catch (err) { next(err); }
});

// ── GET /api/gis/businesses — GeoJSON FeatureCollection ──────
router.get("/businesses", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "0"), 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "0"), 10) || 0));
    const hasPagination = page > 0 && limit > 0;
    const {saferZoneId, kebeleId, search} = req.query;

    let baseSql = `FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id JOIN kebeles k ON k.id=sz.kebele_id WHERE 1=1`;
    const whereParams = [];
    let idx = 1;

    if (req.user.role === "leader") {
      baseSql += ` AND sz.leader_id=$${idx}`; whereParams.push(req.user.id); idx++;
    } else if (req.user.role === "collector") {
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if (!assignedKebele) {
        return res.json({ type: "FeatureCollection", features: [] });
      }
      baseSql += ` AND k.id=$${idx}`; whereParams.push(assignedKebele); idx++;
      const parsedZone = parseIdParam(saferZoneId);
      if (parsedZone.invalid) return res.status(400).json({ error: "Invalid saferZoneId" });
      if (parsedZone.value !== undefined) { baseSql += ` AND b.safer_zone_id=$${idx}`; whereParams.push(parsedZone.value); idx++; }
    } else {
      const parsedZone = parseIdParam(saferZoneId);
      if (parsedZone.invalid) return res.status(400).json({ error: "Invalid saferZoneId" });
      if (parsedZone.value !== undefined) { baseSql += ` AND b.safer_zone_id=$${idx}`; whereParams.push(parsedZone.value); idx++; }
      const parsedKebele = parseIdParam(kebeleId);
      if (parsedKebele.invalid) return res.status(400).json({ error: "Invalid kebeleId" });
      if (parsedKebele.value !== undefined) { baseSql += ` AND k.id=$${idx}`; whereParams.push(parsedKebele.value); idx++; }
    }
    if (search) {
      baseSql += ` AND (b.name ILIKE $${idx} OR b.owner_name ILIKE $${idx})`;
      whereParams.push(`%${search}%`); idx++;
    }

    const selectCols = `b.id,b.name,b.owner_name,b.type,b.is_active,b.safer_zone_id,
                        sz.name AS safer_zone_name,k.name AS kebele_name,
                        ST_AsGeoJSON(b.location,6) AS geojson`;

    if (!hasPagination) {
      const sql = `SELECT ${selectCols} ${baseSql} ORDER BY k.code,sz.name,b.name`;
      const result = await db.query(sql, whereParams);
      return sendGeoJSON(res, result.rows, "Business", "business");
    }
    const countSql = `SELECT COUNT(*)::int AS total ${baseSql}`;
    const countRes = await db.query(countSql, whereParams);
    const total = countRes.rows[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const dataSql = `SELECT ${selectCols} ${baseSql} ORDER BY k.code,sz.name,b.name LIMIT $${idx} OFFSET $${idx+1}`;
    const dataParams = [...whereParams, limit, offset];
    const result = await db.query(dataSql, dataParams);
    return res.json({
      type: "FeatureCollection",
      total, page, pages,
      features: buildFeatures(result.rows, "Business"),
    });
  } catch (err) { next(err); }
});

// ── GET /api/gis/workers — GeoJSON FeatureCollection ─────────
router.get("/workers", async (req, res, next) => {
  try {
    const {saferZoneId} = req.query;
    let baseSql = `FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id LEFT JOIN kebeles k ON k.id=sz.kebele_id WHERE w.is_active=TRUE`;
    const params = [];
    let idx = 1;

    if (req.user.role === "leader") {
      baseSql += ` AND sz.leader_id=$${idx}`; params.push(req.user.id); idx++;
    } else if (req.user.role === "collector") {
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if (!assignedKebele) return res.json({ type: "FeatureCollection", features: [] });
      baseSql += ` AND k.id=$${idx}`; params.push(assignedKebele); idx++;
      const parsedZoneW = parseIdParam(saferZoneId);
      if (parsedZoneW.invalid) return res.status(400).json({ error: "Invalid saferZoneId" });
      if (parsedZoneW.value !== undefined) { baseSql += ` AND w.safer_zone_id=$${idx}`; params.push(parsedZoneW.value); idx++; }
    } else {
      const parsedZoneW = parseIdParam(saferZoneId);
      if (parsedZoneW.invalid) return res.status(400).json({ error: "Invalid saferZoneId" });
      if (parsedZoneW.value !== undefined) { baseSql += ` AND w.safer_zone_id=$${idx}`; params.push(parsedZoneW.value); idx++; }
    }

    const sql = `SELECT w.id,w.full_name,w.is_active,w.safer_zone_id,
                        sz.name AS safer_zone_name,k.name AS kebele_name,
                        ST_AsGeoJSON(w.location,6) AS geojson
                 ${baseSql} ORDER BY w.full_name LIMIT 500`;
    const result = await db.query(sql, params);
    sendGeoJSON(res, result.rows, "Worker", "worker");
  } catch (err) { next(err); }
});

// ── GET /api/gis/inspections — GeoJSON FeatureCollection ─────
router.get("/inspections", async (req, res, next) => {
  try {
    const {kebeleId, zoneId, status, from, to} = req.query;
    let baseSql = `FROM inspections i JOIN kebeles k ON k.id=i.kebele_id LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (req.user.role === "leader") {
      baseSql += ` AND sz.leader_id=$${idx}`; params.push(req.user.id); idx++;
    } else if (req.user.role === "collector") {
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if (!assignedKebele) return res.json({ type: "FeatureCollection", features: [] });
      baseSql += ` AND i.kebele_id=$${idx}`; params.push(assignedKebele); idx++;
      const parsedZoneI = parseIdParam(zoneId);
      if (parsedZoneI.invalid) return res.status(400).json({ error: "Invalid zoneId" });
      if (parsedZoneI.value !== undefined) { baseSql += ` AND i.safer_zone_id=$${idx}`; params.push(parsedZoneI.value); idx++; }
    } else {
      const parsedKebeleI = parseIdParam(kebeleId);
      if (parsedKebeleI.invalid) return res.status(400).json({ error: "Invalid kebeleId" });
      if (parsedKebeleI.value !== undefined) { baseSql += ` AND i.kebele_id=$${idx}`; params.push(parsedKebeleI.value); idx++; }
      const parsedZoneI = parseIdParam(zoneId);
      if (parsedZoneI.invalid) return res.status(400).json({ error: "Invalid zoneId" });
      if (parsedZoneI.value !== undefined) { baseSql += ` AND i.safer_zone_id=$${idx}`; params.push(parsedZoneI.value); idx++; }
    }
    if (status) {
      if (!["active", "warning", "danger"].includes(String(status))) {
        return res.status(400).json({ error: "Invalid status" });
      }
      baseSql += ` AND i.status=$${idx}`; params.push(status); idx++;
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (from) {
      if (!dateRe.test(String(from))) return res.status(400).json({ error: "Invalid from date" });
      baseSql += ` AND i.date>=$${idx}`; params.push(from); idx++;
    }
    if (to) {
      if (!dateRe.test(String(to))) return res.status(400).json({ error: "Invalid to date" });
      baseSql += ` AND i.date<=$${idx}`; params.push(to); idx++;
    }

    const sql = `SELECT i.id,i.date,i.status,i.notes,i.kebele_id,i.safer_zone_id,
                        k.name AS kebele_name,sz.name AS zone_name,
                        ST_AsGeoJSON(i.location,6) AS geojson
                 ${baseSql} ORDER BY i.date DESC LIMIT 500`;
    const result = await db.query(sql, params);
    sendGeoJSON(res, result.rows, "Inspection", "inspection");
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────

function buildFeatures(rows, entityType) {
  const hasGeo = rows.filter(r => r.geojson !== null && r.geojson !== undefined).map(r => ({
    type: "Feature",
    id: r.id,
    geometry: JSON.parse(r.geojson),
    properties: mapProps(r, entityType),
  }));
  const nullGeo = rows.filter(r => r.geojson === null || r.geojson === undefined).map(r => ({
    type: "Feature",
    id: r.id,
    geometry: null,
    properties: { ...mapProps(r, entityType), locationUnavailable: true },
  }));
  return [...hasGeo, ...nullGeo];
}

function mapProps(row, entityType) {
  const base = { id: row.id, entityType };
  switch (entityType) {
    case "Business":
      return { ...base, name: row.name, ownerName: row.owner_name, type: row.type,
               isActive: row.is_active, saferZoneId: row.safer_zone_id,
               saferZoneName: row.safer_zone_name, kebeleName: row.kebele_name };
    case "Worker":
      return { ...base, fullName: row.full_name, isActive: row.is_active,
               saferZoneId: row.safer_zone_id, saferZoneName: row.safer_zone_name,
               kebeleName: row.kebele_name };
    case "Inspection":
      return { ...base, date: row.date, status: row.status, notes: row.notes,
               kebeleId: row.kebele_id, saferZoneId: row.safer_zone_id,
               kebeleName: row.kebele_name, zoneName: row.zone_name };
    case "Kebele":
      return { ...base, code: row.code, name: row.name };
    default:
      return base;
  }
}

function sendGeoJSON(res, rows, entityType, _type) {
  res.json({
    type: "FeatureCollection",
    features: buildFeatures(rows, entityType),
  });
}

module.exports = router;