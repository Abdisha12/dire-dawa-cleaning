// backend/test/complaints.test.js — Complaints API (P1-2)
// Covers authorization scoping, the new→in_progress→resolved state machine,
// validation, notifications, and the summary/list endpoints.
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData } = require("./helpers/setup");

describe("Complaints API", function () {
  this.timeout(15000);
  let tokens, userIds;
  let zone1, zone2, kebele1, kebele2;
  let createdIds = [];

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;

    const kebelesResult = await db.query("SELECT id FROM kebeles ORDER BY id LIMIT 2");
    if (kebelesResult.rows.length < 2) this.skip();
    kebele1 = kebelesResult.rows[0].id;
    kebele2 = kebelesResult.rows[1].id;

    const z1 = await db.query("SELECT id FROM safer_zones WHERE kebele_id=$1 ORDER BY id LIMIT 1", [kebele1]);
    const z2 = await db.query("SELECT id FROM safer_zones WHERE kebele_id=$1 ORDER BY id LIMIT 1", [kebele2]);
    if (!z1.rows.length || !z2.rows.length) this.skip();
    zone1 = z1.rows[0].id;
    zone2 = z2.rows[0].id;

    // Link leader1 to zone1 and the collector to kebele1 for scope assertions.
    await db.query("UPDATE safer_zones SET leader_id=$1 WHERE id=$2", [userIds.leader1, zone1]);
    await db.query("UPDATE kebeles SET collector_id=$1 WHERE id=$2", [userIds.collector, kebele1]);
  });

  after(async function () {
    for (const id of createdIds) {
      await db.query("DELETE FROM complaints WHERE id=$1", [id]).catch(() => {});
    }
    if (zone1) await db.query("UPDATE safer_zones SET leader_id=NULL WHERE id=$1", [zone1]).catch(() => {});
    if (kebele1) await db.query("UPDATE kebeles SET collector_id=NULL WHERE id=$1", [kebele1]).catch(() => {});
    await cleanupTestData();
  });

  const validComplaint = (zoneId, overrides = {}) => ({
    title: "Test complaint",
    description: "Litter near the market",
    category: "litter",
    saferZoneId: zoneId,
    reporterName: "Resident",
    reporterPhone: "0911111111",
    ...overrides
  });

  async function createComplaint(token, zoneId, overrides = {}) {
    const res = await request(app).post("/api/complaints").set("x-session-token", token).send(validComplaint(zoneId, overrides));
    if (res.status === 201) createdIds.push(res.body.id);
    return res;
  }

  describe("authentication", function () {
    it("GET /api/complaints returns 401 without token", async function () {
      const res = await request(app).get("/api/complaints");
      expect(res.status).to.equal(401);
    });

    it("GET /api/complaints/summary returns 401 without token", async function () {
      const res = await request(app).get("/api/complaints/summary");
      expect(res.status).to.equal(401);
    });
  });

  describe("create", function () {
    it("admin creates a complaint → 201, status new", async function () {
      const res = await createComplaint(tokens.admin, zone1);
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("id");
      expect(res.body.status).to.equal("new");
    });

    it("leader can create in their own zone → 201", async function () {
      const res = await createComplaint(tokens.leader1, zone1);
      expect(res.status).to.equal(201);
    });

    it("leader cannot create in another zone → 403", async function () {
      const res = await createComplaint(tokens.leader1, zone2);
      expect(res.status).to.equal(403);
    });

    it("collector can create in their assigned kebele → 201", async function () {
      const res = await createComplaint(tokens.collector, zone1);
      expect(res.status).to.equal(201);
    });

    it("collector cannot create in another kebele → 403", async function () {
      const res = await createComplaint(tokens.collector, zone2);
      expect(res.status).to.equal(403);
    });

    it("viewer cannot create → 403", async function () {
      const res = await request(app).post("/api/complaints").set("x-session-token", tokens.viewer).send(validComplaint(zone1));
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it("rejects missing title → 400", async function () {
      const res = await request(app)
        .post("/api/complaints")
        .set("x-session-token", tokens.admin)
        .send({ description: "x", saferZoneId: zone1 });
      expect(res.status).to.equal(400);
    });

    it("rejects invalid category → 400", async function () {
      const res = await request(app)
        .post("/api/complaints")
        .set("x-session-token", tokens.admin)
        .send(validComplaint(zone1, { category: "bogus" }));
      expect(res.status).to.equal(400);
    });

    it("rejects unknown saferZoneId → 400", async function () {
      const res = await createComplaint(tokens.admin, 99999);
      expect(res.status).to.equal(400);
    });
  });

  describe("list scoping", function () {
    before(async function () {
      // One complaint in kebele1/zone1, one in kebele2/zone2 (both created by admin).
      await createComplaint(tokens.admin, zone1, { title: "Scope complaint zone1" });
      await createComplaint(tokens.admin, zone2, { title: "Scope complaint zone2" });
    });

    it("admin + viewer see both complaints", async function () {
      for (const token of [tokens.admin, tokens.viewer]) {
        const res = await request(app).get("/api/complaints").set("x-session-token", token);
        expect(res.status).to.equal(200);
        const titles = res.body.map((c) => c.title);
        expect(titles).to.include("Scope complaint zone1");
        expect(titles).to.include("Scope complaint zone2");
      }
    });

    it("leader only sees their own zone", async function () {
      const res = await request(app).get("/api/complaints").set("x-session-token", tokens.leader1);
      expect(res.status).to.equal(200);
      const titles = res.body.map((c) => c.title);
      expect(titles).to.include("Scope complaint zone1");
      expect(titles).to.not.include("Scope complaint zone2");
    });

    it("collector only sees their kebele", async function () {
      const res = await request(app).get("/api/complaints").set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      const titles = res.body.map((c) => c.title);
      expect(titles).to.include("Scope complaint zone1");
      expect(titles).to.not.include("Scope complaint zone2");
    });

    it("search filter matches title", async function () {
      const res = await request(app).get("/api/complaints?search=zone2").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.some((c) => c.title === "Scope complaint zone2")).to.equal(true);
    });

    it("pagination returns {data,total,page,pages}", async function () {
      const res = await request(app).get("/api/complaints?limit=1&page=1").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("data");
      expect(res.body).to.have.property("total");
      expect(res.body).to.have.property("page", 1);
      expect(res.body).to.have.property("pages");
      expect(res.body.data.length).to.be.at.most(1);
    });

    it("status filter honors the state machine values", async function () {
      const res = await request(app).get("/api/complaints?status=new").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      for (const c of res.body) expect(c.status).to.equal("new");
    });

    it("rejects invalid status filter → 400", async function () {
      const res = await request(app).get("/api/complaints?status=nope").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(400);
    });
  });

  describe("summary", function () {
    before(async function () {
      await createComplaint(tokens.admin, zone1, { title: "Summary complaint" });
    });

    it("summary reflects scoped counts (leader sees their zone)", async function () {
      const res = await request(app).get("/api/complaints/summary").set("x-session-token", tokens.leader1);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.all.keys("total", "new", "in_progress", "resolved");
      expect(res.body.total).to.be.at.least(1);
      expect(res.body.new).to.be.at.least(1);
      expect(res.body.in_progress).to.be.a("number");
      expect(res.body.resolved).to.be.a("number");
    });
  });

  describe("status transitions", function () {
    it("new → in_progress → resolved succeeds for admin", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      const r1 = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "in_progress" });
      expect(r1.status).to.equal(200);
      expect(r1.body.status).to.equal("in_progress");

      const r2 = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "resolved", resolutionNotes: "Cleaned up by the morning crew" });
      expect(r2.status).to.equal(200);
      expect(r2.body.status).to.equal("resolved");

      const row = await db.query("SELECT status, resolved_by, resolved_at FROM complaints WHERE id=$1", [created.body.id]);
      expect(row.rows[0].status).to.equal("resolved");
      expect(row.rows[0].resolved_by).to.equal(userIds.admin);
      expect(row.rows[0].resolved_at).to.not.be.null;
    });

    it("rejects a regression (resolved → in_progress) → 400", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "resolved" });
      const res = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "in_progress" });
      expect(res.status).to.equal(400);
    });

    it("rejects invalid status value → 400", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      const res = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "done" });
      expect(res.status).to.equal(400);
    });

    it("leader cannot transition a complaint in another zone → 403", async function () {
      const created = await createComplaint(tokens.admin, zone2);
      const res = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.leader1)
        .send({ status: "in_progress" });
      expect(res.status).to.equal(403);
    });

    it("collector cannot transition a complaint in another kebele → 403", async function () {
      const created = await createComplaint(tokens.admin, zone2);
      const res = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.collector)
        .send({ status: "in_progress" });
      expect(res.status).to.equal(403);
    });

    it("transitioning with assignedTo notifies the assignee", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      await db.query("DELETE FROM notifications WHERE user_id=$1", [userIds.collector]);
      const res = await request(app)
        .put(`/api/complaints/${created.body.id}/status`)
        .set("x-session-token", tokens.admin)
        .send({ status: "in_progress", assignedTo: userIds.collector });
      expect(res.status).to.equal(200);
      const notif = await db.query(
        "SELECT * FROM notifications WHERE user_id=$1 AND type='complaint_update' ORDER BY id DESC LIMIT 1",
        [userIds.collector]
      );
      expect(notif.rows.length).to.equal(1);
      expect(notif.rows[0].link).to.equal("/community/complaints");
    });
  });

  describe("single record + delete", function () {
    it("GET /api/complaints/:id returns the complaint for an in-scope role", async function () {
      const created = await createComplaint(tokens.admin, zone1, { title: "Detail complaint" });
      const res = await request(app).get(`/api/complaints/${created.body.id}`).set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.title).to.equal("Detail complaint");
      expect(res.body).to.have.property("zone_name");
      expect(res.body).to.have.property("kebele_name");
    });

    it("leader cannot read a complaint in another zone → 403", async function () {
      const created = await createComplaint(tokens.admin, zone2);
      const res = await request(app).get(`/api/complaints/${created.body.id}`).set("x-session-token", tokens.leader1);
      expect(res.status).to.equal(403);
    });

    it("GET /api/complaints/99999 → 404", async function () {
      const res = await request(app).get("/api/complaints/99999").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
    });

    it("admin can delete → 200", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      const res = await request(app).delete(`/api/complaints/${created.body.id}`).set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      createdIds = createdIds.filter((id) => id !== created.body.id);
    });

    it("delete is admin-only (leader/collector → 403)", async function () {
      const created = await createComplaint(tokens.admin, zone1);
      for (const token of [tokens.leader1, tokens.collector]) {
        const res = await request(app).delete(`/api/complaints/${created.body.id}`).set("x-session-token", token);
        expect(res.status).to.equal(403);
      }
    });

    it("delete nonexistent → 404", async function () {
      const res = await request(app).delete("/api/complaints/99999").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
    });
  });
});