// backend/test/authorization.test.js — API-level authorization tests
// Tests cross-kebele and cross-zone access restrictions.
// These tests verify that the API enforces authorization server-side,
// not just in the frontend UI.
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken, getTestUserId } = require("./helpers/setup");

describe("Authorization", function () {
  this.timeout(15000);
  let tokens, userIds;
  let testZone1, testZone2, testKebele1, testKebele2;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;

    // Get two different zones from different kebeles
    const zonesResult = await db.query(
      `SELECT sz.id AS zone_id, sz.kebele_id, sz.name AS zone_name,
              k.name AS kebele_name, k.id AS k_id
       FROM safer_zones sz JOIN kebeles k ON k.id = sz.kebele_id
       ORDER BY k.id, sz.id LIMIT 4`
    );
    const zones = zonesResult.rows;
    if (zones.length < 2) {
      this.skip(); // Not enough test data
    }
    testZone1 = zones[0];
    testZone2 = zones[2] || zones[1]; // Different kebele if possible
    testKebele1 = zones[0].kebele_id;
    testKebele2 = zones[2] ? zones[2].kebele_id : zones[1].kebele_id;

    // Link testZone1 to leader1
    await db.query("UPDATE safer_zones SET leader_id=$1 WHERE id=$2", [userIds.leader1, testZone1.zone_id]);
  });

  after(async function () {
    await cleanupTestData();
  });

  // ════════════════════════════════════════════════════════════════
  // 1. UNAUTHENTICATED ACCESS
  // ════════════════════════════════════════════════════════════════
  describe("Unauthenticated access", function () {
    const protectedEndpoints = [
      ["GET", "/api/users"],
      ["GET", "/api/kebeles"],
      ["GET", "/api/safer-zones"],
      ["GET", "/api/workers"],
      ["GET", "/api/payments"],
      ["GET", "/api/inspections"],
      ["GET", "/api/tools"],
      ["GET", "/api/documents"],
      ["GET", "/api/audit-log"],
      ["GET", "/api/notifications"]
    ];

    for (const [method, path] of protectedEndpoints) {
      it(`${method} ${path} returns 401 without token`, async function () {
        const res = await request(app)[method.toLowerCase()](path);
        expect(res.status).to.equal(401);
      });
    }
  });

  // ════════════════════════════════════════════════════════════════
  // 2. VIEWER READ-ONLY ENFORCEMENT
  // ════════════════════════════════════════════════════════════════
  describe("Viewer role (read-only)", function () {
    it("viewer can read locations", async function () {
      const res = await request(app).get("/api/kebeles").set("x-session-token", tokens.viewer);
      expect(res.status).to.equal(200);
    });

    it("viewer cannot create a user", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.viewer)
        .send({ username: "hacker", password: "x", fullName: "H", role: "viewer" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot create a worker", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.viewer)
        .send({ fullName: "Test" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot create a payment", async function () {
      const res = await request(app)
        .post("/api/payments")
        .set("x-session-token", tokens.viewer)
        .send({ businessId: 1, amount: 100, month: 1, year: 2026 });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot create an inspection", async function () {
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.viewer)
        .send({ kebeleId: 1, date: "2026-01-01" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot upload a document", async function () {
      const res = await request(app).post("/api/documents").set("x-session-token", tokens.viewer).send({});
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot create a zone report", async function () {
      const res = await request(app)
        .post("/api/zone-reports")
        .set("x-session-token", tokens.viewer)
        .send({ saferZoneId: 1, reportDate: "2026-01-01" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot access audit log", async function () {
      const res = await request(app).get("/api/audit-log").set("x-session-token", tokens.viewer);
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. LEADER ZONE RESTRICTIONS
  // ════════════════════════════════════════════════════════════════
  describe("Leader zone restrictions", function () {
    it("leader can read their own zone data", async function () {
      const res = await request(app).get("/api/safer-zones").set("x-session-token", tokens.leader1);
      expect(res.status).to.equal(200);
      // Leader should see a filtered list
      if (res.body.length > 0) {
        expect(res.body).to.be.an("array");
      }
    });

    it("leader cannot create a worker in another zone", async function () {
      // Assign leader1 to zone1, try to create worker in zone2
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.leader1)
        .send({ fullName: "Cross Zone Worker", saferZoneId: testZone2.zone_id });
      expect(res.status).to.be.oneOf([400, 403]);
    });

    it("leader cannot create a business in another zone", async function () {
      const res = await request(app)
        .post("/api/businesses")
        .set("x-session-token", tokens.leader1)
        .send({ name: "Cross Zone Biz", saferZoneId: testZone2.zone_id, type: "shop" });
      expect(res.status).to.be.oneOf([400, 403]);
    });

    it("leader cannot create an inspection for another zone", async function () {
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.leader1)
        .send({ kebeleId: testKebele2, saferZoneId: testZone2.zone_id, date: "2026-01-01" });
      expect(res.status).to.be.oneOf([400, 403]);
    });

    it("leader can create a worker in their own zone", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.leader1)
        .send({ fullName: "Own Zone Worker", saferZoneId: testZone1.zone_id });
      // May succeed (201) or fail validation (400), but should NOT be 403
      expect(res.status).to.not.equal(403);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. COLLECTOR RESTRICTIONS
  // ════════════════════════════════════════════════════════════════
  describe("Collector role restrictions", function () {
    it("collector can access workers endpoint", async function () {
      const res = await request(app).get("/api/workers").set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
    });

    it("collector can access payments endpoint", async function () {
      const res = await request(app).get("/api/payments").set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
    });

    it("collector can create workers", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Collector Worker" });
      expect(res.status).to.not.be.oneOf([401, 403]);
    });

    it("collector cannot delete users", async function () {
      const res = await request(app).delete(`/api/users/${userIds.viewer}`).set("x-session-token", tokens.collector);
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("collector cannot create users", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.collector)
        .send({ username: "new_user", password: "x", fullName: "New", role: "viewer" });
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. ADMIN ACCESS
  // ════════════════════════════════════════════════════════════════
  describe("Admin access", function () {
    it("admin can read all users", async function () {
      const res = await request(app).get("/api/users").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("admin can access audit log", async function () {
      const res = await request(app).get("/api/audit-log").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
    });

    it("admin can access kebeles", async function () {
      const res = await request(app).get("/api/kebeles").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
    });

    it("admin can access workers", async function () {
      const res = await request(app).get("/api/workers").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. ID MANIPULATION TESTS
  // ════════════════════════════════════════════════════════════════
  describe("ID manipulation resistance", function () {
    it("GET /api/users/:id rejects non-existent user", async function () {
      const res = await request(app).get("/api/users/99999").set("x-session-token", tokens.admin);
      // Should return 404 or similar, not crash
      expect(res.status).to.be.oneOf([400, 404, 403]);
    });

    it("PUT /api/users/:id with non-existent user returns error", async function () {
      const res = await request(app)
        .put("/api/users/99999")
        .set("x-session-token", tokens.admin)
        .send({ fullName: "Hacked", role: "admin", isActive: true });
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it("PUT /api/workers/:id with non-existent worker returns error", async function () {
      const res = await request(app)
        .put("/api/workers/99999")
        .set("x-session-token", tokens.admin)
        .send({ fullName: "Hacked" });
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it("DELETE /api/workers/:id with non-existent worker returns error", async function () {
      const res = await request(app).delete("/api/workers/99999").set("x-session-token", tokens.admin);
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it("GET /api/inspections/:id with non-existent inspection returns 404", async function () {
      const res = await request(app).get("/api/inspections/99999").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
    });

    it("GET /api/zone-reports/:id with non-existent report returns 404", async function () {
      const res = await request(app).get("/api/zone-reports/99999").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 7. CROSS-ROLE ESCALATION TESTS
  // ════════════════════════════════════════════════════════════════
  describe("Cross-role escalation resistance", function () {
    it("leader cannot access admin-only audit log", async function () {
      const res = await request(app).get("/api/audit-log").set("x-session-token", tokens.leader1);
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("collector cannot access admin-only audit log", async function () {
      const res = await request(app).get("/api/audit-log").set("x-session-token", tokens.collector);
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot access admin-only audit log", async function () {
      const res = await request(app).get("/api/audit-log").set("x-session-token", tokens.viewer);
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("leader cannot create admin users", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.leader1)
        .send({ username: "admin_hack", password: "x", fullName: "H", role: "admin" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("collector cannot create admin users", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.collector)
        .send({ username: "admin_hack2", password: "x", fullName: "H", role: "admin" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("leader cannot delete users", async function () {
      const res = await request(app).delete(`/api/users/${userIds.viewer}`).set("x-session-token", tokens.leader1);
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("leader cannot modify another user's password", async function () {
      const res = await request(app)
        .put(`/api/users/${userIds.viewer}/password`)
        .set("x-session-token", tokens.leader1)
        .send({ newPassword: "hacked123" });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("viewer cannot change their own password (no current password)", async function () {
      const res = await request(app)
        .put(`/api/users/${userIds.viewer}/password`)
        .set("x-session-token", tokens.viewer)
        .send({ currentPassword: "wrong", newPassword: "NewPass123!" });
      // Should fail because current password is wrong, not succeed
      expect(res.status).to.not.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 8. LEADER CANNOT BYPASS ZONE CHECKS VIA PUT
  // ════════════════════════════════════════════════════════════════
  describe("Leader PUT authorization", function () {
    it("leader cannot PUT a business in another zone", async function () {
      // First get a business from zone2
      const bizResult = await db.query(
        "SELECT b.id FROM businesses b JOIN safer_zones sz ON sz.id = b.safer_zone_id WHERE sz.id = $1",
        [testZone2.zone_id]
      );
      if (bizResult.rows.length === 0) this.skip();

      const res = await request(app)
        .put(`/api/businesses/${bizResult.rows[0].id}`)
        .set("x-session-token", tokens.leader1)
        .send({ name: "Hacked Biz", type: "shop", saferZoneId: testZone2.zone_id });
      expect(res.status).to.be.oneOf([400, 403]);
    });

    it("leader cannot PUT an inspection in another zone", async function () {
      const inspResult = await db.query("SELECT i.id FROM inspections i WHERE i.safer_zone_id = $1", [
        testZone2.zone_id
      ]);
      if (inspResult.rows.length === 0) this.skip();

      const res = await request(app)
        .put(`/api/inspections/${inspResult.rows[0].id}`)
        .set("x-session-token", tokens.leader1)
        .send({ status: "danger", notes: "Hacked" });
      expect(res.status).to.be.oneOf([400, 403]);
    });

    it("leader cannot DELETE a worker in another zone", async function () {
      const workerResult = await db.query("SELECT w.id FROM workers w WHERE w.safer_zone_id = $1", [testZone2.zone_id]);
      if (workerResult.rows.length === 0) this.skip();

      const res = await request(app)
        .delete(`/api/workers/${workerResult.rows[0].id}`)
        .set("x-session-token", tokens.leader1);
      expect(res.status).to.be.oneOf([400, 403]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 9. SESSION VALIDATION
  // ════════════════════════════════════════════════════════════════
  describe("Session validation", function () {
    it("expired/invalid token returns 401", async function () {
      const res = await request(app).get("/api/users").set("x-session-token", "completely-fake-token-12345");
      expect(res.status).to.equal(401);
    });

    it("empty token returns 401", async function () {
      const res = await request(app).get("/api/users").set("x-session-token", "");
      expect(res.status).to.equal(401);
    });
  });
});
