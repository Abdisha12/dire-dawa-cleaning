// backend/routes/auditLog.js — Admin-only audit log API
const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const audit = require("../services/auditService");
const router = express.Router();
router.use(authenticate);

// List audit entries (admin only)
router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { entityType, entityId, userId, action, from, to, page, limit } = req.query;
    const result = await audit.getEntries({
      entityType, entityId, userId, action, from, to,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 200),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Single entry detail
router.get("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const db = require("../config/db");
    const result = await db.query(
      `SELECT al.*, u.full_name AS user_name, u.role AS user_role
       FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
       WHERE al.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
