const express = require("express");
const db = require("../config/db");
const router = express.Router();

// Public stats - no auth required, shown on landing page
router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const y = now.getFullYear(),
      m = now.getMonth() + 1;

    const kebelesResult = await db.query("SELECT COUNT(*) AS c FROM kebeles");
    const zonesResult = await db.query("SELECT COUNT(*) AS c FROM safer_zones");
    const businessesResult = await db.query("SELECT COUNT(*) AS c FROM businesses WHERE is_active=TRUE");
    const workersResult = await db.query("SELECT COUNT(*) AS c FROM workers WHERE is_active=TRUE");
    const leadersResult = await db.query("SELECT COUNT(*) AS c FROM safer_zones WHERE leader_id IS NOT NULL");
    const inspectionsResult = await db.query(
      "SELECT COUNT(*) AS c FROM inspections WHERE date>=NOW() - INTERVAL '30 days'"
    );
    const collectedResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status='paid' AND month=$1 AND year=$2",
      [m, y]
    );
    const reportsResult = await db.query("SELECT COUNT(*) AS c FROM zone_reports WHERE status='approved'");

    res.json({
      kebeles: kebelesResult.rows[0].c,
      zones: zonesResult.rows[0].c,
      businesses: businessesResult.rows[0].c,
      workers: workersResult.rows[0].c,
      leadersAssigned: leadersResult.rows[0].c,
      inspectionsLast30Days: inspectionsResult.rows[0].c,
      collectedThisMonth: collectedResult.rows[0].total,
      approvedReports: reportsResult.rows[0].c
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
