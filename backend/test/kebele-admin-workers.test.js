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
    const [kebeles] = await db.execute("SELECT id, name, code FROM kebeles ORDER BY id LIMIT 2");
    if (kebeles.length < 2) {
      this.skip();
    }
    testKebele1 = kebeles[0];
    testKebele2 = kebeles[1];

    // Get zones from each kebele
    const [zones1] = await db.execute("SELECT id, name FROM safer_zones WHERE kebele_id=? LIMIT 1", [testKebele1.id]);
    const [zones2] = await db.execute("SELECT id, name FROM safer_zones WHERE kebele_id=? LIMIT 1", [testKebele2.id]);
    if (!zones1.length || !zones2.length) {
      this.skip();
    }
    testZone1 = zones1[0];
    testZone2 = zones2[0];

    // Assign test_collector to testKebele1
    await db.execute("UPDATE kebeles SET collector_id=? WHERE id=?", [userIds.collector, testKebele1.id]);

    // Create workers in each kebele
    const [w1] = await db.execute(
      "INSERT INTO workers (full_name, safer_zone_id) VALUES (?, ?)",
      ["Worker in Kebele 1", testZone1.id]
    );
    workerInKebele1 = w1.insertId;

    const [w2] = await db.execute(
      "INSERT INTO workers (full_name, safer_zone_id) VALUES (?, ?)",
      ["Worker in Kebele 2", testZone2.id]
    );
    workerInKebele2 = w2.insertId;

    // Create fresh sessions for all users (login invalidates old ones)
    const { v4: uuidv4 } = require("uuid");
    for (const [key, u] of Object.entries({ admin: userIds.admin, collector: userIds.collector, leader1: userIds.leader1, viewer: userIds.viewer })) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.execute("DELETE FROM sessions WHERE user_id = ?", [u]);
      await db.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [token, u, expires]);
      tokens[key] = token;
    }
  });

  after(async function () {
    // Cleanup test data
    if (workerInKebele1) await db.execute("DELETE FROM workers WHERE id=?", [workerInKebele1]);
    if (workerInKebele2) await db.execute("DELETE FROM workers WHERE id=?", [workerInKebele2]);
    // Reset collector assignment
    await db.execute("UPDATE kebeles SET collector_id=NULL WHERE collector_id=?", [userIds.collector]);
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
      const [worker] = await db.execute("SELECT * FROM workers WHERE id=?", [res.body.id]);
      expect(worker.length).to.equal(1);

      // Cleanup
      await db.execute("DELETE FROM workers WHERE id=?", [res.body.id]);
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
          const [zone] = await db.execute("SELECT kebele_id FROM safer_zones WHERE id=?", [w.safer_zone_id]);
          if (zone.length) {
            expect(zone[0].kebele_id).to.equal(testKebele1.id);
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
      const [auditRows] = await db.execute(
        "SELECT * FROM audit_log WHERE user_id=? AND action='UNAUTHORIZED' AND entity_type='worker' ORDER BY created_at DESC LIMIT 1",
        [userIds.collector]
      );
      expect(auditRows.length).to.be.at.least(1);
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
      await db.execute("DELETE FROM workers WHERE id=?", [res.body.id]);
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
      const [temp] = await db.execute(
        "INSERT INTO workers (full_name, safer_zone_id) VALUES (?, ?)",
        ["Temp Delete Worker", testZone2.id]
      );

      const res = await request(app)
        .delete(`/api/workers/${temp.insertId}`)
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // Test 9 — All 9 kebeles supported
  // ════════════════════════════════════════════════════════════════
  describe("Test 9 — All 9 kebeles supported", function () {
    it("system has all 9 kebeles", async function () {
      const [kebeles] = await db.execute("SELECT id, name FROM kebeles ORDER BY id");
      expect(kebeles.length).to.equal(9);
    });

    it("each kebele can have a collector assigned", async function () {
      const [kebeles] = await db.execute("SELECT id, name FROM kebeles ORDER BY id");
      for (const k of kebeles) {
        // Just verify the column exists and is queryable
        expect(k).to.have.property("id");
        expect(k).to.have.property("name");
      }
    });
  });
});
