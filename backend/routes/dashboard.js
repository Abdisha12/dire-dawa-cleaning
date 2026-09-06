// backend/routes/dashboard.js — Dashboard Operational Overview
// Role-aware, server-side aggregation for the Dashboard Operational Overview.
// Reuses the established SQL patterns from payments.js summary/dashboard and
// analytics.js, but scopes collectors by their assigned kebele (kebeles.collector_id)
// AND leaders by their zones (safer_zones.leader_id), so no role can read beyond
// its geographic scope. Admin/viewer are city-wide read-only.
// No data is fabricated: achievement is only computed when a monthly target exists;
// attendance rate is null when no records exist.
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const router = express.Router();
router.use(authenticate);

async function getCollectorKebeleId(userId) {
  const result = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

// Zone-level scope clause, parameterized. Returns { clause, params }.
// - leader: only their own zone(s) (sz.leader_id)
// - collector: only their assigned kebele's zones (sz.kebele_id); unassigned -> no data
// - admin/viewer: city-wide (no clause)
function zoneScope(req, collectorKebeleId, offset) {
  if (req.user.role === "leader") {
    return { clause: ` AND sz.leader_id=$${offset}`, params: [req.user.id] };
  }
  if (req.user.role === "collector") {
    if (!collectorKebeleId) return { clause: " AND FALSE", params: [] };
    return { clause: ` AND sz.kebele_id=$${offset}`, params: [collectorKebeleId] };
  }
  return { clause: "", params: [] };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// GET /api/dashboard/overview
router.get("/overview", validate(schemas.dashboardQuery, "query"), async (req, res, next) => {
  try {
    const y = Number(req.query.year) || new Date().getFullYear();
    const m = Number(req.query.month) || new Date().getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);

    const collectorKebeleId = req.user.role === "collector" ? await getCollectorKebeleId(req.user.id) : null;

    // ── 1. Revenue totals + overall target ─────────────────────────
    // Base table is businesses so the monthly target is complete even for
    // kebeles without payments in the period (mirrors payments.js byKebele).
    const revScope = zoneScope(req, collectorKebeleId, 3);
    const revenueResult = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS total_collected,
              COALESCE(SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END),0) AS total_pending,
              COALESCE(SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END),0) AS total_overdue,
              SUM(b.monthly_target) AS target
       FROM businesses b
       JOIN safer_zones sz ON sz.id=b.safer_zone_id
       LEFT JOIN payments p ON p.business_id=b.id AND p.month=$1 AND p.year=$2
       WHERE 1=1${revScope.clause}`,
      [y, m, ...revScope.params]
    );
    const rev = revenueResult.rows[0] || {};
    const collected = rev.total_collected != null ? Number(rev.total_collected) : 0;
    const pending = rev.total_pending != null ? Number(rev.total_pending) : 0;
    const overdue = rev.total_overdue != null ? Number(rev.total_overdue) : 0;
    const target = rev.target != null ? Number(rev.target) : null;
    const revenue = {
      totalCollected: String(collected),
      totalPending: String(pending),
      totalOverdue: String(overdue),
      target: target != null ? String(target) : null,
      achievementPct: target != null && target > 0 ? round1((collected / target) * 100) : null
    };

    // ── 2. Monthly collection trend (paid only, current year) ───────
    const monthScope = zoneScope(req, collectorKebeleId, 2);
    const monthlyResult = await db.query(
      `SELECT p.month, SUM(p.amount) AS collected
       FROM payments p JOIN businesses b ON b.id=p.business_id JOIN safer_zones sz ON sz.id=b.safer_zone_id
       WHERE p.year=$1 AND p.status='paid'${monthScope.clause}
       GROUP BY p.month ORDER BY p.month`,
      [y, ...monthScope.params]
    );
    const monthly = monthlyResult.rows.map((r) => ({
      month: Number(r.month),
      collected: String(Number(r.collected))
    }));

    // ── 3. Attendance summary ────────────────────────────────────────
    const attScope = zoneScope(req, collectorKebeleId, 3);
    const attResult = await db.query(
      `SELECT COUNT(*) AS total_records,
              SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.present=FALSE THEN 1 ELSE 0 END) AS absent_count
       FROM attendance a
       JOIN workers w ON w.id=a.worker_id
       JOIN safer_zones sz ON sz.id=w.safer_zone_id
       WHERE a.date BETWEEN $1 AND $2${attScope.clause}`,
      [first, last, ...attScope.params]
    );
    const att = attResult.rows[0] || {};
    const totalRecords = Number(att.total_records) || 0;
    const presentCount = Number(att.present_count) || 0;
    const absentCount = Number(att.absent_count) || 0;
    const attendance = {
      totalRecords,
      presentCount,
      absentCount,
      // null (not 0) means "no records" — a 0% rate would be misleading.
      attendanceRate: totalRecords ? Math.round((presentCount / totalRecords) * 100) : null
    };

    // ── 4. Inspection summary ────────────────────────────────────────
    const inspScope = zoneScope(req, collectorKebeleId, 3);
    const inspResult = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN i.status='active' THEN 1 ELSE 0 END) AS active_count,
              SUM(CASE WHEN i.status='warning' THEN 1 ELSE 0 END) AS warning_count,
              SUM(CASE WHEN i.status='danger' THEN 1 ELSE 0 END) AS danger_count
       FROM inspections i
       JOIN safer_zones sz ON sz.id=i.safer_zone_id
       WHERE i.date BETWEEN $1 AND $2${inspScope.clause}`,
      [first, last, ...inspScope.params]
    );
    const insp = inspResult.rows[0] || {};
    const inspections = {
      total: Number(insp.total) || 0,
      active: Number(insp.active_count) || 0,
      warning: Number(insp.warning_count) || 0,
      danger: Number(insp.danger_count) || 0
    };

    // ── 5. Per-kebele operational comparison ─────────────────────────
    // One 6-slot zone scope for the base WHERE + each derived table.
    const compScopes = [5, 6, 7, 8, 9, 10].map((o) => zoneScope(req, collectorKebeleId, o));
    const [s5, s6, s7, s8, s9, s10] = compScopes;
    const scopeParams = [];
    for (const s of compScopes) scopeParams.push(...s.params);

    const kebelesResult = await db.query(
      `SELECT k.id, k.code, k.name,
              COUNT(DISTINCT sz.id) AS zones,
              COALESCE(w_stats.worker_count,0) AS worker_count,
              COALESCE(b_stats.business_count,0) AS business_count,
              b_stats.target AS target,
              COALESCE(p_stats.collected,0) AS collected,
              COALESCE(p_stats.pending,0) AS pending,
              COALESCE(p_stats.overdue,0) AS overdue,
              a_stats.attendance_rate AS attendance_rate,
              COALESCE(i_stats.inspection_total,0) AS inspection_total,
              COALESCE(i_stats.active_count,0) AS inspection_active,
              COALESCE(i_stats.warning_count,0) AS inspection_warning,
              COALESCE(i_stats.danger_count,0) AS inspection_danger
       FROM safer_zones sz
       JOIN kebeles k ON k.id=sz.kebele_id
       LEFT JOIN (
         SELECT sz.kebele_id, COUNT(*) AS worker_count
         FROM workers w JOIN safer_zones sz ON sz.id=w.safer_zone_id
         WHERE w.is_active=TRUE${s5.clause}
         GROUP BY sz.kebele_id
       ) w_stats ON w_stats.kebele_id=k.id
       LEFT JOIN (
         SELECT sz.kebele_id, COUNT(*) FILTER (WHERE b.is_active) AS business_count, SUM(b.monthly_target) AS target
         FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id
         WHERE 1=1${s6.clause}
         GROUP BY sz.kebele_id
       ) b_stats ON b_stats.kebele_id=k.id
       LEFT JOIN (
         SELECT sz.kebele_id,
                SUM(p.amount) FILTER (WHERE p.status='paid') AS collected,
                SUM(p.amount) FILTER (WHERE p.status='pending') AS pending,
                SUM(p.amount) FILTER (WHERE p.status='overdue') AS overdue
         FROM payments p JOIN businesses b ON b.id=p.business_id JOIN safer_zones sz ON sz.id=b.safer_zone_id
         WHERE p.year=$1 AND p.month=$2${s7.clause}
         GROUP BY sz.kebele_id
       ) p_stats ON p_stats.kebele_id=k.id
       LEFT JOIN (
         SELECT sz.kebele_id,
                ROUND(SUM(CASE WHEN a.present=TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(a.id),0) * 100, 1) AS attendance_rate
         FROM attendance a JOIN workers w ON w.id=a.worker_id JOIN safer_zones sz ON sz.id=w.safer_zone_id
         WHERE a.date BETWEEN $3 AND $4${s8.clause}
         GROUP BY sz.kebele_id
       ) a_stats ON a_stats.kebele_id=k.id
       LEFT JOIN (
         SELECT sz.kebele_id,
                COUNT(*) AS inspection_total,
                SUM(CASE WHEN i.status='active' THEN 1 ELSE 0 END) AS active_count,
                SUM(CASE WHEN i.status='warning' THEN 1 ELSE 0 END) AS warning_count,
                SUM(CASE WHEN i.status='danger' THEN 1 ELSE 0 END) AS danger_count
         FROM inspections i JOIN safer_zones sz ON sz.id=i.safer_zone_id
         WHERE i.date BETWEEN $3 AND $4${s9.clause}
         GROUP BY sz.kebele_id
       ) i_stats ON i_stats.kebele_id=k.id
       WHERE 1=1${s10.clause}
       GROUP BY k.id, k.code, k.name,
                w_stats.worker_count, b_stats.business_count, b_stats.target,
                p_stats.collected, p_stats.pending, p_stats.overdue,
                a_stats.attendance_rate, i_stats.inspection_total,
                i_stats.active_count, i_stats.warning_count, i_stats.danger_count
       ORDER BY k.code`,
      [y, m, first, last, ...scopeParams]
    );

    const kebeles = kebelesResult.rows.map((r) => {
      const rowTarget = r.target != null ? Number(r.target) : null;
      const rowCollected = Number(r.collected) || 0;
      const rowAttendance = r.attendance_rate != null ? Number(r.attendance_rate) : null;
      return {
        id: Number(r.id),
        code: r.code,
        name: r.name,
        zones: Number(r.zones) || 0,
        workerCount: Number(r.worker_count) || 0,
        businessCount: Number(r.business_count) || 0,
        target: rowTarget != null ? String(rowTarget) : null,
        collected: String(rowCollected),
        achievementPct: rowTarget != null && rowTarget > 0 ? round1((rowCollected / rowTarget) * 100) : null,
        attendanceRate: rowAttendance,
        inspectionTotal: Number(r.inspection_total) || 0,
        activeInspections: Number(r.inspection_active) || 0,
        warningInspections: Number(r.inspection_warning) || 0,
        dangerInspections: Number(r.inspection_danger) || 0
      };
    });

    res.json({
      revenue: { ...revenue, monthly },
      attendance,
      inspections,
      kebeles,
      scope: { role: req.user.role }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;