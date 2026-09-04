// backend/routes/analytics.js — Advanced Analytics & Metrics
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const router = express.Router();
router.use(authenticate);

// Helper for zone/leader filter — returns { clause, param } for parameterized queries
function leaderZoneFilter(req, offset = 0) {
  if (req.user.role === "leader") {
    return { clause: ` AND sz.leader_id = $${offset + 1}`, param: req.user.id };
  }
  return { clause: "", param: null };
}

function filterClause(req, offset = 0) {
  const f = leaderZoneFilter(req, offset);
  return { clause: f.clause, params: f.param ? [f.param] : [] };
}

// GET /api/analytics/attendance — attendance rate metrics
router.get("/attendance", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);
    const { clause: filter, params: filterParams } = filterClause(req, 2);

    // Overall attendance rate
    const overallResult = await db.query(
      `SELECT COUNT(*) AS total_records,
              SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.present=FALSE THEN 1 ELSE 0 END) AS absent_count,
              SUM(COALESCE(a.bonus,0)) AS total_bonus
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       LEFT JOIN safer_zones sz ON sz.id = w.safer_zone_id
       WHERE a.date BETWEEN $1 AND $2${filter}`,
      [first, last, ...filterParams]
    );
    const overall = overallResult.rows[0];

    // By Zone attendance breakdown
    const byZoneResult = await db.query(
      `SELECT sz.name AS zone_name, k.name AS kebele_name,
              COUNT(a.id) AS total_records,
              SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.present=FALSE THEN 1 ELSE 0 END) AS absent_count,
              ROUND(SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id),0) * 100, 1) AS rate
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       JOIN safer_zones sz ON sz.id = w.safer_zone_id
       JOIN kebeles k ON k.id = sz.kebele_id
       WHERE a.date BETWEEN $1 AND $2${filter}
       GROUP BY sz.id ORDER BY rate DESC`,
      [first, last, ...filterParams]
    );
    const byZone = byZoneResult.rows;

    const totalRec = overall.total_records || 0;
    const presentRec = overall.present_count || 0;
    const attendanceRate = totalRec ? Math.round((presentRec / totalRec) * 100) : 0;

    res.json({
      summary: {
        totalRecords: totalRec,
        presentCount: presentRec,
        absentCount: overall.absent_count || 0,
        totalBonus: overall.total_bonus || 0,
        attendanceRate
      },
      byZone
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/payments — payment method breakdown & target vs collected
router.get("/payments", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const { clause: filter, params: filterParams } = filterClause(req, 2);

    // By payment method breakdown
    const byMethodResult = await db.query(
      `SELECT p.method, COUNT(*) AS count, SUM(p.amount) AS total
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN safer_zones sz ON sz.id = b.safer_zone_id
       WHERE p.year = $1 AND p.month = $2 AND p.status = 'paid'${filter}
       GROUP BY p.method`,
      [y, m, ...filterParams]
    );
    const byMethod = byMethodResult.rows;

    // Status breakdown (paid, pending, overdue)
    const byStatusResult = await db.query(
      `SELECT p.status, COUNT(*) AS count, SUM(p.amount) AS total
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN safer_zones sz ON sz.id = b.safer_zone_id
       WHERE p.year = $1 AND p.month = $2${filter}
       GROUP BY p.status`,
      [y, m, ...filterParams]
    );
    const byStatus = byStatusResult.rows;

    res.json({ byMethod, byStatus });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/inspections — cleanliness & inspection metrics
router.get("/inspections", async (req, res, next) => {
  try {
    const from =
      req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const { clause: filter, params: filterParams } = filterClause(req, 2);

    const statusDistResult = await db.query(
      `SELECT i.status, COUNT(*) AS count
       FROM inspections i
       LEFT JOIN safer_zones sz ON sz.id = i.safer_zone_id
       WHERE i.date BETWEEN $1 AND $2${filter}
       GROUP BY i.status`,
      [from, to, ...filterParams]
    );
    const statusDist = statusDistResult.rows;

    const byZoneResult = await db.query(
      `SELECT sz.name AS zone_name,
              COUNT(i.id) AS total_inspections,
              SUM(CASE WHEN i.status='active' THEN 1 ELSE 0 END) AS active_count,
              SUM(CASE WHEN i.status='warning' THEN 1 ELSE 0 END) AS warning_count,
              SUM(CASE WHEN i.status='danger' THEN 1 ELSE 0 END) AS danger_count
       FROM inspections i
       JOIN safer_zones sz ON sz.id = i.safer_zone_id
       WHERE i.date BETWEEN $1 AND $2${filter}
       GROUP BY sz.id ORDER BY total_inspections DESC`,
      [from, to, ...filterParams]
    );
    const byZone = byZoneResult.rows;

    res.json({ statusDist, byZone });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/zones — Zone performance composite leaderboard
router.get("/zones", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const { clause: filter, params: filterParams } = filterClause(req, 6);

    const rowsResult = await db.query(
      `SELECT sz.id AS zone_id, sz.name AS zone_name, k.name AS kebele_name, u.full_name AS leader_name,
              COALESCE(b_stats.total_target, 0) AS total_target,
              COALESCE(p_stats.total_collected, 0) AS total_collected,
              ROUND(COALESCE(p_stats.total_collected, 0) / NULLIF(b_stats.total_target, 0) * 100, 1) AS collection_rate,
              COALESCE(w_stats.worker_count, 0) AS worker_count,
              COALESCE(a_stats.attendance_rate, 0) AS attendance_rate,
              COALESCE(i_stats.active_inspections, 0) AS active_inspections
       FROM safer_zones sz
       JOIN kebeles k ON k.id = sz.kebele_id
       LEFT JOIN users u ON u.id = sz.leader_id
       LEFT JOIN (
         SELECT safer_zone_id, SUM(monthly_target) AS total_target FROM businesses GROUP BY safer_zone_id
       ) b_stats ON b_stats.safer_zone_id = sz.id
       LEFT JOIN (
         SELECT b.safer_zone_id, SUM(p.amount) AS total_collected
         FROM payments p JOIN businesses b ON b.id = p.business_id
         WHERE p.year = $1 AND p.month = $2 AND p.status = 'paid'
         GROUP BY b.safer_zone_id
       ) p_stats ON p_stats.safer_zone_id = sz.id
       LEFT JOIN (
         SELECT safer_zone_id, COUNT(*) AS worker_count FROM workers WHERE is_active = TRUE GROUP BY safer_zone_id
       ) w_stats ON w_stats.safer_zone_id = sz.id
       LEFT JOIN (
         SELECT w.safer_zone_id,
                ROUND(SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) / COUNT(a.id) * 100, 1) AS attendance_rate
         FROM attendance a JOIN workers w ON w.id = a.worker_id
         WHERE EXTRACT(MONTH FROM a.date) = $3 AND EXTRACT(YEAR FROM a.date) = $4
         GROUP BY w.safer_zone_id
       ) a_stats ON a_stats.safer_zone_id = sz.id
       LEFT JOIN (
         SELECT safer_zone_id, COUNT(*) AS active_inspections FROM inspections
         WHERE status = 'active' AND EXTRACT(MONTH FROM date) = $5 AND EXTRACT(YEAR FROM date) = $6
         GROUP BY safer_zone_id
       ) i_stats ON i_stats.safer_zone_id = sz.id
       WHERE 1=1${filter}
       ORDER BY collection_rate DESC, attendance_rate DESC`,
      [y, m, m, y, m, y, ...filterParams]
    );
    const rows = rowsResult.rows;

    // Calculate composite score for ranking
    const leaderboard = rows
      .map((r) => {
        const colScore = Math.min(parseFloat(r.collection_rate) || 0, 100);
        const attScore = parseFloat(r.attendance_rate) || 0;
        const compositeScore = Math.round(colScore * 0.6 + attScore * 0.4);
        return { ...r, compositeScore };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);

    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/trends — 6-month comparative trend
router.get("/trends", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const { clause: filter, params: filterParams } = filterClause(req, 1);

    const monthlyCollectionsResult = await db.query(
      `SELECT p.month, SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END) AS collected,
              SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END) AS pending,
              SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END) AS overdue
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN safer_zones sz ON sz.id = b.safer_zone_id
       WHERE p.year = $1${filter}
       GROUP BY p.month ORDER BY p.month`,
      [y, ...filterParams]
    );
    const monthlyCollections = monthlyCollectionsResult.rows;

    const monthlyAttendanceResult = await db.query(
      `SELECT EXTRACT(MONTH FROM a.date) AS month,
              ROUND(SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) / COUNT(a.id) * 100, 1) AS attendance_rate
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       JOIN safer_zones sz ON sz.id = w.safer_zone_id
       WHERE EXTRACT(YEAR FROM a.date) = $1${filter}
       GROUP BY EXTRACT(MONTH FROM a.date) ORDER BY month`,
      [y, ...filterParams]
    );
    const monthlyAttendance = monthlyAttendanceResult.rows;

    res.json({ monthlyCollections, monthlyAttendance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
