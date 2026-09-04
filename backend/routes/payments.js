const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");
const logger = require("../config/logger");
const audit = require("../services/auditService");
const paymentService = require("../services/paymentService");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const router = express.Router();

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || process.env.SESSION_SECRET;
if (!PAYMENT_WEBHOOK_SECRET) {
  logger.warn("No PAYMENT_WEBHOOK_SECRET or SESSION_SECRET set — webhook signature verification disabled");
}

function genReceipt() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `RCP-${ts}-${rand}`;
}

// ── Webhook Callback Routes (MUST be before authenticate middleware) ──
async function handleGatewayCallback(req, res, next, gateway) {
  try {
    const payload = req.body;
    logger.info(`Received ${gateway} callback webhook payload:`, payload);

    const { signature, tradeNo, outTradeNo, status, amount } = payload;
    
    const dataToVerify = { tradeNo, outTradeNo, status, amount, timestamp: payload.timestamp };
    const expectedSignature = PAYMENT_WEBHOOK_SECRET
      ? crypto.createHmac("sha256", PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(dataToVerify)).digest("hex")
      : null;

    if (!PAYMENT_WEBHOOK_SECRET || signature !== expectedSignature) {
      logger.warn(`Invalid signature received in ${gateway} callback`);
      return res.status(400).json({ error: "Invalid signature" });
    }

    const finalStatus = status === "SUCCESS" ? "paid" : "failed";
    const paidAtVal = status === "SUCCESS" ? new Date() : null;

    const result = await db.query(
      "UPDATE payments SET status=$1, paid_at=$2 WHERE receipt_number=$3 AND gateway_name=$4",
      [finalStatus, paidAtVal, outTradeNo, gateway]
    );

    if (result.rowCount === 0) {
      logger.warn(`No pending payment found matching receipt ${outTradeNo} for ${gateway}`);
      return res.status(404).json({ error: "Payment record not found" });
    }

    logger.info(`Successfully processed ${gateway} callback. Payment ${outTradeNo} updated to ${finalStatus}`);
    res.json({ code: 200, message: "success" });
  } catch (err) {
    next(err);
  }
}

router.post("/callback/telebirr", (req, res, next) => handleGatewayCallback(req, res, next, "telebirr"));
router.post("/callback/cbebirr", (req, res, next) => handleGatewayCallback(req, res, next, "cbebirr"));

// ── Authenticated Routes ──
router.use(authenticate);

router.get("/summary/dashboard", validate(schemas.dashboardQuery, "query"), async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    const m = req.query.month || new Date().getMonth() + 1;
    let whereExtra = "", extraParams = [], extraIdx = 3;
    if (req.user.role === "leader") {
      whereExtra = ` AND sz.leader_id=$${extraIdx}`; extraParams = [req.user.id];
    }
    const totalsResult = await db.query(
      `SELECT SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END) AS total_collected,
              SUM(CASE WHEN p.status='pending' THEN p.amount ELSE 0 END) AS total_pending,
              SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END) AS total_overdue
       FROM payments p JOIN businesses b ON b.id=p.business_id
       JOIN safer_zones sz ON sz.id=b.safer_zone_id
       WHERE p.year=$1 AND p.month=$2${whereExtra}`, [y, m, ...extraParams]);
    const totals = totalsResult.rows[0];

    let whereExtra2 = "", extraParams2 = [], extraIdx2 = 3;
    if (req.user.role === "leader") {
      whereExtra2 = ` AND sz.leader_id=$${extraIdx2}`; extraParams2 = [req.user.id];
    }
    const byKebeleResult = await db.query(
      `SELECT k.name AS kebele,k.code,
              SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END) AS collected,
              SUM(b.monthly_target) AS target
       FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id
       JOIN kebeles k ON k.id=sz.kebele_id
       LEFT JOIN payments p ON p.business_id=b.id AND p.month=$1 AND p.year=$2${whereExtra2}
       GROUP BY k.id ORDER BY k.code`, [m, y, ...extraParams2]);
    const byKebele = byKebeleResult.rows;

    let whereExtra3 = "", extraParams3 = [], extraIdx3 = 2;
    if (req.user.role === "leader") {
      whereExtra3 = ` AND sz.leader_id=$${extraIdx3}`; extraParams3 = [req.user.id];
    }
    const monthlyResult = await db.query(
      `SELECT p.month,SUM(p.amount) AS collected FROM payments p
       JOIN businesses b ON b.id=p.business_id JOIN safer_zones sz ON sz.id=b.safer_zone_id
       WHERE p.year=$1 AND p.status='paid'${whereExtra3}
       GROUP BY p.month ORDER BY p.month`, [y, ...extraParams3]);
    const monthly = monthlyResult.rows;

    res.json({ totals, byKebele, monthly });
  } catch (err) { next(err); }
});

router.get("/", validate(schemas.paymentsListQuery, "query"), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const hasPagination = page > 0 && limit > 0;
    const search = (req.query.search || "").trim();
    const { businessId, kebeleId, saferZoneId, month, year, status, method } = req.query;
    // Zod coerce.number will convert valid int strings; id primitive ensures int positive
    const bizId = businessId ? Number(businessId) : null;
    const kebId = kebeleId ? Number(kebeleId) : null;
    const szId = saferZoneId ? Number(saferZoneId) : null;
    const stat = status;
    let baseSql = ` FROM payments p JOIN businesses b ON b.id=p.business_id
             JOIN safer_zones sz ON sz.id=b.safer_zone_id
             JOIN kebeles k ON k.id=sz.kebele_id
             JOIN users u ON u.id=p.collected_by WHERE 1=1`;
    const whereParams = [];
    let wIdx = 1;
    if (req.user.role === "leader") { baseSql += ` AND sz.leader_id=$${wIdx}`; whereParams.push(req.user.id); wIdx++; }
    else {
      if (bizId) { baseSql += ` AND p.business_id=$${wIdx}`; whereParams.push(bizId); wIdx++; }
      if (kebId) { baseSql += ` AND k.id=$${wIdx}`; whereParams.push(kebId); wIdx++; }
      if (szId) { baseSql += ` AND sz.id=$${wIdx}`; whereParams.push(szId); wIdx++; }
    }
    if (month) { baseSql += ` AND p.month=$${wIdx}`; whereParams.push(month); wIdx++; }
    if (year) { baseSql += ` AND p.year=$${wIdx}`; whereParams.push(year); wIdx++; }
    if (status) { baseSql += ` AND p.status=$${wIdx}`; whereParams.push(status); wIdx++; }
    if (method) { baseSql += ` AND p.method=$${wIdx}`; whereParams.push(method); wIdx++; }
    if (search) {
      baseSql += ` AND (b.name ILIKE $${wIdx} OR p.receipt_number ILIKE $${wIdx} OR p.amount::text ILIKE $${wIdx})`;
      whereParams.push(`%${search}%`);
      wIdx++;
    }
    const orderSql = " ORDER BY p.year DESC,p.month DESC,b.name";
    if (!hasPagination) {
      const sql = `SELECT p.*, b.name AS business_name, b.monthly_target, sz.name AS safer_zone_name, k.name AS kebele_name, k.id AS kebele_id, u.full_name AS collector_name${baseSql}${orderSql}`;
      const result = await db.query(sql, whereParams);
      return res.json(result.rows);
    }
    const countSql = `SELECT COUNT(*)::int AS total${baseSql}`;
    const countRes = await db.query(countSql, whereParams);
    const total = countRes.rows[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const dataSql = `SELECT p.*, b.name AS business_name, b.monthly_target, sz.name AS safer_zone_name, k.name AS kebele_name, k.id AS kebele_id, u.full_name AS collector_name${baseSql}${orderSql} LIMIT $${wIdx} OFFSET $${wIdx+1}`;
    const dataParams = [...whereParams, limit, offset];
    const result = await db.query(dataSql, dataParams);
    res.json({ data: result.rows, total, page, pages });
  } catch (err) { next(err); }
});

router.post("/", requireRole("admin", "collector", "leader"), validate(schemas.createPayment), async (req, res, next) => {
  try {
    const { businessId, amount, method, month, year, notes } = req.body;
    if (!businessId || !amount || !month || !year) return res.status(400).json({error: "businessId,amount,month,year required"});
    
    if (req.user.role === "leader") {
      const zr = await db.query(
        "SELECT b.id FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id WHERE b.id=$1 AND sz.leader_id=$2",
        [businessId, req.user.id]);
      if (!zr.rows.length) return res.status(403).json({ error: "Business not in your zone" });
    }

    const receipt = genReceipt();
    const isGateway = (method === "telebirr" || method === "cbebirr");
    const initialStatus = isGateway ? "pending" : "paid";
    const paidAtVal = isGateway ? null : new Date();

    let paymentUrl = null;
    let gatewayRef = null;

    if (isGateway) {
      const bResult = await db.query("SELECT name FROM businesses WHERE id=$1", [businessId]);
      if (!bResult.rows.length) return res.status(404).json({ error: "Business not found" });
      const businessName = bResult.rows[0].name;

      const host = req.headers.host;
      const checkout = await paymentService.initiatePayment({
        txId: receipt,
        amount: parseFloat(amount),
        gateway: method,
        businessName,
        host
      });
      paymentUrl = checkout.paymentUrl;
      gatewayRef = checkout.gatewayRef;
    }

    const r = await db.query(
      `INSERT INTO payments (business_id,amount,method,status,month,year,paid_at,receipt_number,notes,collected_by,gateway_name,gateway_ref,payment_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [businessId, amount, method || "cash", initialStatus, month, year, paidAtVal, receipt, notes || null, req.user.id, isGateway ? method : null, gatewayRef, paymentUrl]
    );
    const insertedId = r.rows[0].id;

    audit.log(req,"CREATE","payment",insertedId,null,{businessId,amount,method:method||"cash",month,year,status:initialStatus,receiptNumber:receipt});
    res.status(201).json({
      id: insertedId,
      receiptNumber: receipt,
      paidAt: paidAtVal,
      status: initialStatus,
      paymentUrl,
      gatewayName: isGateway ? method : null
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Payment already recorded for this period" });
    next(err);
  }
});

router.get("/:id/verify", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM payments WHERE id=$1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Payment record not found" });
    const payment = result.rows[0];
    res.json({ status: payment.status });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("admin", "collector"), validate(schemas.updatePayment), async (req, res, next) => {
  try {
    const { amount, method, status, notes } = req.body;
    const oldResult = await db.query("SELECT amount,method,status,notes FROM payments WHERE id=$1", [req.params.id]);
    await db.query("UPDATE payments SET amount=$1,method=$2,status=$3,notes=$4 WHERE id=$5",
      [amount, method, status, notes || null, req.params.id]);
    audit.log(req,"UPDATE","payment",parseInt(req.params.id),oldResult.rows[0]||null,{amount,method,status,notes});
    res.json({ message: "Updated" });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const oldResult = await db.query("SELECT business_id,amount,method,status,month,year FROM payments WHERE id=$1", [req.params.id]);
    await db.query("DELETE FROM payments WHERE id=$1", [req.params.id]);
    audit.log(req,"DELETE","payment",parseInt(req.params.id),oldResult.rows[0]||null,null);
    res.json({ message: "Deleted" });
  }
  catch (err) { next(err); }
});

module.exports = router;
