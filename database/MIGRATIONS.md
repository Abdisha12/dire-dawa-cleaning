# Database Migrations

## Overview

The Dire Dawa Cleaning system uses a simple migration runner (`database/migrate.js`) to manage
schema changes versionally. The `database/postgresql/schema.sql` file remains the source of truth for fresh
installs; migrations handle upgrades to existing databases.

The legacy `database/schema.sql` (MariaDB) is kept for reference but is no longer used at runtime.

## Naming Convention

```
NNN_snake_case_description.js
```

- `NNN` — Sequential 3-digit number (001, 002, 003…)
- Description — lowercase, underscores, no spaces
- Examples: `001_add_lifecycle_fields.js`, `002_add_payment_index.js`

## Migration File Structure

```js
async function up(db) {
  // Apply changes — receives pg Pool (node-postgres)
  await db.query("ALTER TABLE ...");
}

async function down(db) {
  // Rollback changes — MUST be the exact inverse of up()
  await db.query("ALTER TABLE ... DROP COLUMN ...");
}

module.exports = { up, down };
```

- `db` is a `pg.Pool` — use `db.query(sql, params)` with `$1, $2` placeholders.
- Transactions are handled by the runner (`BEGIN`/`COMMIT`/`ROLLBACK`).
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotency where appropriate.

## Commands

```bash
# Apply all pending migrations
node database/migrate.js up

# Rollback the last applied migration
node database/migrate.js down

# Show which migrations are applied/pending
node database/migrate.js status

# Create a new migration file (auto-numbered)
node database/migrate.js create add_payment_index
```

## How It Works

1. A `_migrations` table tracks which migrations have been applied
2. `migrate.js up` runs all `.js` files in `database/migrations/` that haven't been applied yet
3. Each migration runs inside a transaction — if it fails, it rolls back cleanly
4. `migrate.js down` reverses the last applied migration using its `down()` function

## Development Database Setup

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d db

# 2. Apply schema (fresh install)
psql -h localhost -U ddcms -d dire_dawa_cleaning -f database/postgresql/schema.sql
# Or via Docker:
docker exec -i ddcms_db psql -U ddcms -d dire_dawa_cleaning < database/postgresql/schema.sql

# 3. Run migrations (for existing databases)
DB_HOST=localhost DB_USER=ddcms DB_PASSWORD=... node database/migrate.js up
```

## Test Database Setup

Tests use the same PostgreSQL service. The CI workflow creates the schema from `database/postgresql/schema.sql`
before running tests. Migrations should be compatible with the test database.

```bash
# In CI or local testing
psql -h localhost -U ddcms -d dire_dawa_cleaning < database/postgresql/schema.sql
node database/migrate.js up
```

## PostgreSQL Notes

- ** Placeholders:** Use `$1, $2, ...` (not `?`)
- ** Upserts:** `INSERT ... ON CONFLICT (col) DO UPDATE SET col=EXCLUDED.col` (not `ON DUPLICATE KEY UPDATE`)
- ** Auto-increment:** `SERIAL` / `GENERATED ALWAYS AS IDENTITY` (not `AUTO_INCREMENT`)
- ** Timestamps:** `TIMESTAMP` + `NOW()` + trigger for `updated_at` (not `DATETIME` + `ON UPDATE CURRENT_TIMESTAMP`)
- ** Enums:** PostgreSQL `TYPE` (e.g. `user_role`, `business_type`) — see `database/postgresql/schema.sql`
- ** JSON:** `JSONB` column type
- ** Errors:** `err.code === "23505"` for unique violations (not `ER_DUP_ENTRY`)

## Rollback Expectations

- Every migration **must** have a `down()` function
- `down()` must be the exact inverse of `up()`
- Only single-step rollback is supported (`down` rolls back the last migration only)
- Destructive rollbacks (dropping columns/tables) lose data — use with caution
- Non-destructive rollbacks (adding indexes, adding nullable columns) are safe

## Rules

1. **Never modify an applied migration** — create a new one instead
2. **Always test both up and down** before committing
3. **Keep migrations small** — one logical change per file
4. **schema.sql stays canonical** for fresh installs — migrations are for upgrades
5. **No data migrations in schema changes** — separate data fixes into their own migration
