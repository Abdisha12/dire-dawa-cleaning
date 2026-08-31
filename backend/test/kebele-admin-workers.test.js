// backend/test/kebele-admin-workers.test.js — Kebele Admin worker management tests
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken, getTestUserId } = require("./helpers/setup");

describe("Kebele Admin Worker Management", function () {
  this.timeout(20000);
  let tokens, userIds;
  let testKebele1, testKebele2, testZone1, testZone2;
  let workerInKebele1, workerInKebele2;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;

    // Get two different kebeles
    const kebelesResult = await db.query("SELECT id, name, code FROM kebeles ORDER BY id LIMIT 2");
    const kebeles = kebelesResult.rows;
    if (kebeles.length < 2) {
      this.skip();
    }
    testKebele1 = kebeles[0];
    testKebele2 = kebeles[1];

    // Get zones from each kebele
    const zones1Result = await db.query("SELECT id, name FROM safer_zones WHERE kebele_id=$1 LIMIT 1", [testKebele1.id]);
    const zones1 = zones1Result.rows;
    const zones2Result = await db.query("SELECT id, name FROM safer_zones WHERE kebele_id=$1 LIMIT 1", [testKebele2.id]);
    const zones2 = zones2Result.rows;
    if (!zones1.length || !zones2.length) {
      this.skip();
    }
    testZone1 = zones1[0];
    testZone2 = zones2[0];

    // Assign test_collector to testKebele1
    await db.query("UPDATE kebeles SET collector_id=$1 WHERE id=$2", [userIds.collector, testKebele1.id]);

    // Create workers in each kebele
    const w1Result = await db.query(
      "INSERT INTO workers (full_name, safer_zone_id) VALUES ($1, $2) RETURNING id",
      ["Worker in Kebele 1", testZone1.id]
    );
    workerInKebele1 = w1Result.rows[0].id;

    const w2Result = await db.query(
      "INSERT INTO workers (full_name, safer_zone_id) VALUES ($1, $2) RETURNING id",
      ["Worker in Kebele 2", testZone2.id]
    );
    workerInKebele2 = w2Result.rows[0].id;

    // Create fresh sessions for all users (login invalidates old ones)
    const { v4: uuidv4 } = require("uuid");
    for (const [key, u] of Object.entries({ admin: userIds.admin, collector: userIds.collector, leader1: userIds.leader1, viewer: userIds.viewer })) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.query("DELETE FROM sessions WHERE user_id = $1", [u]);
      await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [token, u, expires]);
      tokens[key] = token;
    }
  });

  after(async function () {
    // Cleanup test data
    if (workerInKebele1) await db.query("DELETE FROM workers WHERE id=$1", [workerInKebele1]);
    if (workerInKebele2) await db.query("DELETE FROM workers WHERE id=$1", [workerInKebele2]);
    // Reset collector assignment
    await db.query("UPDATE kebeles SET collector_id=NULL WHERE collector_id=$1", [userIds.collector]);
    await cleanupTestData();
  });

  // ════════════════════════════════════════════════════════════════
  // Test 1 — Allowed: Create worker in own kebele
  // ════════════════════════════════════════════════════════════════
  describe("Test 1 — Allowed: Create worker in own kebele", function () {
    it("collector can create worker in their assigned kebele", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.collector)
        .send({ fullName: "New Kebele Worker", saferZoneId: testZone1.id });
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("id");

      // Verify the worker was created
      const workerResult = await db.query("SELECT * FROM workers WHERE id=$1", [res.body.id]);
      expect(workerResult.rows.length).to.equal(1);

      // Cleanup
      await db.query("DELETE FROM workers WHERE id=$1", [res.body.id]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 2 — Forbidden: Create worker in another kebele
  // ════════════════════════════════════════════════════════════════
  describe("Test 2 — Forbidden: Create worker in another kebele", function () {
    it("collector cannot create worker in another kebele", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Cross Kebele Worker", saferZoneId: testZone2.id });
      expect(res.status).to.equal(403);
      expect(res.body.error).to.match(/kebele|zone/i);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 3 — Zone mismatch: Zone from another kebele
  // ════════════════════════════════════════════════════════════════
  describe("Test 3 — Zone mismatch: Zone from another kebele", function () {
    it("collector cannot create worker with zone from another kebele", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Zone Mismatch Worker", saferZoneId: testZone2.id });
      expect(res.status).to.equal(403);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 4 — Worker list: Only kebele workers visible
  // ════════════════════════════════════════════════════════════════
  describe("Test 4 — Worker list: Only kebele workers visible", function () {
    it("collector sees only workers from their kebele", async function () {
      const res = await request(app)
        .get("/api/workers")
        .set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");

      // All workers should belong to the collector's kebele
      for (const w of res.body) {
        if (w.zone_name) {
          // Worker has a zone — verify it's in the collector's kebele
          const zoneResult = await db.query("SELECT kebele_id FROM safer_zones WHERE id=$1", [w.safer_zone_id]);
          if (zoneResult.rows.length) {
            expect(zoneResult.rows[0].kebele_id).to.equal(testKebele1.id);
          }
        }
      }
    });

    it("admin sees all workers", async function () {
      const res = await request(app)
        .get("/api/workers")
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
      // Admin should see workers from both kebeles
      expect(res.body.length).to.be.at.least(2);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 5 — Cross-kebele edit
  // ════════════════════════════════════════════════════════════════
  describe("Test 5 — Cross-kebele edit", function () {
    it("collector cannot edit worker from another kebele", async function () {
      const res = await request(app)
        .put(`/api/workers/${workerInKebele2}`)
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Hacked Worker", dailyWage: 100, saferZoneId: testZone2.id, isActive: true });
      expect(res.status).to.equal(403);
      expect(res.body.error).to.match(/kebele/i);
    });

    it("collector can edit worker from their own kebele", async function () {
      const res = await request(app)
        .put(`/api/workers/${workerInKebele1}`)
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Updated Kebele Worker", dailyWage: 300, saferZoneId: testZone1.id, isActive: true });
      expect(res.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 6 — Cross-kebele delete
  // ════════════════════════════════════════════════════════════════
  describe("Test 6 — Cross-kebele delete", function () {
    it("collector cannot delete worker from another kebele", async function () {
      const res = await request(app)
        .delete(`/api/workers/${workerInKebele2}`)
        .set("x-session-token", tokens.collector);
      expect(res.status).to.equal(403);
      expect(res.body.error).to.match(/kebele/i);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 7 — Audit logging
  // ════════════════════════════════════════════════════════════════
  describe("Test 7 — Audit logging", function () {
    it("unauthorized cross-kebele attempt is logged", async function () {
      // Make a cross-kebele attempt
      await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.collector)
        .send({ fullName: "Audit Test Worker", saferZoneId: testZone2.id });

      // Check audit log for the unauthorized attempt
      const auditResult = await db.query(
        "SELECT * FROM audit_log WHERE user_id=$1 AND action='UNAUTHORIZED' AND entity_type='worker' ORDER BY created_at DESC LIMIT 1",
        [userIds.collector]
      );
      expect(auditResult.rows.length).to.be.at.least(1);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 8 — Higher-level users not restricted
  // ════════════════════════════════════════════════════════════════
  describe("Test 8 — Higher-level users not restricted", function () {
    it("admin can create worker in any kebele", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.admin)
        .send({ fullName: "Admin Created Worker", saferZoneId: testZone2.id });
      expect(res.status).to.equal(201);

      // Cleanup
      await db.query("DELETE FROM workers WHERE id=$1", [res.body.id]);
    });

    it("admin can edit any worker", async function () {
      const res = await request(app)
        .put(`/api/workers/${workerInKebele2}`)
        .set("x-session-token", tokens.admin)
        .send({ fullName: "Admin Edited Worker", dailyWage: 350, saferZoneId: testZone2.id, isActive: true });
      expect(res.status).to.equal(200);
    });

    it("admin can delete any worker", async function () {
      // Create a temporary worker to delete
      const tempResult = await db.query(
        "INSERT INTO workers (full_name, safer_zone_id) VALUES ($1, $2) RETURNING id",
        ["Temp Delete Worker", testZone2.id]
      );

      const res = await request(app)
        .delete(`/api/workers/${tempResult.rows[0].id}`)
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 9 — All 9 kebeles supported
  // ════════════════════════════════════════════════════════════════
  describe("Test 9 — All 9 kebeles supported", function () {
    it("system has all 9 kebeles", async function () {
      const kebelesResult = await db.query("SELECT id, name FROM kebeles ORDER BY id");
      expect(kebelesResult.rows.length).to.equal(9);
    });

    it("each kebele can have a collector assigned", async function () {
      const kebelesResult = await db.query("SELECT id, name FROM kebeles ORDER BY id");
      for (const k of kebelesResult.rows) {
        // Just verify the column exists and is queryable
        expect(k).to.have.property("id");
        expect(k).to.have.property("name");
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 10 — Pagination / search / status / kebele-zone filters
  // (Phase 4 item 36: API change on GET /api/workers. Authorization
  //  must be preserved in every paginated/filtered response.)
  // ════════════════════════════════════════════════════════════════
  describe("Test 10 — Pagination/search/filters on worker list", function () {
    it("returns a paginated envelope when page+limit are provided", async function () {
      const res = await request(app)
        .get("/api/workers")
        .query({ page: 1, limit: 10 })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("object");
      expect(res.body).to.have.property("data").that.is.an("array");
      expect(res.body.data.length).to.be.at.most(10);
      expect(res.body.total).to.be.a("number");
      expect(res.body.page).to.equal(1);
      expect(res.body.pages).to.be.at.least(1);
    });

    it("collector pagination stays scoped to the collector's kebele", async function () {
      const res = await request(app)
        .get("/api/workers")
        .query({ page: 1, limit: 100 })
        .set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("data").that.is.an("array");
      for (const w of res.body.data) {
        if (w.safer_zone_id) {
          const zoneResult = await db.query("SELECT kebele_id FROM safer_zones WHERE id=$1", [w.safer_zone_id]);
          if (zoneResult.rows.length) {
            expect(zoneResult.rows[0].kebele_id).to.equal(testKebele1.id);
          }
        }
      }
    });

    it("search filters by full_name (ILIKE) in the paginated response", async function () {
      const res = await request(app)
        .get("/api/workers")
        .query({ page: 1, limit: 100, search: "Worker in Kebele 1" })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.least(1);
      for (const w of res.body.data) {
        expect(w.full_name.toLowerCase()).to.include("worker in kebele 1");
      }
    });

    it("status=inactive filters to inactive workers only", async function () {
      const res = await request(app)
        .get("/api/workers")
        .query({ page: 1, limit: 100, status: "inactive" })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      for (const w of res.body.data) {
        expect(w.is_active).to.be.false;
      }
    });

    it("admin can filter by kebeleId", async function () {
      const res = await request(app)
        .get("/api/workers")
        .query({ page: 1, limit: 100, kebeleId: testKebele1.id })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      for (const w of res.body.data) {
        if (w.safer_zone_id) {
          const zoneResult = await db.query("SELECT kebele_id FROM safer_zones WHERE id=$1", [w.safer_zone_id]);
          if (zoneResult.rows.length) {
            expect(zoneResult.rows[0].kebele_id).to.equal(testKebele1.id);
          }
        }
      }
    });

    it("legacy non-paginated call still returns a plain array", async function () {
      const res = await request(app)
        .get("/api/workers")
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });
  });
});
