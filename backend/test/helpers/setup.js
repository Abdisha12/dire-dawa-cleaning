process.env.NODE_ENV = "test";
// backend/test/helpers/setup.js — Test database helpers (PostgreSQL)
// Creates test users and cleans up after tests.
const bcrypt = require("bcryptjs");
const db = require("../../config/db");

const TEST_USERS = {
  admin: { username: "test_admin", password: "TestPass123!", role: "admin", full_name: "Test Admin" },
  collector: { username: "test_collector", password: "TestPass123!", role: "collector", full_name: "Test Collector" },
  leader1: { username: "test_leader1", password: "TestPass123!", role: "leader", full_name: "Test Leader 1" },
  leader2: { username: "test_leader2", password: "TestPass123!", role: "leader", full_name: "Test Leader 2" },
  viewer: { username: "test_viewer", password: "TestPass123!", role: "viewer", full_name: "Test Viewer" }
};

let testUserIds = {};
let testSessions = {};

async function seedTestData() {
  await db.query("TRUNCATE login_attempts CASCADE;").catch(() => {});
  // Create test users
  for (const [key, u] of Object.entries(TEST_USERS)) {
    const hash = await bcrypt.hash(u.password, 10);
    try {
      const r = await db.query(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO UPDATE SET id=users.id RETURNING id",
        [u.username, hash, u.full_name, u.role]
      );
      testUserIds[key] = r.rows[0].id;
    } catch (e) {
      // User may already exist
      const result = await db.query("SELECT id FROM users WHERE username = $1", [u.username]);
      if (result.rows.length) testUserIds[key] = result.rows[0].id;
    }
  }

  // Create sessions for each user
  const { v4: uuidv4 } = require("uuid");
  for (const [key, u] of Object.entries(TEST_USERS)) {
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query("DELETE FROM sessions WHERE user_id = $1", [testUserIds[key]]);
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
      token,
      testUserIds[key],
      expires
    ]);
    testSessions[key] = token;
  }

  return { userIds: testUserIds, tokens: testSessions };
}

async function cleanupTestData() {
  for (const id of Object.values(testUserIds)) {
    await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    await db.query("DELETE FROM payments WHERE collected_by = $1", [id]);
    await db.query("DELETE FROM inspections WHERE inspected_by = $1", [id]);
    await db.query("DELETE FROM zone_reports WHERE submitted_by = $1 OR reviewed_by = $1", [id]);
    await db.query("DELETE FROM audit_log WHERE user_id = $1", [id]);
    await db.query("DELETE FROM notifications WHERE user_id = $1", [id]);
  }
  for (const u of Object.values(TEST_USERS)) {
    await db.query("DELETE FROM users WHERE username = $1", [u.username]);
  }
}

function getTestToken(roleKey) {
  return testSessions[roleKey];
}

function getTestUserId(roleKey) {
  return testUserIds[roleKey];
}

module.exports = { seedTestData, cleanupTestData, getTestToken, getTestUserId, TEST_USERS };
