// backend/routes/complaints.js — Community Complaints API (P1-2)
// Modeled on the zone-reports pattern: server-authoritative kebele/zone scoping,
// a status state machine, Zod validation, and full audit trail.
// Complaints are community-reported cleanliness issues attached to a safer zone,
// so every read/write is isolated by role scope (admin/viewer = city, collector =
// assigned kebele, leader = own zone). No client-side filtering is the boundary.
const express = require("express");
const db = require("../config/db");
const audit = require("../services/auditService");
const notifService = require("../services/notificationService");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const router = express.Router();
router.use(authenticate);

// ── Complaint lifecycle: new → in_progress → resolved (monotonic) ──
const STATUS_ORDER = { new: 0, in_progress: 1, resolved: 2 };

function canTransition(from, to) {
  return STATUS_ORDER[to] !== undefined && STATUS_ORDER[to] > STATUS_ORDER[from];
}

const SELECT_CLAUSE =
  "SELECT c.*, sz.name AS zone_name, k.name AS kebele_name, k.code AS kebele_code, " +
  "u.full_name AS created_by_name, a.full_name AS assigned_name, r.full_name AS resolved_by_name, " +
  "sz.leader_id AS zone_leader_id, k.id AS kebele_id";

const FROM_CLAUSE =
  " FROM complaints c JOIN safer_zones sz ON sz.id=c.safer_zone_id " +
  "JOIN kebeles k ON k.id=sz.kebele_id " +
  "LEFT JOIN users u ON u.id=c.created_by " +
  "LEFT JOIN users a ON a.id=c.assigned_to " +
  "LEFT JOIN users r ON r.id=c.resolved_by";

async function assignedKebeleId(userId) {
  const r = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [userId]);
  return r.rows.length ? r.rows[0].id : null;
}

// True 403 (out of scope) vs 404 (missing) for single-record operations.
async function assertScope(req, row) {
  if (req.user.role === "leader") {
    if (row.zone_leader_id !== req.user.id) return { ok: false, status: 403, error: "Not your zone" };
  } else if (req.user.role === "collector") {
    const kebeleId = await assignedKebeleId(req.user.id);
    if (!kebeleId) return { ok: false, status: 403, error: "No assigned kebele" };
    if (row.kebele_id !== kebeleId) return { ok: false, status: 403, error: "Not your kebele" };
  }
  return { ok: true };
}

// Appends the scope clause + params to the caller's sql/params arrays.
function addScopeClause(req, sql, params, collectorKebeleId) {
  if (req.user.role === "leader") {
    sql.push(` AND sz.leader_id=$${params.length + 1}`);
    params.push(req.user.id);
  } else if (req.user.role === "collector") {
    if (!collectorKebeleId) sql.push(" AND FALSE");
    else {
      sql.push(` AND k.id=$${params.length + 1}`);
      params.push(collectorKebeleId);
    }
  }
  return sql;
}

// GET /api/complaints — role-scoped list with status/kebele/zone/search filters.
// No pagination params → full array; with pagination → { data, total, page, pages }.
router.get("/", validate(schemas.complaintsListQuery, "query"), async (req, res, next) => {
  try {
    const { status, kebeleId, zoneId, search } = req.query;
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = hasPagination ? Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1) : 1;
    const limit = hasPagination ? Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50)) : 50;

    const collectorKebeleId = req.user.role === "collector" ? await assignedKebeleId(req.user.id) : null;

    const clauses = ["WHERE 1=1"];
    const params = [];
    addScopeClause(req, clauses, params, collectorKebeleId);
    if (status) {
      clauses.push(` AND c.status=$${params.length + 1}`);
      params.push(status);
    }
    // kebeleId is a pure filter — only honoured for city-wide roles; scoped roles
    // are already limited by addScopeClause and must not widen visibility.
    if (kebeleId && (req.user.role === "admin" || req.user.role === "viewer")) {
      clauses.push(` AND k.id=$${params.length + 1}`);
      params.push(kebeleId);
    }
    if (zoneId) {
      clauses.push(` AND c.safer_zone_id=$${params.length + 1}`);
      params.push(zoneId);
    }
    if (search) {
      clauses.push(` AND (c.title ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1} OR COALESCE(c.reporter_name,'') ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const whereSql = clauses.join(" ");
    const orderSql = " ORDER BY c.created_at DESC";

    if (!hasPagination) {
      const result = await db.query(`${SELECT_CLAUSE}${FROM_CLAUSE} ${whereSql}${orderSql}`, params);
      return res.json(result.rows);
    }

    const countRes = await db.query(`SELECT COUNT(*)::int AS total${FROM_CLAUSE} ${whereSql}`, params);
    const total = countRes.rows[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const dataResult = await db.query(
      `${SELECT_CLAUSE}${FROM_CLAUSE} ${whereSql}${orderSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, total, page, pages });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/summary — scoped counts by status (must precede /:id).
router.get("/summary", async (req, res, next) => {
  try {
    const collectorKebeleId = req.user.role === "collector" ? await assignedKebeleId(req.user.id) : null;
    const clauses = ["WHERE 1=1"];
    const params = [];
    addScopeClause(req, clauses, params, collectorKebeleId);
    const result = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE c.status='new') AS new_count,
              COUNT(*) FILTER (WHERE c.status='in_progress') AS in_progress_count,
              COUNT(*) FILTER (WHERE c.status='resolved') AS resolved_count
       FROM complaints c JOIN safer_zones sz ON sz.id=c.safer_zone_id
       JOIN kebeles k ON k.id=sz.kebele_id ${clauses.join(" ")}`,
      params
    );
    const row = result.rows[0] || {};
    res.json({
      total: Number(row.total) || 0,
      new: Number(row.new_count) || 0,
      in_progress: Number(row.in_progress_count) || 0,
      resolved: Number(row.resolved_count) || 0
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id — single, role-scoped.
router.get("/:id", validate(schemas.complaintParams), async (req, res, next) => {
  try {
    const result = await db.query(`${SELECT_CLAUSE}${FROM_CLAUSE} WHERE c.id=$1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    const row = result.rows[0];
    const scope = await assertScope(req, row);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints — staff file a community complaint (admin/collector/leader).
router.post("/", requireRole("admin", "collector", "leader"), validate(schemas.createComplaint), async (req, res, next) => {
  try {
    const { title, description, category, saferZoneId, reporterName, reporterPhone } = req.body;
    const zoneResult = await db.query("SELECT id, kebele_id, leader_id FROM safer_zones WHERE id=$1", [saferZoneId]);
    if (!zoneResult.rows.length) return res.status(400).json({ error: "Unknown saferZoneId" });
    const zone = zoneResult.rows[0];

    if (req.user.role === "leader" && zone.leader_id !== req.user.id) {
      return res.status(403).json({ error: "Not your zone" });
    }
    if (req.user.role === "collector") {
      const kebeleId = await assignedKebeleId(req.user.id);
      if (!kebeleId || zone.kebele_id !== kebeleId) return res.status(403).json({ error: "Not your kebele" });
    }

    const r = await db.query(
      `INSERT INTO complaints (title, description, category, safer_zone_id, reporter_name, reporter_phone, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [title, description, category, saferZoneId, reporterName || null, reporterPhone || null, req.user.id]
    );
    audit.log(req, "CREATE", "complaint", r.rows[0].id, null, { title, category, saferZoneId, status: "new" });
    res.status(201).json({ id: r.rows[0].id, status: "new" });
  } catch (err) {
    next(err);
  }
});

// PUT /api/complaints/:id/status — transition new → in_progress → resolved.
router.put(
  "/:id/status",
  requireRole("admin", "collector", "leader"),
  validate(schemas.updateComplaintStatus),
  async (req, res, next) => {
    try {
      const { status, resolutionNotes, assignedTo } = req.body;
      const result = await db.query(`${SELECT_CLAUSE}${FROM_CLAUSE} WHERE c.id=$1`, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      const row = result.rows[0];

      const scope = await assertScope(req, row);
      if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

      if (!canTransition(row.status, status)) {
        return res.status(400).json({ error: `Invalid transition: ${row.status} → ${status}` });
      }

      const resolvedAt = status === "resolved" ? new Date() : row.resolved_at;
      const resolvedBy = status === "resolved" ? req.user.id : row.resolved_by;
      const finalNotes = resolutionNotes !== undefined ? resolutionNotes : row.resolution_notes;
      const finalAssignee = assignedTo !== undefined ? assignedTo : row.assigned_to;

      await db.query(
        `UPDATE complaints SET status=$1, resolution_notes=$2, assigned_to=$3, resolved_by=$4, resolved_at=$5
         WHERE id=$6`,
        [status, finalNotes, finalAssignee, resolvedBy, resolvedAt, req.params.id]
      );
      audit.log(req, "UPDATE", "complaint", parseInt(req.params.id), { status: row.status }, { status, resolutionNotes, assignedTo });

      const notifyUserId = finalAssignee !== null && finalAssignee !== undefined ? finalAssignee : row.created_by;
      if (notifyUserId) {
        await notifService.notify(
          notifyUserId,
          "complaint_update",
          `Complaint ${status}: ${row.title}`,
          `Complaint “${row.title}” (${row.zone_name}) is now ${status.replace("_", " ")}.`,
          "/community/complaints"
        );
      }
      res.json({ message: "Updated", status });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/complaints/:id — admin only (audited cleanup).
router.delete("/:id", requireRole("admin"), validate(schemas.complaintParams), async (req, res, next) => {
  try {
    const oldResult = await db.query("SELECT id, title, status FROM complaints WHERE id=$1", [req.params.id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "Not found" });
    await db.query("DELETE FROM complaints WHERE id=$1", [req.params.id]);
    audit.log(req, "DELETE", "complaint", parseInt(req.params.id), oldResult.rows[0], null);
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;