const express = require("express");
const db = require("../config/db");
const audit = require("../services/auditService");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const router = express.Router();
router.use(authenticate);

function parseCustomAttrs(rows) {
  return rows.map((r) => {
    if (r.custom_attributes && typeof r.custom_attributes === "string") {
      try {
        r.custom_attributes = JSON.parse(r.custom_attributes);
      } catch (_) {
        /* keep as string */
      }
    }
    return r;
  });
}

async function getCollectorKebeleId(userId) {
  const result = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [userId]);
  return result.rows.length ? result.rows[0].id : null;
}

async function zoneBelongsToKebele(zoneId, kebeleId) {
  if (!zoneId) return true;
  const result = await db.query("SELECT id FROM safer_zones WHERE id=$1 AND kebele_id=$2", [zoneId, kebeleId]);
  return result.rows.length > 0;
}

async function workerBelongsToKebele(workerId, kebeleId) {
  const result = await db.query(
    "SELECT w.id FROM workers w JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.id=$1 AND sz.kebele_id=$2",
    [workerId, kebeleId]
  );
  return result.rows.length > 0;
}

router.get("/summary/stats", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);
    let sql = `SELECT w.*,sz.name AS zone_name,k.name AS kebele_name,
                    COUNT(CASE WHEN a.present=TRUE THEN 1 END) AS days_present,
                    COUNT(CASE WHEN a.present=FALSE THEN 1 END) AS days_absent,
                    COALESCE(SUM(a.bonus),0) AS total_bonus,
                    COUNT(CASE WHEN a.present=TRUE THEN 1 END)*w.daily_wage+COALESCE(SUM(a.bonus),0) AS gross_wage
             FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id
             LEFT JOIN kebeles k ON k.id=sz.kebele_id
             LEFT JOIN attendance a ON a.worker_id=w.id AND a.date BETWEEN $1 AND $2
             WHERE w.is_active=TRUE`;
    const params = [first, last];
    let paramIdx = 3;
    if (req.user.role === "leader") {
      sql += ` AND sz.leader_id=$${paramIdx}`;
      params.push(req.user.id);
      paramIdx++;
    } else if (req.user.role === "collector") {
      const kebeleId = await getCollectorKebeleId(req.user.id);
      if (kebeleId) {
        sql += ` AND k.id=$${paramIdx}`;
        params.push(kebeleId);
        paramIdx++;
      }
    } else if (req.query.zoneId) {
      sql += ` AND w.safer_zone_id=$${paramIdx}`;
      params.push(req.query.zoneId);
      paramIdx++;
    }
    sql += " GROUP BY w.id ORDER BY sz.name,w.full_name";
    const result = await db.query(sql, params);
    res.json(parseCustomAttrs(result.rows));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/attendance/bulk",
  requireRole("admin", "collector", "leader"),
  validate(schemas.bulkAttendance),
  async (req, res, next) => {
    try {
      const { date, records } = req.body;
      if (!date || !Array.isArray(records) || !records.length)
        return res.status(400).json({ error: "date and records[] required" });
      for (const r of records) {
        if (req.user.role === "collector") {
          const kebeleId = await getCollectorKebeleId(req.user.id);
          if (kebeleId) {
            const owns = await workerBelongsToKebele(r.workerId, kebeleId);
            if (!owns) return res.status(403).json({ error: "Worker not in your kebele" });
          }
        }
        await db.query(
          `INSERT INTO attendance (worker_id,date,present,bonus,recorded_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (worker_id,date) DO UPDATE SET present=EXCLUDED.present, bonus=EXCLUDED.bonus`,
          [r.workerId, date, !!r.present, r.bonus || null, req.user.id]
        );
      }
      audit.log(req, "CREATE", "attendance", null, null, { date, count: records.length });
      res.json({ message: `Saved ${records.length} records` });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const hasPagination = rawPage !== undefined || rawLimit !== undefined;
    const page = hasPagination ? Math.max(1, parseInt(String(rawPage || "1"), 10) || 1) : 1;
    const limit = hasPagination ? Math.min(100, Math.max(1, parseInt(String(rawLimit || "50"), 10) || 50)) : 50;
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim(); // active | inactive
    const kebeleIdParam = req.query.kebeleId ? String(req.query.kebeleId) : null;
    const zoneIdParam = req.query.zoneId ? String(req.query.zoneId) : null;

    let baseSql = ` FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id LEFT JOIN kebeles k ON k.id=sz.kebele_id WHERE 1=1`;
    const whereParams = [];
    let wIdx = 1;

    if (req.user.role === "leader") {
      baseSql += ` AND sz.leader_id=$${wIdx}`;
      whereParams.push(req.user.id);
      wIdx++;
    } else if (req.user.role === "collector") {
      const kebeleId = await getCollectorKebeleId(req.user.id);
      if (kebeleId) {
        baseSql += ` AND k.id=$${wIdx}`;
        whereParams.push(kebeleId);
        wIdx++;
      } else {
        return res.json(hasPagination ? { data: [], total: 0, page: 1, pages: 0 } : []);
      }
    } else {
      // Admin / viewer: allow kebele filter
      if (kebeleIdParam) {
        baseSql += ` AND k.id=$${wIdx}`;
        whereParams.push(parseInt(kebeleIdParam, 10));
        wIdx++;
      } else if (zoneIdParam) {
        baseSql += ` AND w.safer_zone_id=$${wIdx}`;
        whereParams.push(parseInt(zoneIdParam, 10));
        wIdx++;
      }
    }
    // Collector/leader already scoped; if they also pass zoneId, honor it additionally
    if ((req.user.role === "collector" || req.user.role === "leader") && zoneIdParam) {
      baseSql += ` AND w.safer_zone_id=$${wIdx}`;
      whereParams.push(parseInt(zoneIdParam, 10));
      wIdx++;
    }

    if (search) {
      baseSql += ` AND (w.full_name ILIKE $${wIdx} OR w.contact ILIKE $${wIdx} OR w.fayda_id ILIKE $${wIdx})`;
      whereParams.push(`%${search}%`);
      wIdx++;
    }
    if (status === "active") {
      baseSql += ` AND w.is_active=TRUE`;
    } else if (status === "inactive") {
      baseSql += ` AND w.is_active=FALSE`;
    }

    if (!hasPagination) {
      const sql = `SELECT w.*,sz.name AS zone_name,k.name AS kebele_name${baseSql} ORDER BY sz.name,w.full_name`;
      const result = await db.query(sql, whereParams);
      return res.json(parseCustomAttrs(result.rows));
    }

    const countSql = `SELECT COUNT(*)::int AS total${baseSql}`;
    const countRes = await db.query(countSql, whereParams);
    const total = countRes.rows[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const dataSql = `SELECT w.*,sz.name AS zone_name,k.name AS kebele_name${baseSql} ORDER BY sz.name,w.full_name LIMIT $${wIdx} OFFSET $${wIdx + 1}`;
    const dataParams = [...whereParams, limit, offset];
    const result = await db.query(dataSql, dataParams);
    res.json({ data: parseCustomAttrs(result.rows), total, page, pages });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireRole("admin", "collector", "leader"),
  validate(schemas.createWorker),
  async (req, res, next) => {
    try {
      const { fullName, contact, faydaId, dailyWage, saferZoneId, customAttributes } = req.body;
      if (!fullName) return res.status(400).json({ error: "fullName required" });

      if (req.user.role === "collector") {
        const kebeleId = await getCollectorKebeleId(req.user.id);
        if (kebeleId && saferZoneId) {
          const zoneOk = await zoneBelongsToKebele(saferZoneId, kebeleId);
          if (!zoneOk) {
            audit.log(req, "UNAUTHORIZED", "worker", null, null, {
              action: "cross_kebele_create",
              attemptedZoneId: saferZoneId,
              assignedKebeleId: kebeleId
            });
            return res.status(403).json({ error: "Zone does not belong to your kebele" });
          }
        }
      }

      if (req.user.role === "leader") {
        const zr = await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2", [
          saferZoneId,
          req.user.id
        ]);
        if (!zr.rows.length) return res.status(403).json({ error: "Not your zone" });
      }

      const attrs = customAttributes ? JSON.stringify(customAttributes) : null;
      const r = await db.query(
        "INSERT INTO workers (full_name,contact,fayda_id,daily_wage,safer_zone_id,custom_attributes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [fullName, contact || null, faydaId || null, dailyWage || 250, saferZoneId || null, attrs]
      );
      const insertedId = r.rows[0].id;
      audit.log(req, "CREATE", "worker", insertedId, null, { fullName, contact, dailyWage, saferZoneId });
      res.status(201).json({ id: insertedId });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Fayda ID already exists" });
      next(err);
    }
  }
);

router.put(
  "/:id",
  requireRole("admin", "collector", "leader"),
  validate(schemas.updateWorker),
  async (req, res, next) => {
    try {
      const { fullName, contact, faydaId, dailyWage, saferZoneId, isActive, customAttributes } = req.body;

      if (req.user.role === "collector") {
        const kebeleId = await getCollectorKebeleId(req.user.id);
        if (kebeleId) {
          const owns = await workerBelongsToKebele(req.params.id, kebeleId);
          if (!owns) {
            audit.log(req, "UNAUTHORIZED", "worker", parseInt(req.params.id), null, { action: "cross_kebele_edit" });
            return res.status(403).json({ error: "Worker not in your kebele" });
          }
          if (saferZoneId) {
            const zoneOk = await zoneBelongsToKebele(saferZoneId, kebeleId);
            if (!zoneOk) {
              audit.log(req, "UNAUTHORIZED", "worker", parseInt(req.params.id), null, {
                action: "cross_kebele_zone_move",
                attemptedZoneId: saferZoneId
              });
              return res.status(403).json({ error: "Cannot move worker to another kebele" });
            }
          }
        }
      }

      const oldResult = await db.query(
        "SELECT full_name,contact,daily_wage,safer_zone_id,is_active FROM workers WHERE id=$1",
        [req.params.id]
      );
      const attrs = customAttributes ? JSON.stringify(customAttributes) : null;
      await db.query(
        "UPDATE workers SET full_name=$1,contact=$2,fayda_id=$3,daily_wage=$4,safer_zone_id=$5,is_active=$6,custom_attributes=$7 WHERE id=$8",
        [fullName, contact || null, faydaId || null, dailyWage, saferZoneId || null, isActive, attrs, req.params.id]
      );
      audit.log(req, "UPDATE", "worker", parseInt(req.params.id), oldResult.rows[0] || null, {
        fullName,
        contact,
        dailyWage,
        saferZoneId,
        isActive
      });
      res.json({ message: "Updated" });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id", requireRole("admin", "collector"), async (req, res, next) => {
  try {
    if (req.user.role === "collector") {
      const kebeleId = await getCollectorKebeleId(req.user.id);
      if (kebeleId) {
        const owns = await workerBelongsToKebele(req.params.id, kebeleId);
        if (!owns) {
          audit.log(req, "UNAUTHORIZED", "worker", parseInt(req.params.id), null, { action: "cross_kebele_delete" });
          return res.status(403).json({ error: "Worker not in your kebele" });
        }
      }
    }

    const oldResult = await db.query("SELECT full_name,safer_zone_id FROM workers WHERE id=$1", [req.params.id]);
    if (!oldResult.rows.length) return res.status(404).json({ error: "Worker not found" });
    await db.query("DELETE FROM workers WHERE id=$1", [req.params.id]);
    audit.log(req, "DELETE", "worker", parseInt(req.params.id), oldResult.rows[0] || null, null);
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/attendance", validate(schemas.workerAttendanceQuery, "query"), async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Scope: collectors see only their kebele's workers; leaders see only their zone's workers
    let scopeWhere = "";
    const params = [req.params.id];
    let pIdx = 1;

    if (req.user.role === "collector") {
      const kebeleId = await getCollectorKebeleId(req.user.id);
      if (kebeleId) {
        const owns = await workerBelongsToKebele(req.params.id, kebeleId);
        if (!owns) return res.status(403).json({ error: "Worker not in your kebele" });
      } else {
        return res.status(403).json({ error: "No kebele assigned to your account" });
      }
    } else if (req.user.role === "leader") {
      // Leader can only view attendance for workers in their own zones
      scopeWhere = ` AND sz.leader_id = $${++pIdx}`;
      params.push(req.user.id);
    }

    let sql = `SELECT a.*, u.full_name AS recorder_name FROM attendance a JOIN users u ON u.id = a.recorded_by WHERE a.worker_id = $${params[0]}`;
    if (scopeWhere) sql += scopeWhere;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/salary", async (req, res, next) => {
  try {
    // Scope: collectors see only their kebele's workers; leaders see only their zone's workers
    if (req.user.role === "collector") {
      const kebeleId = await getCollectorKebeleId(req.user.id);
      if (kebeleId) {
        const owns = await workerBelongsToKebele(req.params.id, kebeleId);
        if (!owns) return res.status(403).json({ error: "Worker not in your kebele" });
      } else {
        return res.status(403).json({ error: "No kebele assigned to your account" });
      }
    } else if (req.user.role === "leader") {
      // Leader can only view salary for workers in their own zones
      const zoneResult = await db.query("SELECT id FROM safer_zones WHERE leader_id=$1", [req.user.id]);
      const leaderZones = zoneResult.rows.map((r) => r.id);
      const workerZoneResult = await db.query(
        "SELECT sz.id FROM workers w JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.id=$1",
        [req.params.id]
      );
      if (workerZoneResult.rows.length === 0 || !leaderZones.includes(workerZoneResult.rows[0].id)) {
        return res.status(403).json({ error: "Worker not in your zone" });
      }
    }

    const result = await db.query(
      "SELECT sp.*, u.full_name AS paid_by_name FROM salary_payments sp JOIN users u ON u.id = sp.paid_by WHERE sp.worker_id=$1 ORDER BY sp.paid_at DESC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/salary",
  requireRole("admin", "collector", "leader"),
  validate(schemas.paySalary),
  async (req, res, next) => {
    try {
      const { amount, paidAt, periodFrom, periodTo, notes } = req.body;
      if (!amount || !paidAt || !periodFrom || !periodTo)
        return res.status(400).json({ error: "amount,paidAt,periodFrom,periodTo required" });

      if (req.user.role === "collector") {
        const kebeleId = await getCollectorKebeleId(req.user.id);
        if (kebeleId) {
          const owns = await workerBelongsToKebele(req.params.id, kebeleId);
          if (!owns) return res.status(403).json({ error: "Worker not in your kebele" });
        }
      } else if (req.user.role === "leader") {
        // Leader can only pay salary for workers in their own zones
        const zoneResult = await db.query("SELECT id FROM safer_zones WHERE leader_id=$1", [req.user.id]);
        const leaderZones = zoneResult.rows.map((r) => r.id);
        const workerZoneResult = await db.query(
          "SELECT sz.id FROM workers w JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.id=$1",
          [req.params.id]
        );
        if (workerZoneResult.rows.length === 0 || !leaderZones.includes(workerZoneResult.rows[0].id))
          return res.status(403).json({ error: "Worker not in your zone" });
      }

      const r = await db.query(
        "INSERT INTO salary_payments (worker_id,amount,paid_at,period_from,period_to,notes,paid_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [req.params.id, amount, paidAt, periodFrom, periodTo, notes || null, req.user.id]
      );
      const insertedId = r.rows[0].id;
      audit.log(req, "CREATE", "salary", insertedId, null, { workerId: req.params.id, amount, periodFrom, periodTo });
      res.status(201).json({ id: insertedId });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
