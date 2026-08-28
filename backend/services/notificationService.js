// backend/services/notificationService.js — Notification creation and automated alert generators
const db = require("../config/db");
const logger = require("../config/logger");

/**
 * Send in-app notification to a specific user.
 */
async function notify(userId, type, title, message, link = null) {
  try {
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, link]
    );
  } catch (err) {
    logger.error("Failed to create notification", { err: err.message, userId, type });
  }
}

/**
 * Send notification to all active users with a specific role.
 */
async function notifyRole(role, type, title, message, link = null) {
  try {
    const [users] = await db.execute("SELECT id FROM users WHERE role = ? AND is_active = 1", [role]);
    for (const u of users) {
      await notify(u.id, type, title, message, link);
    }
  } catch (err) {
    logger.error("Failed to notify role", { err: err.message, role, type });
  }
}

/**
 * Automated Scanner: Overdue payment alerts for leaders & collectors.
 */
async function generateOverdueAlerts() {
  try {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // Find businesses with pending payments in past months or marked overdue
    const [overdues] = await db.execute(
      `SELECT p.id, p.amount, p.month, p.year, b.name AS business_name, sz.id AS zone_id, sz.name AS zone_name, sz.leader_id, k.collector_id
       FROM payments p
       JOIN businesses b ON b.id = p.business_id
       JOIN safer_zones sz ON sz.id = b.safer_zone_id
       JOIN kebeles k ON k.id = sz.kebele_id
       WHERE p.status = 'overdue' OR (p.status = 'pending' AND (p.year < ? OR (p.year = ? AND p.month < ?)))`,
      [curYear, curYear, curMonth]
    );

    let count = 0;
    for (const item of overdues) {
      const msg = `Overdue payment of ETB ${parseFloat(item.amount).toLocaleString()} for ${item.business_name} (${item.zone_name}, Month ${item.month}/${item.year}).`;
      
      // Notify collector assigned to kebele
      if (item.collector_id) {
        await notify(item.collector_id, "overdue_payment", "⚠️ Overdue Payment Alert", msg, "#payments");
        count++;
      }
      // Notify zone leader
      if (item.leader_id) {
        await notify(item.leader_id, "overdue_payment", "⚠️ Overdue Payment Alert", msg, "#payments");
        count++;
      }
    }
    logger.info(`Generated ${count} overdue payment notifications`);
    return count;
  } catch (err) {
    logger.error("Error generating overdue alerts", { err: err.message });
    return 0;
  }
}

/**
 * Automated Scanner: Pending zone reports alerts for zone leaders & collectors.
 */
async function generatePendingReportAlerts() {
  try {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // Find zones without an approved/submitted report for current or previous month
    const [zonesWithoutReports] = await db.execute(
      `SELECT sz.id, sz.name AS zone_name, sz.leader_id, k.collector_id
       FROM safer_zones sz
       JOIN kebeles k ON k.id = sz.kebele_id
       WHERE sz.leader_id IS NOT NULL
         AND sz.id NOT IN (
           SELECT safer_zone_id FROM zone_reports WHERE report_year = ? AND report_month = ? AND status IN ('submitted','approved')
         )`,
      [curYear, curMonth]
    );

    let count = 0;
    for (const z of zonesWithoutReports) {
      const msg = `Monthly zone report for ${z.zone_name} is pending submission for Month ${curMonth}/${curYear}.`;
      if (z.leader_id) {
        await notify(z.leader_id, "pending_report", "📝 Monthly Zone Report Pending", msg, "#zonereports");
        count++;
      }
      if (z.collector_id) {
        await notify(z.collector_id, "pending_report", "📝 Unsubmitted Zone Report", msg, "#zonereports");
        count++;
      }
    }
    logger.info(`Generated ${count} pending report notifications`);
    return count;
  } catch (err) {
    logger.error("Error generating pending report alerts", { err: err.message });
    return 0;
  }
}

/**
 * Automated Scanner: Absent worker alerts.
 */
async function generateAbsentWorkerAlerts() {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const [absences] = await db.execute(
      `SELECT a.date, w.full_name AS worker_name, sz.name AS zone_name, sz.leader_id
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       JOIN safer_zones sz ON sz.id = w.safer_zone_id
       WHERE a.date = ? AND a.present = 0 AND sz.leader_id IS NOT NULL`,
      [yesterday]
    );

    let count = 0;
    for (const a of absences) {
      const msg = `Worker ${a.worker_name} was marked absent in ${a.zone_name} on ${a.date}.`;
      await notify(a.leader_id, "absent_worker", "👷 Absent Worker Notice", msg, "#workers");
      count++;
    }
    logger.info(`Generated ${count} absent worker notifications`);
    return count;
  } catch (err) {
    logger.error("Error generating absent worker alerts", { err: err.message });
    return 0;
  }
}

module.exports = {
  notify,
  notifyRole,
  generateOverdueAlerts,
  generatePendingReportAlerts,
  generateAbsentWorkerAlerts
};
