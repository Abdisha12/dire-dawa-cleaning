#!/usr/bin/env node
// database/migrate.js — Database migration runner for PostgreSQL
// Usage:
//   node migrate.js up          Apply all pending migrations
//   node migrate.js down        Rollback the last migration
//   node migrate.js status      Show migration status
//   node migrate.js create NAME Create a new migration file
//
// Migrations live in database/migrations/ and are named:
//   001_description.js   (sequential number + snake_case description)
//
// Each migration file exports:
//   up(db)    — Apply the migration (receives pg Pool)
//   down(db)  — Rollback the migration

require("dotenv").config({ path: __dirname + "/../backend/.env" });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const MIGRATION_TABLE = "_migrations";

function getPool() {
  return new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "ddcms",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dire_dawa_cleaning",
    max: 2,
  });
}

async function ensureMigrationTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(db) {
  const result = await db.query(`SELECT name FROM ${MIGRATION_TABLE} ORDER BY id`);
  return result.rows.map(r => r.name);
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".js"))
    .sort();
}

async function migrateUp(db) {
  await ensureMigrationTable(db);
  const applied = await getAppliedMigrations(db);
  const files = getMigrationFiles();
  const pending = files.filter(f => !applied.includes(f));

  if (pending.length === 0) {
    console.log("✓ All migrations already applied.");
    return;
  }

  for (const file of pending) {
    const migration = require(path.join(MIGRATIONS_DIR, file));
    console.log(`▸ Applying: ${file}`);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await migration.up(db);
      await client.query(`INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      console.log(`  ✓ ${file} applied successfully`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ✗ ${file} FAILED: ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`\n✓ ${pending.length} migration(s) applied.`);
}

async function migrateDown(db) {
  await ensureMigrationTable(db);
  const applied = await getAppliedMigrations(db);
  if (applied.length === 0) {
    console.log("✓ No migrations to rollback.");
    return;
  }

  const last = applied[applied.length - 1];
  const filePath = path.join(MIGRATIONS_DIR, last);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Migration file not found: ${last}`);
    process.exit(1);
  }

  const migration = require(filePath);
  if (!migration.down) {
    console.error(`✗ ${last} does not export a down() function`);
    process.exit(1);
  }

  console.log(`▸ Rolling back: ${last}`);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await migration.down(db);
    await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE name = $1`, [last]);
    await client.query("COMMIT");
    console.log(`  ✓ ${last} rolled back`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`  ✗ Rollback FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function migrateStatus(db) {
  await ensureMigrationTable(db);
  const applied = await getAppliedMigrations(db);
  const files = getMigrationFiles();

  console.log("Migration Status:");
  console.log("─".repeat(50));
  for (const file of files) {
    const status = applied.includes(file) ? "✓ applied" : "○ pending";
    console.log(`  ${status}  ${file}`);
  }
  if (files.length === 0) {
    console.log("  (no migration files found)");
  }
}

function createMigration(name) {
  const files = getMigrationFiles();
  const nextNum = files.length > 0
    ? String(parseInt(files[files.length - 1].split("_")[0]) + 1).padStart(3, "0")
    : "001";
  const filename = `${nextNum}_${name}.js`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  const template = `// database/migrations/${filename}
// Migration: ${name}

/**
 * @param {import('pg').Pool} db
 */
async function up(db) {
  // Apply migration here
  // Example: await db.query('ALTER TABLE ...');
}

/**
 * @param {import('pg').Pool} db
 */
async function down(db) {
  // Rollback migration here
  // Example: await db.query('ALTER TABLE ...');
}

module.exports = { up, down };
`;

  fs.writeFileSync(filepath, template);
  console.log(`Created: database/migrations/${filename}`);
}

// ── CLI ───────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

(async () => {
  const db = getPool();
  try {
    switch (cmd) {
      case "up":
        await migrateUp(db);
        break;
      case "down":
        await migrateDown(db);
        break;
      case "status":
        await migrateStatus(db);
        break;
      case "create":
        if (!args[0]) {
          console.error("Usage: node migrate.js create <migration_name>");
          process.exit(1);
        }
        createMigration(args[0]);
        break;
      default:
        console.log("Usage: node migrate.js <up|down|status|create> [name]");
        console.log("  up      Apply pending migrations");
        console.log("  down    Rollback last migration");
        console.log("  status  Show migration status");
        console.log("  create  Create new migration file");
    }
  } finally {
    await db.end();
  }
})();
