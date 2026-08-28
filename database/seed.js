#!/usr/bin/env node
// database/seed.js — Development seed user creator (PostgreSQL)
// Creates seed users with passwords from SEED_PASSWORD env var.
// NEVER run this in production.
//
// Usage:
//   SEED_PASSWORD=mypassword node database/seed.js
//
// This script:
//   1. Hashes SEED_PASSWORD with bcrypt (10 rounds)
//   2. Inserts/updates 7 development users (admin, 2 collectors, 3 leaders, 1 viewer)
//   3. Links collectors to kebeles and leaders to zones
//   4. Requires SEED_PASSWORD to be set (refuses to run without it)

require("dotenv").config({ path: __dirname + "/../backend/.env" });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const SEED_PASSWORD = process.env.SEED_PASSWORD;

if (!SEED_PASSWORD) {
  console.error("\n✗ SEED_PASSWORD environment variable is required.");
  console.error("  Usage: SEED_PASSWORD=yourpassword node database/seed.js");
  console.error("  This prevents predictable credentials from being committed.\n");
  process.exit(1);
}

if (SEED_PASSWORD.length < 8) {
  console.error("\n✗ SEED_PASSWORD must be at least 8 characters.\n");
  process.exit(1);
}

const SEED_USERS = [
  { username: "admin",       fullName: "System Administrator", phone: "0911000000", role: "admin" },
  { username: "collector1",  fullName: "Abebe Bekele",         phone: "0911000001", role: "collector" },
  { username: "collector2",  fullName: "Tigist Haile",         phone: "0911000002", role: "collector" },
  { username: "leader_k1z1", fullName: "Mulugeta Tadesse",     phone: "0911100001", role: "leader" },
  { username: "leader_k1z2", fullName: "Hiwot Girma",          phone: "0911100002", role: "leader" },
  { username: "leader_k2z1", fullName: "Dawit Bekele",         phone: "0911100003", role: "leader" },
  { username: "viewer1",     fullName: "Fatuma Omar",          phone: "0911000009", role: "viewer" },
];

async function seed() {
  const db = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "ddcms",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dire_dawa_cleaning",
    max: 2,
  });

  try {
    const hash = await bcrypt.hash(SEED_PASSWORD, 10);
    console.log(`Seeding ${SEED_USERS.length} users...`);

    for (const u of SEED_USERS) {
      await db.query(
        `INSERT INTO users (username, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE SET
           password_hash=EXCLUDED.password_hash,
           full_name=EXCLUDED.full_name`,
        [u.username, hash, u.fullName, u.phone, u.role]
      );
      console.log(`  ✓ ${u.username} (${u.role})`);
    }

    // Link collectors to kebeles
    const users = await db.query("SELECT id, username FROM users WHERE role='collector'");
    const collectorMap = {};
    for (const u of users.rows) collectorMap[u.username] = u.id;

    if (collectorMap.collector1) {
      await db.query("UPDATE kebeles SET collector_id=$1 WHERE code IN ('K01','K02','K05','K07','K09')", [collectorMap.collector1]);
    }
    if (collectorMap.collector2) {
      await db.query("UPDATE kebeles SET collector_id=$1 WHERE code IN ('K03','K04','K06','K08')", [collectorMap.collector2]);
    }

    // Link leaders to zones
    const leaderAssignments = [
      { username: "leader_k1z1", zoneName: "Zone A - Kezira Main" },
      { username: "leader_k1z2", zoneName: "Zone B - Kezira North" },
      { username: "leader_k2z1", zoneName: "Zone A - Sabian Main" },
    ];
    for (const la of leaderAssignments) {
      const uid = collectorMap[la.username];
      if (uid) {
        await db.query("UPDATE safer_zones SET leader_id=$1 WHERE name=$2", [uid, la.zoneName]);
      }
    }

    console.log(`\n✓ Seed complete. All users have the same SEED_PASSWORD.`);
    console.log(`  ⚠ Do NOT use SEED_PASSWORD in production.\n`);
  } finally {
    await db.end();
  }
}

seed().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
