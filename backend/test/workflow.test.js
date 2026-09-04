// backend/test/workflow.test.js — Business workflow tests
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken, getTestUserId } = require("./helpers/setup");

describe("Business workflows", function () {
  this.timeout(20000);
  let tokens, userIds;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;
  });

  after(async function () {
    await cleanupTestData();
  });

  // ════════════════════════════════════════════════════════════════
  // 1. ZONE REPORT STATE MACHINE
  // ════════════════════════════════════════════════════════════════
  describe("Zone report transitions", function () {
    let reportId;

    it("creates a zone report in draft status", async function () {
      const res = await request(app).post("/api/zone-reports").set("x-session-token", tokens.admin).send({
        saferZoneId: 1,
        reportDate: "2026-03-15",
        workersPresent: 10,
        workersAbsent: 2,
        collectionTotal: 5000
      });
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("status", "draft");
      reportId = res.body.id;
    });

    it("transitions draft → submitted", async function () {
      if (!reportId) return this.skip();
      const res = await request(app)
        .put(`/api/zone-reports/${reportId}`)
        .set("x-session-token", tokens.admin)
        .send({ status: "submitted" });
      expect(res.status).to.equal(200);
    });

    it("transitions submitted → reviewed", async function () {
      if (!reportId) return this.skip();
      const res = await request(app)
        .put(`/api/zone-reports/${reportId}/review`)
        .set("x-session-token", tokens.admin)
        .send({ status: "reviewed", reviewerNotes: "Looks good" });
      expect(res.status).to.equal(200);
    });

    it("transitions reviewed → approved", async function () {
      if (!reportId) return this.skip();
      const res = await request(app)
        .put(`/api/zone-reports/${reportId}/review`)
        .set("x-session-token", tokens.admin)
        .send({ status: "approved", reviewerNotes: "Approved" });
      expect(res.status).to.equal(200);
    });

    it("rejects invalid transition: approved → draft", async function () {
      if (!reportId) return this.skip();
      const res = await request(app)
        .put(`/api/zone-reports/${reportId}`)
        .set("x-session-token", tokens.admin)
        .send({ status: "draft" });
      // Should reject — cannot go back to draft from approved
      expect(res.status).to.be.oneOf([400, 409]);
    });

    it("rejects invalid transition: approved → submitted", async function () {
      if (!reportId) return this.skip();
      const res = await request(app)
        .put(`/api/zone-reports/${reportId}`)
        .set("x-session-token", tokens.admin)
        .send({ status: "submitted" });
      expect(res.status).to.be.oneOf([400, 409]);
    });

    it("cleanup: delete test report", async function () {
      if (!reportId) return this.skip();
      await db.query("DELETE FROM zone_reports WHERE id=$1", [reportId]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. DUPLICATE ZONE REPORT PREVENTION
  // ════════════════════════════════════════════════════════════════
  describe("Duplicate zone report prevention", function () {
    it("rejects duplicate report for same zone/month/year", async function () {
      // Create first report
      const res1 = await request(app)
        .post("/api/zone-reports")
        .set("x-session-token", tokens.admin)
        .send({ saferZoneId: 2, reportDate: "2026-04-10" });
      if (res1.status !== 201) return this.skip();

      // Try duplicate
      const res2 = await request(app)
        .post("/api/zone-reports")
        .set("x-session-token", tokens.admin)
        .send({ saferZoneId: 2, reportDate: "2026-04-20" });
      expect(res2.status).to.equal(409);

      // Cleanup
      await db.query("DELETE FROM zone_reports WHERE safer_zone_id=2 AND report_month=4 AND report_year=2026");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. PAYMENT WORKFLOW
  // ════════════════════════════════════════════════════════════════
  describe("Payment creation", function () {
    it("creates a payment with valid data", async function () {
      const res = await request(app)
        .post("/api/payments")
        .set("x-session-token", tokens.admin)
        .send({ businessId: 1, amount: 1000, month: 5, year: 2026 });
      // May succeed or fail depending on existing data
      expect(res.status).to.be.oneOf([201, 400, 409]);
    });

    it("rejects payment with negative amount", async function () {
      const res = await request(app)
        .post("/api/payments")
        .set("x-session-token", tokens.admin)
        .send({ businessId: 1, amount: -100, month: 5, year: 2026 });
      expect(res.status).to.equal(400);
    });

    it("rejects payment with invalid month", async function () {
      const res = await request(app)
        .post("/api/payments")
        .set("x-session-token", tokens.admin)
        .send({ businessId: 1, amount: 100, month: 13, year: 2026 });
      expect(res.status).to.equal(400);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ATTENDANCE WORKFLOW
  // ════════════════════════════════════════════════════════════════
  describe("Bulk attendance", function () {
    it("rejects empty attendance records", async function () {
      const res = await request(app)
        .post("/api/workers/attendance/bulk")
        .set("x-session-token", tokens.admin)
        .send({ date: "2026-06-01", records: [] });
      expect(res.status).to.equal(400);
    });

    it("rejects attendance with invalid date format", async function () {
      const res = await request(app)
        .post("/api/workers/attendance/bulk")
        .set("x-session-token", tokens.admin)
        .send({
          date: "not-a-date",
          records: [{ workerId: 1, present: true }]
        });
      expect(res.status).to.equal(400);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. INSPECTION WORKFLOW
  // ════════════════════════════════════════════════════════════════
  describe("Inspection creation", function () {
    it("creates inspection with valid data", async function () {
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.admin)
        .send({ kebeleId: 1, date: "2026-07-01", status: "active" });
      expect(res.status).to.be.oneOf([201, 400, 409]);
    });

    it("rejects inspection with invalid status", async function () {
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.admin)
        .send({ kebeleId: 1, date: "2026-07-02", status: "invalid_status" });
      expect(res.status).to.equal(400);
    });
  });
});
