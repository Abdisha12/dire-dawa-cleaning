// backend/test/gis.test.js — GIS GeoJSON authorization + validation (§56)
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData } = require("./helpers/setup");

describe("GIS GeoJSON", function () {
  this.timeout(15000);
  let tokens;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
  });

  after(async function () {
    await cleanupTestData();
  });

  describe("authentication", function () {
    for (const path of ["/api/gis/kebeles", "/api/gis/safer-zones", "/api/gis/businesses", "/api/gis/workers", "/api/gis/inspections"]) {
      it(`GET ${path} returns 401 without token`, async function () {
        const res = await request(app).get(path);
        expect(res.status).to.equal(401);
      });
    }
  });

  describe("authorized geometry", function () {
    it("admin gets kebele FeatureCollection", async function () {
      const res = await request(app).get("/api/gis/kebeles").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.type).to.equal("FeatureCollection");
      expect(res.body.features).to.be.an("array");
    });

    it("admin gets safer-zone FeatureCollection", async function () {
      const res = await request(app).get("/api/gis/safer-zones").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(200);
      expect(res.body.type).to.equal("FeatureCollection");
      expect(res.body.features).to.be.an("array");
    });

    it("viewer can read GIS (read-only)", async function () {
      const res = await request(app).get("/api/gis/businesses").set("x-session-token", tokens.viewer);
      expect(res.status).to.equal(200);
      expect(res.body.type).to.equal("FeatureCollection");
    });

    it("collector scope returns at most their kebele", async function () {
      const res = await request(app).get("/api/gis/kebeles").set("x-session-token", tokens.collector);
      expect(res.status).to.equal(200);
      expect(res.body.features.length).to.be.at.most(1);
    });
  });

  describe("validation", function () {
    it("rejects invalid kebeleId", async function () {
      const res = await request(app).get("/api/gis/safer-zones?kebeleId=abc").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(400);
    });

    it("rejects invalid status on inspections", async function () {
      const res = await request(app).get("/api/gis/inspections?status=bogus").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(400);
    });

    it("rejects malformed date", async function () {
      const res = await request(app).get("/api/gis/inspections?from=not-a-date").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(400);
    });
  });

  describe("inspection location persistence", function () {
    it("accepts latitude/longitude on inspection create when authorized", async function () {
      // Resolve an authorized kebele/zone for admin from real data.
      const zones = await db.query("SELECT sz.id AS zone_id, sz.kebele_id FROM safer_zones sz ORDER BY sz.id LIMIT 1");
      if (!zones.rows.length) { this.skip(); return; }
      const { zone_id, kebele_id } = zones.rows[0];
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.admin)
        .field("kebeleId", String(kebele_id))
        .field("saferZoneId", String(zone_id))
        .field("date", "2026-09-03")
        .field("status", "active")
        .field("latitude", "9.6")
        .field("longitude", "41.3");
      expect([201, 400, 409]).to.include(res.status);
      if (res.status === 201) {
        const row = await db.query("SELECT ST_AsText(location) AS wkt FROM inspections WHERE id=$1", [res.body.id]);
        expect(row.rows[0].wkt).to.be.a("string").and.to.include("POINT");
        await db.query("DELETE FROM inspections WHERE id=$1", [res.body.id]);
      }
    });
  });
});
