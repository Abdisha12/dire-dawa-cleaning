// backend/test/helpers/setup.js — Test database helpers
// Creates test users and cleans up after tests.
const bcrypt = require("bcryptjs");
const db = require("../../config/db");

const TEST_USERS = {
  admin:    { username: "test_admin",    password: "TestPass123!", role: "admin",    full_name: "Test Admin" },
  collector:{ username: "test_collector", password: "TestPass123!", role: "collector", full_name: "Test Collector" },
  leader1:  { username: "test_leader1",  password: "TestPass123!", role: "leader",   full_name: "Test Leader 1" },
  leader2:  { username: "test_leader2",  password: "TestPass123!", role: "leader",   full_name: "Test Leader 2" },
  viewer:   { username: "test_viewer",   password: "TestPass123!", role: "viewer",   full_name: "Test Viewer" },
};

let testUserIds = {};
let testSessions = {};

async function seedTestData() {
  // Create test users
  for (const [key, u] of Object.entries(TEST_USERS)) {
    const hash = await bcrypt.hash(u.password, 10);
    try {
      const [r] = await db.execute(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
        [u.username, hash, u.full_name, u.role]
      );
      testUserIds[key] = r.insertId;
    } catch (e) {
      // User may already exist
      const [rows] = await db.execute("SELECT id FROM users WHERE username = ?", [u.username]);
      if (rows.length) testUserIds[key] = rows[0].id;
    }
  }

  // Create sessions for each user
  const { v4: uuidv4 } = require("uuid");
  for (const [key, u] of Object.entries(TEST_USERS)) {
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.execute("DELETE FROM sessions WHERE user_id = ?", [testUserIds[key]]);
    await db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, testUserIds[key], expires]);
    testSessions[key] = token;
  }

  return { userIds: testUserIds, tokens: testSessions };
}

async function cleanupTestData() {
  // Delete test sessions
  for (const id of Object.values(testUserIds)) {
    await db.execute("DELETE FROM sessions WHERE user_id = ?", [id]);
  }
  // Delete test users
  for (const u of Object.values(TEST_USERS)) {
    await db.execute("DELETE FROM users WHERE username = ?", [u.username]);
  }
}

function getTestToken(roleKey) {
  return testSessions[roleKey];
}

function getTestUserId(roleKey) {
  return testUserIds[roleKey];
}

module.exports = { seedTestData, cleanupTestData, getTestToken, getTestUserId, TEST_USERS };
