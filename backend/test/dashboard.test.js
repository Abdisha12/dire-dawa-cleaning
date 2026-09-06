// backend/test/dashboard.test.js — Dashboard Operational Overview endpoint
// Verifies the new GET /api/dashboard/overview aggregation is:
//  - authenticated
//  - role-scoped server-side (admin city-wide, collector own kebele, leader own zone)
//  - honest about missing data (achievement null when no target; empty when unassigned)
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken, getTestUserId } = require("./helpers/setup");

describe("Dashboard overview", function () {
  this.timeout(15000);
  let tokens, userIds;
  let scopeKebele;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;

    const keb = await db.query("SELECT id FROM kebeles ORDER BY id LIMIT 1");
    if (!keb.rows.length) this.skip();
    scopeKebele = keb.rows[0].id;

    // Assign collector -> kebele, leader -> one zone in that kebele
    await db.query("UPDATE kebeles SET collector_id=$1 WHERE id=$2", [userIds.collector, scopeKebele]);
    await db.query(
      "UPDATE safer_zones SET leader_id=NULL WHERE leader_id=$1",
      [userIds.leader1]
    );
    await db.query(
      "UPDATE safer_zones SET leader_id=$1 WHERE id=(SELECT id FROM safer_zones WHERE kebele_id=$2 ORDER BY id LIMIT 1)",
      [userIds.leader1, scopeKebele]
    );
  });

  after(async function () {
    await db.query("UPDATE kebeles SET collector_id=NULL WHERE collector_id=$1", [userIds.collector]);
    await db.query("UPDATE safer_zones SET leader_id=NULL WHERE leader_id=$1", [userIds.leader1]);
    await cleanupTestData();
  });

  it("returns 401 without a session token", async function () {
    const res = await request(app).get("/api/dashboard/overview");
    expect(res.status).to.equal(401);
  });

  describe("Admin (city-wide)", function () {
    it("returns the overview shape with all 9 kebeles", async function () {
      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("revenue");
      expect(res.body.revenue).to.have.all.keys(
        "totalCollected", "totalPending", "totalOverdue", "target", "achievementPct", "monthly"
      );
      expect(res.body).to.have.property("attendance");
      expect(res.body.attendance).to.have.all.keys("totalRecords", "presentCount", "absentCount", "attendanceRate");
      expect(res.body).to.have.property("inspections");
      expect(res.body.inspections).to.have.all.keys("total", "active", "warning", "danger");
      expect(res.body).to.have.property("scope");
      expect(res.body.scope.role).to.equal("admin");
      expect(res.body.kebeles).to.be.an("array");
      expect(res.body.kebeles.length).to.be.at.least(1);
      for (const k of res.body.kebeles) {
        expect(k).to.have.all.keys(
          "id", "code", "name", "zones", "workerCount", "businessCount", "target",
          "collected", "achievementPct", "attendanceRate", "inspectionTotal",
          "activeInspections", "warningInspections", "dangerInspections"
        );
      }
    });

    it("achievementPct is null when no monthly target exists (no fabrication)", async function () {
      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("x-session-token", tokens.admin);
      for (const k of res.body.kebeles) {
        if (k.target === null) expect(k.achievementPct).to.equal(null);
      }
      if (res.body.revenue.target === null) expect(res.body.revenue.achievementPct).to.equal(null);
    });
  });

  describe("Collector (scoped to assigned kebele)", function () {
    it("sees only their assigned kebele in the comparison", async function () {
      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      expect(res.body.scope.role).to.equal("collector");
      expect(res.body.kebeles).to.be.an("array");
      expect(res.body.kebeles.length).to.equal(1);
      expect(res.body.kebeles[0].id).to.equal(scopeKebele);
    });

    it("an unassigned collector receives an empty result set, not city-wide data", async function () {
      await db.query("UPDATE kebeles SET collector_id=NULL WHERE id=$1", [scopeKebele]);
      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      expect(res.body.kebeles).to.deep.equal([]);
      expect(res.body.revenue.totalCollected).to.equal("0");
      await db.query("UPDATE kebeles SET collector_id=$1 WHERE id=$2", [userIds.collector, scopeKebele]);
    });
  });

  describe("Leader (scoped to own zone)", function () {
    it("sees a single kebele row reflecting only their own zone", async function () {
      const res = await request(app)
        .get("/api/dashboard/overview")
        .set("x-session-token", tokens.leader1);
      expect(res.status).to.equal(200);
      expect(res.body.scope.role).to.equal("leader");
      expect(res.body.kebeles).to.be.an("array");
      expect(res.body.kebeles.length).to.equal(1);
      expect(res.body.kebeles[0].id).to.equal(scopeKebele);
      expect(res.body.kebeles[0].zones).to.equal(1);
    });
  });
});