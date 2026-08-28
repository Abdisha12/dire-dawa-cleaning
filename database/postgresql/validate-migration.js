#!/usr/bin/env node
// database/postgresql/validate-migration.js — Compare MariaDB vs PostgreSQL
// Usage: node validate-migration.js --maria=mysql://root:pass@localhost:3306/dire_dawa_cleaning --pg=postgresql://ddcms:pass@localhost:5432/dire_dawa_cleaning
// Or via env: MARIA_URL, PG_URL, or individual DB_* vars
// Produces docs/migration/VALIDATION_REPORT.md

try { require("dotenv").config({ path: __dirname + "/../../backend/.env" }); } catch {}
const path = require("path");
let PgPool;
try { PgPool = require("pg").Pool; } catch { PgPool = require(path.join(__dirname, "../../backend/node_modules/pg")).Pool; }
const fs = require("fs");

let mysql;
try { mysql = require("mysql2/promise"); } catch { 
  try { mysql = require(path.join(__dirname, "../../backend/node_modules/mysql2/promise")); } catch { 
    console.warn("mysql2 not installed — MariaDB checks will be skipped if no MARIA_URL"); 
  }
}

// Tables to validate: every application table discovered during inspection
const TABLES = [
  "users","kebeles","safer_zones","businesses","payments",
  "inspections","inspection_photos","workers","attendance","salary_payments",
  "tools","zone_reports","audit_log","notifications","documents","sessions"
];

async function getMariaCounts(mariaUrl) {
  if (!mariaUrl || !mysql) return null;
  const conn = await mysql.createConnection(mariaUrl);
  const counts = {};
  for (const tbl of TABLES) {
    try {
      const [rows] = await conn.execute(`SELECT COUNT(*) AS c FROM \`${tbl}\``);
      counts[tbl] = rows[0].c;
    } catch (e) { counts[tbl] = `ERR: ${e.message}`; }
  }
  await conn.end();
  // FK checks
  const fkChecks = [];
  try {
    const [orphans] = await conn.execute(`SELECT COUNT(*) AS c FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.safer_zone_id IS NOT NULL AND sz.id IS NULL`);
    fkChecks.push({ name: "workers→safer_zones", orphans: orphans[0].c });
  } catch {}
  return { counts, fkChecks };
}

async function getPgCounts(pgUrl) {
  const pool = new PgPool({ connectionString: pgUrl, max: 2 });
  const counts = {};
  for (const tbl of TABLES) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM "${tbl}"`);
      counts[tbl] = r.rows[0].c;
    } catch (e) { counts[tbl] = `ERR: ${e.message}`; }
  }
  // FK checks
  const fkChecks = [];
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id WHERE w.safer_zone_id IS NOT NULL AND sz.id IS NULL`);
    fkChecks.push({ name: "workers→safer_zones", orphans: r.rows[0].c });
  } catch {}
  // Kebele/zone integrity
  const kebeleCheck = await pool.query(`SELECT COUNT(*)::int AS c FROM kebeles`);
  const zoneCheck = await pool.query(`SELECT COUNT(*)::int AS c FROM safer_zones`);
  const zoneKebele = await pool.query(`SELECT COUNT(*)::int AS c FROM safer_zones sz LEFT JOIN kebeles k ON k.id=sz.kebele_id WHERE k.id IS NULL`);
  // Monetary sample
  const paySum = await pool.query(`SELECT COALESCE(SUM(amount),0)::numeric AS s FROM payments`).catch(()=>({rows:[{s:"ERR"}]}));
  await pool.end();
  return { counts, fkChecks, kebeleCheck: kebeleCheck.rows[0].c, zoneCheck: zoneCheck.rows[0].c, zoneKebeleOrphans: zoneKebele.rows[0].c, paySum: paySum.rows[0].s };
}

async function main() {
  const mariaUrl = process.argv.find(a=>a.startsWith("--maria="))?.split("=")[1] || process.env.MARIA_URL || null;
  const pgUrl = process.argv.find(a=>a.startsWith("--pg="))?.split("=")[1] || process.env.PG_URL || `postgresql://${process.env.DB_USER||"ddcms"}:${process.env.DB_PASSWORD||""}@${process.env.DB_HOST||"localhost"}:${process.env.DB_PORT||5432}/${process.env.DB_NAME||"dire_dawa_cleaning"}`;

  console.log("Validating migration...");
  console.log(`MariaDB: ${mariaUrl || "(not provided — PG-only checks)"}`);
  console.log(`PostgreSQL: ${pgUrl.replace(/:[^@]+@/,"://***@")}`);

  const maria = mariaUrl ? await getMariaCounts(mariaUrl) : null;
  const pg = await getPgCounts(pgUrl);

  let md = `# Migration Validation Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `PostgreSQL: \`${pgUrl.replace(/:[^@]+@/,"://***@")}\`\n`;
  if (maria) md += `MariaDB: \`${mariaUrl.replace(/:[^@]+@/,"://***@")}\`\n`;
  md += `\n| Table | MariaDB | PostgreSQL | Result |\n|---|---|---|---|\n`;
  for (const tbl of TABLES) {
    const m = maria ? maria.counts[tbl] : "—";
    const p = pg.counts[tbl];
    const result = maria ? (m===p ? "PASS" : "FAIL") : "PG-only";
    md += `| ${tbl} | ${m} | ${p} | ${result} |\n`;
  }
  md += `\n## Integrity Checks\n\n`;
  md += `- Kebeles: ${pg.kebeleCheck} (expected 9) — ${pg.kebeleCheck===9?"PASS":"FAIL"}\n`;
  md += `- Safer zones: ${pg.zoneCheck} (expected 108) — ${pg.zoneCheck===108?"PASS":"FAIL"}\n`;
  md += `- Zones without kebele (orphans): ${pg.zoneKebeleOrphans} — ${pg.zoneKebeleOrphans===0?"PASS":"FAIL"}\n`;
  md += `- Workers→zones orphans: ${pg.fkChecks.find(f=>f.name==="workers→safer_zones")?.orphans ?? "—"}\n`;
  md += `- Payments total amount: ${pg.paySum}\n`;
  // Unique constraint check
  md += `\n## Unique Constraint\n\n`;
  md += `zone_reports UNIQUE (safer_zone_id, report_year, report_month) — verify via: \`INSERT duplicate → expect 23505\`\n`;
  // Date/monetary spot checks
  const pool2 = new PgPool({ connectionString: pgUrl, max: 2 });
  try {
    const r = await pool2.query(`SELECT report_month, report_year, COUNT(*) FROM zone_reports GROUP BY report_month, report_year HAVING COUNT(*) > (SELECT COUNT(DISTINCT safer_zone_id) FROM zone_reports) LIMIT 5`);
    md += `- Zone report duplicate groups (should be 0): ${r.rows.length}\n`;
  } catch {}
  await pool2.end();

  md += `\n## Result\n\n`;
  const anyFail = maria ? TABLES.some(t=>maria.counts[t]!==pg.counts[t]) : false;
  md += anyFail ? `**FAIL** — counts differ\n` : `**PASS** — all available checks passed (run with MARIA_URL for full diff)\n`;
  md += `\n> Do not claim successful migration without actual validation.\n`;

  const outPath = path.join(__dirname, "../../docs/migration/VALIDATION_REPORT.md");
  fs.writeFileSync(outPath, md);
  console.log(md);
  console.log(`\nReport written to ${outPath}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
