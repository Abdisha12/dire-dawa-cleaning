// database/migrations/002_add_complaints.js
// Adds the Complaints module (P1-2): community-reported cleanliness issues
// resolved by staff. Requires the user_role-based scoping already present.
// Complaints attach to a safer zone so kebele/zone authorization applies.
// schema.sql already includes these objects for fresh installs; this migration
// handles existing databases. Safe to run repeatedly (idempotent).

async function up(db) {
  await db.query(`DO $$ BEGIN
    CREATE TYPE complaint_category AS ENUM ('illegal_dumping','litter','blocked_drain','hazard','other');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await db.query(`DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM ('new','in_progress','resolved');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id              SERIAL PRIMARY KEY,
      title           VARCHAR(200) NOT NULL,
      description     TEXT NOT NULL,
      category        complaint_category NOT NULL DEFAULT 'other',
      safer_zone_id   INT NOT NULL REFERENCES safer_zones(id) ON DELETE CASCADE,
      reporter_name   VARCHAR(120),
      reporter_phone  VARCHAR(30),
      status          complaint_status NOT NULL DEFAULT 'new',
      assigned_to     INT REFERENCES users(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      resolved_by     INT REFERENCES users(id) ON DELETE SET NULL,
      resolved_at     TIMESTAMP,
      created_by      INT REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    DROP TRIGGER IF EXISTS trg_complaints_updated_at ON complaints;
    CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
  `);

  await db.query("CREATE INDEX IF NOT EXISTS idx_complaints_zone ON complaints(safer_zone_id)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_complaints_status_created ON complaints(status, created_at DESC)");
}

async function down(db) {
  await db.query("DROP INDEX IF EXISTS idx_complaints_status_created");
  await db.query("DROP INDEX IF EXISTS idx_complaints_zone");
  await db.query("DROP TRIGGER IF EXISTS trg_complaints_updated_at ON complaints");
  await db.query("DROP TABLE IF EXISTS complaints");
  await db.query("DROP TYPE IF EXISTS complaint_status");
  await db.query("DROP TYPE IF EXISTS complaint_category");
}

module.exports = { up, down };