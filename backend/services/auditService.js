// backend/services/auditService.js — Centralized audit trail logging
const db = require("../config/db");
const logger = require("../config/logger");

/**
 * Log an audit trail entry.
 * @param {Object}  req         Express request (for user, ip, user-agent)
 * @param {string}  action      CREATE | UPDATE | DELETE | APPROVE | LOGIN | PASSWORD_CHANGE
 * @param {string}  entityType  payment | worker | inspection | zone_report | user | session | tool | business | attendance | salary
 * @param {number}  entityId    ID of the affected record (null for login/bulk)
 * @param {Object}  oldValues   Previous values (null for CREATE/LOGIN)
 * @param {Object}  newValues   New values (null for DELETE)
 */
async function log(req, action, entityType, entityId = null, oldValues = null, newValues = null) {
  try {
    const userId = req.user?.id || req._auditUserId || null;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress || null;
    const ua = (req.headers["user-agent"] || "").slice(0, 255);

    await db.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip,
        ua,
      ]
    );
  } catch (err) {
    // Audit logging should never break the main request
    logger.error("Audit log failed", { err: err.message, action, entityType, entityId });
  }
}

/**
 * Fetch audit log entries with filters.
 */
async function getEntries({ entityType, entityId, userId, action, from, to, page = 1, limit = 50 } = {}) {
  let sql = `SELECT al.*, u.full_name AS user_name, u.role AS user_role
             FROM audit_log al
             LEFT JOIN users u ON u.id = al.user_id
             WHERE 1=1`;
  const params = [];

  if (entityType) { sql += " AND al.entity_type = ?"; params.push(entityType); }
  if (entityId) { sql += " AND al.entity_id = ?"; params.push(entityId); }
  if (userId) { sql += " AND al.user_id = ?"; params.push(userId); }
  if (action) { sql += " AND al.action = ?"; params.push(action); }
  if (from) { sql += " AND al.created_at >= ?"; params.push(from); }
  if (to) { sql += " AND al.created_at <= ?"; params.push(to + " 23:59:59"); }

  // Count
  const countSql = sql.replace(/SELECT al\.\*.*FROM/, "SELECT COUNT(*) AS total FROM");
  const [[{ total }]] = await db.execute(countSql, params);

  sql += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, (page - 1) * limit);
  const [rows] = await db.execute(sql, params);

  return { rows, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { log, getEntries };
