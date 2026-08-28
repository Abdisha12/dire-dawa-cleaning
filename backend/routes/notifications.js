// backend/routes/notifications.js — Notifications API
const express = require("express");
const db = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const notifService = require("../services/notificationService");
const router = express.Router();
router.use(authenticate);

// GET /api/notifications — list current user's notifications (paginated)
router.get("/", async (req, res, next) => {
  try {
    const isRead = req.query.isRead;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM notifications WHERE user_id = $1";
    const params = [req.user.id];
    let paramIdx = 2;

    if (isRead !== undefined && isRead !== "") {
      sql += ` AND is_read = $${paramIdx}`;
      params.push(isRead === "true" || isRead === "1");
      paramIdx++;
    }

    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS total");
    const countResult = await db.query(countSql, params);
    const total = countResult.rows[0].total;

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    res.json({ rows: result.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count — number of unread notifications for badge
router.get("/unread-count", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [req.user.id]
    );
    res.json({ unreadCount: result.rows[0].count });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read — mark single as read
router.put("/:id/read", async (req, res, next) => {
  try {
    await db.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Marked as read" });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all — mark all current user's notifications as read
router.put("/read-all", async (req, res, next) => {
  try {
    await db.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1",
      [req.user.id]
    );
    res.json({ message: "All marked as read" });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id — delete notification
router.delete("/:id", async (req, res, next) => {
  try {
    await db.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Deleted" });
  } catch (err) { next(err); }
});

// POST /api/notifications/generate — trigger alert generation (admin/collector)
router.post("/generate", requireRole("admin", "collector"), async (req, res, next) => {
  try {
    const overdueCount = await notifService.generateOverdueAlerts();
    const reportCount = await notifService.generatePendingReportAlerts();
    const workerCount = await notifService.generateAbsentWorkerAlerts();
    res.json({ message: "Alert generation complete", overdueCount, reportCount, workerCount });
  } catch (err) { next(err); }
});

module.exports = router;
