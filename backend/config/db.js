// backend/config/db.js — PostgreSQL connection pool
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "ddcms",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dire_dawa_cleaning",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Test connection on startup
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT current_database(), version()");
    console.log("✅  PostgreSQL connected:", res.rows[0].current_database);
    console.log("   Version:", res.rows[0].version.split(",")[0]);
    client.release();
  } catch (e) {
    if (process.env.NODE_ENV === "test") {
      console.warn("⚠️  PostgreSQL connection failed (test mode) - continuing:", e.message);
    } else {
      console.error("❌  PostgreSQL failed:", e.message);
      process.exit(1);
    }
  }
})();

module.exports = pool;
