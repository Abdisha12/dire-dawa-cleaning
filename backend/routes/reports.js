const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const PDFDocument = require("pdfkit");
const { generatePaymentsPDF, generatePayrollPDF, generateInspectionsPDF } = require("../services/pdfService");
const { generatePaymentsExcel, generatePayrollExcel, generateInspectionsExcel, generateMonthlySummaryExcel } = require("../services/excelService");

const router = express.Router();
router.use(authenticate);

// Prefix dangerous values to prevent CSV formula injection in spreadsheets.
// Values starting with = + - @ \t \r or " can be interpreted as formulas.
function sanitizeCSVValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (!s.length) return "";
  const first = s.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r") {
    return "'" + s; // Prefix with single quote — spreadsheet treats as text
  }
  return s;
}

function toCSV(rows) {
  if (!rows.length) return "";
  const h = Object.keys(rows[0]).join(",");
  const lines = rows.map(r => Object.values(r).map(v => {
    const val = sanitizeCSVValue(v);
    if (!val) return "";
    return val.includes(",") || val.includes('"') || val.includes("\n")
      ? `"${val.replace(/"/g, '""')}"`
      : val;
  }).join(","));
  return [h, ...lines].join("\r\n");
}

router.get("/payments/monthly", validate(schemas.reportQuery, "query"), async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    let sql = `SELECT p.id, b.name AS business, sz.name AS zone, k.name AS kebele,
                    p.amount, p.method, p.status, p.month, p.year, p.paid_at, p.receipt_number,
                    u.full_name AS collector
             FROM payments p JOIN businesses b ON b.id=p.business_id
             JOIN safer_zones sz ON sz.id=b.safer_zone_id JOIN kebeles k ON k.id=sz.kebele_id
             JOIN users u ON u.id=p.collected_by WHERE p.month=? AND p.year=?`;
    const params = [m, y];
    if (req.user.role === "leader") { sql += " AND sz.leader_id=?"; params.push(req.user.id); }
    sql += " ORDER BY k.code,sz.name,b.name";
    const [rows] = await db.execute(sql, params);

    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="payments_${y}_${m}.csv"`);
      return res.send(toCSV(rows));
    }
    if (req.query.format === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4", bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="payments_${y}_${m}.pdf"`);
      doc.pipe(res);
      generatePaymentsPDF(doc, rows, m, y);
      doc.end();
      return;
    }
    if (req.query.format === "xlsx") {
      const buffer = await generatePaymentsExcel(rows, m, y);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="payments_${y}_${m}.xlsx"`);
      return res.send(buffer);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/payments/yearly", validate(schemas.reportQuery, "query"), async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const [rows] = await db.execute(
      `SELECT p.month,COUNT(*) AS count,
              SUM(CASE WHEN p.status="paid" THEN p.amount END) AS collected,
              SUM(CASE WHEN p.status="pending" THEN p.amount END) AS pending,
              SUM(CASE WHEN p.status="overdue" THEN p.amount END) AS overdue
       FROM payments p WHERE p.year=? GROUP BY p.month ORDER BY p.month`, [y]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/workers/monthly", validate(schemas.reportQuery, "query"), async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);
    let sql = `SELECT w.full_name,sz.name AS zone,k.name AS kebele,w.daily_wage,
                    COUNT(CASE WHEN a.present=1 THEN 1 END) AS days_present,
                    COUNT(CASE WHEN a.present=0 THEN 1 END) AS days_absent,
                    COALESCE(SUM(a.bonus),0) AS total_bonus,
                    (COUNT(CASE WHEN a.present=1 THEN 1 END)*w.daily_wage+COALESCE(SUM(a.bonus),0)) AS gross
             FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id
             LEFT JOIN kebeles k ON k.id=sz.kebele_id
             LEFT JOIN attendance a ON a.worker_id=w.id AND a.date BETWEEN ? AND ?
             WHERE w.is_active=1`;
    const params = [first, last];
    if (req.user.role === "leader") { sql += " AND sz.leader_id=?"; params.push(req.user.id); }
    sql += " GROUP BY w.id ORDER BY sz.name,w.full_name";
    const [rows] = await db.execute(sql, params);

    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="workers_${y}_${m}.csv"`);
      return res.send(toCSV(rows));
    }
    if (req.query.format === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4", bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="workers_${y}_${m}.pdf"`);
      doc.pipe(res);
      generatePayrollPDF(doc, rows, m, y);
      doc.end();
      return;
    }
    if (req.query.format === "xlsx") {
      const buffer = await generatePayrollExcel(rows, m, y);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="workers_${y}_${m}.xlsx"`);
      return res.send(buffer);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/inspections", validate(schemas.reportQuery, "query"), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT i.date,k.name AS kebele,sz.name AS zone,i.status,i.notes,
                    u.full_name AS inspector,COUNT(ip.id) AS photo_count
             FROM inspections i JOIN kebeles k ON k.id=i.kebele_id
             LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id
             JOIN users u ON u.id=i.inspected_by
             LEFT JOIN inspection_photos ip ON ip.inspection_id=i.id WHERE 1=1`;
    const params = [];
    if (req.user.role === "leader") { sql += " AND sz.leader_id=?"; params.push(req.user.id); }
    if (from) { sql += " AND i.date>=?"; params.push(from); }
    if (to) { sql += " AND i.date<=?"; params.push(to); }
    sql += " GROUP BY i.id ORDER BY i.date DESC,k.code";
    const [rows] = await db.execute(sql, params);

    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=inspections.csv");
      return res.send(toCSV(rows));
    }
    if (req.query.format === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4", bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=inspections.pdf");
      doc.pipe(res);
      generateInspectionsPDF(doc, rows, from, to);
      doc.end();
      return;
    }
    if (req.query.format === "xlsx") {
      const buffer = await generateInspectionsExcel(rows, from, to);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=inspections.xlsx");
      return res.send(buffer);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reports/monthly-summary — consolidated summary (payments + workers + inspections)
router.get("/monthly-summary", async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);

    const [payments] = await db.execute(
      `SELECT p.id, b.name AS business, sz.name AS zone, p.amount, p.method, p.status
       FROM payments p JOIN businesses b ON b.id=p.business_id
       JOIN safer_zones sz ON sz.id=b.safer_zone_id WHERE p.month=? AND p.year=?`, [m, y]
    );

    const [workers] = await db.execute(
      `SELECT w.full_name, sz.name AS zone,
              COUNT(CASE WHEN a.present=1 THEN 1 END) AS days_present,
              COUNT(CASE WHEN a.present=0 THEN 1 END) AS days_absent,
              (COUNT(CASE WHEN a.present=1 THEN 1 END)*w.daily_wage+COALESCE(SUM(a.bonus),0)) AS gross
       FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id
       LEFT JOIN attendance a ON a.worker_id=w.id AND a.date BETWEEN ? AND ?
       WHERE w.is_active=1 GROUP BY w.id`, [first, last]
    );

    const [inspections] = await db.execute(
      `SELECT i.date, k.name AS kebele, sz.name AS zone, i.status, u.full_name AS inspector
       FROM inspections i JOIN kebeles k ON k.id=i.kebele_id
       LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id JOIN users u ON u.id=i.inspected_by
       WHERE i.date BETWEEN ? AND ?`, [first, last]
    );

    if (req.query.format === "xlsx") {
      const buffer = await generateMonthlySummaryExcel({ payments, workers, inspections }, m, y);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="monthly_summary_${y}_${m}.xlsx"`);
      return res.send(buffer);
    }

    res.json({ payments, workers, inspections });
  } catch (err) { next(err); }
});

module.exports = router;
