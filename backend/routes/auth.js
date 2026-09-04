const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const logger = require("../config/logger");
const audit = require("../services/auditService");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const router = express.Router();
const HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS) || 8;

// ── Failed login tracking (in-memory) ────────────────────────
const MAX_FAILED = parseInt(process.env.LOGIN_MAX_FAILED) || 5;
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES) || 15;

// ── Failed login tracking (persistent via login_attempts table) ────────────────────────
async function recordFailedLogin(username, ipAddress) {
  const now = new Date();
  const existing = await db.query(
    "SELECT id, failed_count, last_attempt_at, locked_until FROM login_attempts WHERE username=$1 AND ip_address=$2",
    [username, ipAddress]
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const newCount = row.failed_count + 1;
    const lockedUntil = newCount >= MAX_FAILED ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await db.query(
      "UPDATE login_attempts SET failed_count=$1, last_attempt_at=$2, locked_until=$3 WHERE id=$4",
      [newCount, now, lockedUntil, row.id]
    );
  } else {
    const lockedUntil = 1 >= MAX_FAILED ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await db.query(
      "INSERT INTO login_attempts (username, ip_address, failed_count, last_attempt_at, locked_until) VALUES ($1, $2, 1, $3, $4)",
      [username, ipAddress, now, lockedUntil]
    );
  }
}

async function isLocked(username, ipAddress) {
  const now = new Date();
  const result = await db.query(
    "SELECT id, failed_count, locked_until FROM login_attempts WHERE username=$1 AND ip_address=$2",
    [username, ipAddress]
  );
  if (!result.rows.length) return false;
  const row = result.rows[0];
  if (row.locked_until && row.locked_until > now) return true;
  if (row.locked_until && row.locked_until <= now) {
    await db.query("DELETE FROM login_attempts WHERE id=$1", [row.id]);
  }
  return false;
}

async function clearFailedLogins(username, ipAddress) {
  await db.query("DELETE FROM login_attempts WHERE username=$1 AND ip_address=$2", [username, ipAddress]);
}

// ── Login ─────────────────────────────────────────────────────
router.post("/login", validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";

    if (await isLocked(username, clientIp)) {
      logger.warn(`Login blocked (locked account): ${username}`);
      return res.status(429).json({ error: "Too many login attempts. Account is locked." });
    }

    const usersResult = await db.query("SELECT * FROM users WHERE username=$1 AND is_active=TRUE", [username]);
    if (!usersResult.rows.length) {
      await recordFailedLogin(username, clientIp);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = usersResult.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) {
      await recordFailedLogin(username, clientIp);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearFailedLogins(username, clientIp);

    await db.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);

    const token = uuidv4();
    const exp = new Date(Date.now() + HOURS * 3600000);
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [token, user.id, exp]);

    await db.query("DELETE FROM sessions WHERE expires_at < NOW()");

    let zone = null;
    if (user.role === "leader") {
      const zResult = await db.query(
        "SELECT sz.id,sz.name,sz.kebele_id,k.name AS kebele_name FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id WHERE sz.leader_id=$1",
        [user.id]
      );
      if (zResult.rows.length) zone = zResult.rows[0];
    }
    logger.info(`Login: ${username} (${user.role})`);
    req._auditUserId = user.id;
    audit.log(req, "LOGIN", "session", null, null, { username: user.username, role: user.role });
    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, phone: user.phone, zone }
    });
  } catch (err) {
    next(err);
  }
});

// ── Logout — invalidate session ───────────────────────────────
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const token = req.headers["x-session-token"] || req.headers["authorization"]?.replace("Bearer ", "");
    await db.query("DELETE FROM sessions WHERE id=$1", [token]);
    logger.info(`Logout: ${req.user.username}`);
    audit.log(req, "LOGOUT", "session", null, null, { username: req.user.username });
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

// ── Current user ──────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  const u = req.user;
  let zone = null;
  if (u.role === "leader") {
    const zResult = await db.query(
      "SELECT sz.id,sz.name,sz.kebele_id,k.name AS kebele_name FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id WHERE sz.leader_id=$1",
      [u.id]
    );
    if (zResult.rows.length) zone = zResult.rows[0];
  }
  res.json({ id: u.id, username: u.username, fullName: u.full_name, role: u.role, zone });
});

module.exports = router;
