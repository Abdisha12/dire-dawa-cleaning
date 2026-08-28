// database/migrations/001_add_lifecycle_fields.js
// Adds updated_at to kebeles, attendance, and salary_payments tables.
// These fields were identified as missing during the lifecycle audit.
// The schema.sql already includes them for new installations;
// this migration handles existing databases.
// NOTE: For PostgreSQL, ON UPDATE is handled by triggers (created in schema.sql).

/**
 * @param {import('pg').Pool} db
 */
async function up(db) {
  await db.query(`
    ALTER TABLE kebeles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await db.query(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await db.query(`
    ALTER TABLE salary_payments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);
}

/**
 * @param {import('pg').Pool} db
 */
async function down(db) {
  await db.query("ALTER TABLE kebeles DROP COLUMN IF EXISTS updated_at");
  await db.query("ALTER TABLE attendance DROP COLUMN IF EXISTS updated_at");
  await db.query("ALTER TABLE salary_payments DROP COLUMN IF EXISTS updated_at");
}

module.exports = { up, down };
