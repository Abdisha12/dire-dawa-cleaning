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

// Dedicated HMAC key for payment webhook signatures (separate from SESSION_SECRET)
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
    
    // Signature verification for Sandbox / Mock callbacks
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

    // Update payment record in database
    const [result] = await db.execute(
      "UPDATE payments SET status=?, paid_at=? WHERE receipt_number=? AND gateway_name=?",
      [finalStatus, paidAtVal, outTradeNo, gateway]
    );

    if (result.affectedRows === 0) {
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
    let whereExtra = "", extraParams = [];
    if (req.user.role === "leader") {
      whereExtra = " AND sz.leader_id=?"; extraParams = [req.user.id];
    }
    const [[totals]] = await db.execute(
      `SELECT SUM(CASE WHEN p.status="paid" THEN p.amount ELSE 0 END) AS total_collected,
              SUM(CASE WHEN p.status="pending" THEN p.amount ELSE 0 END) AS total_pending,
              SUM(CASE WHEN p.status="overdue" THEN p.amount ELSE 0 END) AS total_overdue
       FROM payments p JOIN businesses b ON b.id=p.business_id
       JOIN safer_zones sz ON sz.id=b.safer_zone_id
       WHERE p.year=? AND p.month=?${whereExtra}`, [y, m, ...extraParams]);
    const [byKebele] = await db.execute(
      `SELECT k.name AS kebele,k.code,
              SUM(CASE WHEN p.status="paid" THEN p.amount ELSE 0 END) AS collected,
              SUM(b.monthly_target) AS target
       FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id
       JOIN kebeles k ON k.id=sz.kebele_id
       LEFT JOIN payments p ON p.business_id=b.id AND p.month=? AND p.year=?${whereExtra}
       GROUP BY k.id ORDER BY k.code`, [m, y, ...extraParams]);
    const [monthly] = await db.execute(
      `SELECT p.month,SUM(p.amount) AS collected FROM payments p
       JOIN businesses b ON b.id=p.business_id JOIN safer_zones sz ON sz.id=b.safer_zone_id
       WHERE p.year=? AND p.status="paid"${whereExtra}
       GROUP BY p.month ORDER BY p.month`, [y, ...extraParams]);
    res.json({ totals, byKebele, monthly });
  } catch (err) { next(err); }
});

router.get("/", async (req, res, next) => {
  try {
    const { businessId, kebeleId, saferZoneId, month, year, status } = req.query;
    let sql = `SELECT p.*, b.name AS business_name, b.monthly_target,
                    sz.name AS safer_zone_name, k.name AS kebele_name, k.id AS kebele_id,
                    u.full_name AS collector_name
             FROM payments p JOIN businesses b ON b.id=p.business_id
             JOIN safer_zones sz ON sz.id=b.safer_zone_id
             JOIN kebeles k ON k.id=sz.kebele_id
             JOIN users u ON u.id=p.collected_by WHERE 1=1`;
    const params = [];
    if (req.user.role === "leader") { sql += " AND sz.leader_id=?"; params.push(req.user.id); }
    else {
      if (businessId) { sql += " AND p.business_id=?"; params.push(businessId); }
      if (kebeleId) { sql += " AND k.id=?"; params.push(kebeleId); }
      if (saferZoneId) { sql += " AND sz.id=?"; params.push(saferZoneId); }
    }
    if (month) { sql += " AND p.month=?"; params.push(month); }
    if (year) { sql += " AND p.year=?"; params.push(year); }
    if (status) { sql += " AND p.status=?"; params.push(status); }
    sql += " ORDER BY p.year DESC,p.month DESC,b.name";
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", requireRole("admin", "collector", "leader"), validate(schemas.createPayment), async (req, res, next) => {
  try {
    const { businessId, amount, method, month, year, notes } = req.body;
    if (!businessId || !amount || !month || !year) return res.status(400).json({error: "businessId,amount,month,year required"});
    
    if (req.user.role === "leader") {
      const [zr] = await db.execute(
        "SELECT b.id FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id WHERE b.id=? AND sz.leader_id=?",
        [businessId, req.user.id]);
      if (!zr.length) return res.status(403).json({ error: "Business not in your zone" });
    }

    const receipt = genReceipt();
    const isGateway = (method === "telebirr" || method === "cbebirr");
    const initialStatus = isGateway ? "pending" : "paid";
    const paidAtVal = isGateway ? null : new Date();

    let paymentUrl = null;
    let gatewayRef = null;

    if (isGateway) {
      const [bRows] = await db.execute("SELECT name FROM businesses WHERE id=?", [businessId]);
      if (!bRows.length) return res.status(404).json({ error: "Business not found" });
      const businessName = bRows[0].name;

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

    const [r] = await db.execute(
      `INSERT INTO payments (business_id,amount,method,status,month,year,paid_at,receipt_number,notes,collected_by,gateway_name,gateway_ref,payment_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [businessId, amount, method || "cash", initialStatus, month, year, paidAtVal, receipt, notes || null, req.user.id, isGateway ? method : null, gatewayRef, paymentUrl]
    );

    audit.log(req,"CREATE","payment",r.insertId,null,{businessId,amount,method:method||"cash",month,year,status:initialStatus,receiptNumber:receipt});
    res.status(201).json({
      id: r.insertId,
      receiptNumber: receipt,
      paidAt: paidAtVal,
      status: initialStatus,
      paymentUrl,
      gatewayName: isGateway ? method : null
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Payment already recorded for this period" });
    next(err);
  }
});

router.get("/:id/verify", async (req, res, next) => {
  try {
    const [rows] = await db.execute("SELECT * FROM payments WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Payment record not found" });
    const payment = rows[0];
    res.json({ status: payment.status });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("admin", "collector"), validate(schemas.updatePayment), async (req, res, next) => {
  try {
    const { amount, method, status, notes } = req.body;
    const [old] = await db.execute("SELECT amount,method,status,notes FROM payments WHERE id=?", [req.params.id]);
    await db.execute("UPDATE payments SET amount=?,method=?,status=?,notes=? WHERE id=?",
      [amount, method, status, notes || null, req.params.id]);
    audit.log(req,"UPDATE","payment",parseInt(req.params.id),old[0]||null,{amount,method,status,notes});
    res.json({ message: "Updated" });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const [old] = await db.execute("SELECT business_id,amount,method,status,month,year FROM payments WHERE id=?", [req.params.id]);
    await db.execute("DELETE FROM payments WHERE id=?", [req.params.id]);
    audit.log(req,"DELETE","payment",parseInt(req.params.id),old[0]||null,null);
    res.json({ message: "Deleted" });
  }
  catch (err) { next(err); }
});

module.exports = router;
