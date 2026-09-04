// backend/test/businesses-pagination.test.js — Phase 5 pagination/search for businesses & payments
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData } = require("./helpers/setup");

describe("Businesses & Payments Pagination", function () {
  this.timeout(20000);
  let tokens, userIds;
  let testKebele1, testKebele2, testZone1, testZone2;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
    userIds = data.userIds;
    const kebelesResult = await db.query("SELECT id, name, code FROM kebeles ORDER BY id LIMIT 2");
    const kebeles = kebelesResult.rows;
    if (kebeles.length < 2) this.skip();
    testKebele1 = kebeles[0];
    testKebele2 = kebeles[1];
    const zones1Result = await db.query("SELECT id, name FROM safer_zones WHERE kebele_id=$1 LIMIT 1", [
      testKebele1.id
    ]);
    const zones2Result = await db.query("SELECT id, name FROM safer_zones WHERE kebele_id=$1 LIMIT 1", [
      testKebele2.id
    ]);
    const zones1 = zones1Result.rows;
    const zones2 = zones2Result.rows;
    if (!zones1.length || !zones2.length) this.skip();
    testZone1 = zones1[0];
    testZone2 = zones2[0];
    const { v4: uuidv4 } = require("uuid");
    for (const [key, u] of Object.entries({
      admin: userIds.admin,
      collector: userIds.collector,
      viewer: userIds.viewer
    })) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.query("DELETE FROM sessions WHERE user_id = $1", [u]);
      await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [token, u, expires]);
      tokens[key] = token;
    }
  });

  after(async function () {
    await cleanupTestData();
  });

  describe("GET /api/businesses — pagination & search", function () {
    it("returns paginated envelope when page+limit provided", async function () {
      const res = await request(app)
        .get("/api/businesses")
        .query({ page: 1, limit: 10 })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("object");
      expect(res.body).to.have.property("data").that.is.an("array");
      expect(res.body.total).to.be.a("number");
      expect(res.body.page).to.equal(1);
      expect(res.body.pages).to.be.at.least(1);
    });

    it("search filters by name (ILIKE)", async function () {
      // create a unique business then search for it
      const bizName = `TestBizSearch-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/businesses")
        .set("x-session-token", tokens.admin)
        .send({ name: bizName, ownerName: "Owner X", saferZoneId: testZone1.id, type: "shop" });
      expect(createRes.status).to.equal(201);
      const res = await request(app)
        .get("/api/businesses")
        .query({ page: 1, limit: 10, search: bizName })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.least(1);
      for (const b of res.body.data) expect(b.name).to.include(bizName);
      await db.query("DELETE FROM businesses WHERE id=$1", [createRes.body.id]);
    });

    it("type filter works", async function () {
      const res = await request(app)
        .get("/api/businesses")
        .query({ page: 1, limit: 50, type: "shop" })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      for (const b of res.body.data) expect(b.type).to.equal("shop");
    });

    it("legacy non-paginated returns plain array", async function () {
      const res = await request(app).get("/api/businesses").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });
  });

  describe("GET /api/payments — pagination & search", function () {
    it("returns paginated envelope when page+limit provided", async function () {
      const res = await request(app)
        .get("/api/payments")
        .query({ page: 1, limit: 10 })
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("object");
      expect(res.body).to.have.property("data").that.is.an("array");
      expect(res.body.total).to.be.a("number");
    });

    it("legacy non-paginated returns plain array", async function () {
      const res = await request(app).get("/api/payments").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });
  });
});
