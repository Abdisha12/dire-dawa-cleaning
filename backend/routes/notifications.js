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

    let sql = "SELECT * FROM notifications WHERE user_id = ?";
    const params = [req.user.id];

    if (isRead !== undefined && isRead !== "") {
      sql += " AND is_read = ?";
      params.push(isRead === "true" || isRead === "1" ? 1 : 0);
    }

    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS total");
    const [[{ total }]] = await db.execute(countSql, params);

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.execute(sql, params);
    res.json({ rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count — number of unread notifications for badge
router.get("/unread-count", async (req, res, next) => {
  try {
    const [[{ count }]] = await db.execute(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0",
      [req.user.id]
    );
    res.json({ unreadCount: count });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read — mark single as read
router.put("/:id/read", async (req, res, next) => {
  try {
    await db.execute(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Marked as read" });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all — mark all current user's notifications as read
router.put("/read-all", async (req, res, next) => {
  try {
    await db.execute(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ message: "All marked as read" });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id — delete notification
router.delete("/:id", async (req, res, next) => {
  try {
    await db.execute(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
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
