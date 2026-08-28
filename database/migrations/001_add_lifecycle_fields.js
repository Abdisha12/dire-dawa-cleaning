// database/migrations/001_add_lifecycle_fields.js
// Adds updated_at to kebeles, attendance, and salary_payments tables.
// These fields were identified as missing during the lifecycle audit.
// The schema.sql already includes them for new installations;
// this migration handles existing databases.

/**
 * @param {import('mysql2/promise').Connection} db
 */
async function up(db) {
  // kebeles — collector assignments change, worth tracking
  await db.execute(`
    ALTER TABLE kebeles
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
  `);

  // attendance — corrections affect wages, auditable
  await db.execute(`
    ALTER TABLE attendance
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
  `);

  // salary_payments — financial record, adjustments need lifecycle
  await db.execute(`
    ALTER TABLE salary_payments
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
  `);
}

/**
 * @param {import('mysql2/promise').Connection} db
 */
async function down(db) {
  await db.execute("ALTER TABLE kebeles DROP COLUMN updated_at");
  await db.execute("ALTER TABLE attendance DROP COLUMN updated_at");
  await db.execute("ALTER TABLE salary_payments DROP COLUMN updated_at");
}

module.exports = { up, down };
