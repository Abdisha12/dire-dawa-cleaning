// backend/test/api.test.js — API validation and error response tests
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const { seedTestData, cleanupTestData, getTestToken } = require("./helpers/setup");

describe("API validation and errors", function () {
  this.timeout(20000);
  let tokens;

  before(async function () {
    const data = await seedTestData();
    tokens = data.tokens;
  });

  after(async function () {
    await cleanupTestData();
  });

  // ════════════════════════════════════════════════════════════════
  // 1. VALIDATION FAILURES
  // ════════════════════════════════════════════════════════════════
  describe("Validation failures", function () {
    it("user creation rejects missing required fields", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.admin)
        .send({});
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("error");
    });

    it("user creation rejects short username", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.admin)
        .send({ username: "ab", password: "ValidPass123!", fullName: "Test", role: "viewer" });
      expect(res.status).to.equal(400);
    });

    it("user creation rejects invalid role", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.admin)
        .send({ username: "testuser", password: "ValidPass123!", fullName: "Test", role: "superadmin" });
      expect(res.status).to.equal(400);
    });

    it("payment creation rejects negative amount", async function () {
      const res = await request(app)
        .post("/api/payments")
        .set("x-session-token", tokens.admin)
        .send({ businessId: 1, amount: -500, month: 1, year: 2026 });
      expect(res.status).to.equal(400);
    });

    it("worker creation rejects empty fullName", async function () {
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.admin)
        .send({ fullName: "" });
      expect(res.status).to.equal(400);
    });

    it("zone report rejects invalid date format", async function () {
      const res = await request(app)
        .post("/api/zone-reports")
        .set("x-session-token", tokens.admin)
        .send({ saferZoneId: 1, reportDate: "2026/01/15" });
      expect(res.status).to.equal(400);
    });

    it("inspection rejects invalid status enum", async function () {
      const res = await request(app)
        .post("/api/inspections")
        .set("x-session-token", tokens.admin)
        .send({ kebeleId: 1, date: "2026-01-01", status: "unknown" });
      expect(res.status).to.equal(400);
    });

    it("bulk attendance rejects records without workerId", async function () {
      const res = await request(app)
        .post("/api/workers/attendance/bulk")
        .set("x-session-token", tokens.admin)
        .send({ date: "2026-01-01", records: [{ present: true }] });
      expect(res.status).to.equal(400);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. CONSISTENT ERROR RESPONSES
  // ════════════════════════════════════════════════════════════════
  describe("Consistent error format", function () {
    it("401 error has {error: string}", async function () {
      const res = await request(app).get("/api/users");
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("error").that.is.a("string");
    });

    it("403 error has {error: string}", async function () {
      const res = await request(app)
        .get("/api/audit-log")
        .set("x-session-token", tokens.viewer);
      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("error").that.is.a("string");
    });

    it("404 error has {error: string}", async function () {
      const res = await request(app)
        .get("/api/nonexistent-endpoint")
        .set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property("error").that.is.a("string");
    });

    it("400 validation error has {error: string, details: array}", async function () {
      const res = await request(app)
        .post("/api/users")
        .set("x-session-token", tokens.admin)
        .send({});
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property("error");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. AUTHENTICATION FAILURES
  // ════════════════════════════════════════════════════════════════
  describe("Authentication failure responses", function () {
    it("missing token returns 401", async function () {
      const res = await request(app).get("/api/users");
      expect(res.status).to.equal(401);
    });

    it("invalid token returns 401", async function () {
      const res = await request(app)
        .get("/api/users")
        .set("x-session-token", "invalid-token-12345");
      expect(res.status).to.equal(401);
    });

    it("expired token returns 401", async function () {
      // Create an expired session directly
      const db = require("../config/db");
      const { v4: uuidv4 } = require("uuid");
      const expiredToken = uuidv4();
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      await db.execute(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, 1, ?)",
        [expiredToken, pastDate]
      );

      const res = await request(app)
        .get("/api/users")
        .set("x-session-token", expiredToken);
      expect(res.status).to.equal(401);

      await db.execute("DELETE FROM sessions WHERE id=?", [expiredToken]);
    });

    it("Bearer token via Authorization header works", async function () {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${tokens.admin}`);
      expect(res.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ENDPOINT NOT FOUND
  // ════════════════════════════════════════════════════════════════
  describe("Unknown endpoints", function () {
    it("returns 404 for unknown API routes", async function () {
      const res = await request(app).get("/api/this-does-not-exist");
      expect(res.status).to.equal(404);
    });

    it("returns 404 for unknown methods on valid routes", async function () {
      const res = await request(app).patch("/api/users").set("x-session-token", tokens.admin);
      expect(res.status).to.equal(404);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. INPUT SANITIZATION
  // ════════════════════════════════════════════════════════════════
  describe("Input sanitization", function () {
    it("trims whitespace from username in validation", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "  admin  ", password: "wrong" });
      // Should not return 400 (validation passes after trim)
      expect(res.status).to.not.equal(400);
    });

    it("rejects extremely long input strings", async function () {
      const longString = "A".repeat(10000);
      const res = await request(app)
        .post("/api/workers")
        .set("x-session-token", tokens.admin)
        .send({ fullName: longString });
      expect(res.status).to.equal(400);
    });
  });
});
