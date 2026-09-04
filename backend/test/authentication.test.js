// backend/test/authentication.test.js — Authentication security tests
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken, TEST_USERS } = require("./helpers/setup");

describe("Authentication", function () {
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
  // 1. SUCCESSFUL LOGIN
  // ════════════════════════════════════════════════════════════════
  describe("Successful login", function () {
    it("returns token and user object on valid credentials", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.admin.username, password: TEST_USERS.admin.password });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("token").that.is.a("string");
      expect(res.body).to.have.property("user");
      expect(res.body.user).to.have.property("id");
      expect(res.body.user).to.have.property("role", "admin");
      expect(res.body.user).to.not.have.property("password_hash");
    });

    it("returns zone info for leader users", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.leader1.username, password: TEST_USERS.leader1.password });
      expect(res.status).to.equal(200);
      expect(res.body.user).to.have.property("role", "leader");
    });

    it("GET /api/auth/me returns current user", async function () {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.collector.username, password: TEST_USERS.collector.password });
      const res = await request(app).get("/api/auth/me").set("x-session-token", loginRes.body.token);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("username", TEST_USERS.collector.username);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. INVALID PASSWORD
  // ════════════════════════════════════════════════════════════════
  describe("Invalid password", function () {
    it("returns 401 for wrong password", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.admin.username, password: "WrongPassword123!" });
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property("error");
    });

    it("returns 401 for non-existent user", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "nonexistent_user_xyz", password: "anything" });
      expect(res.status).to.equal(401);
    });

    it("does not leak whether username exists", async function () {
      const res1 = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.admin.username, password: "wrong" });
      const res2 = await request(app).post("/api/auth/login").send({ username: "nonexistent_xyz", password: "wrong" });
      expect(res1.body.error).to.equal(res2.body.error);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. RATE LIMITING
  // ════════════════════════════════════════════════════════════════
  describe("Rate limiting", function () {
    it("rejects requests beyond rate limit", async function () {
      const statuses = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post("/api/auth/login").send({ username: "rate_limit_test", password: "x" });
        statuses.push(res.status);
      }
      expect(statuses).to.include(429);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ACCOUNT LOCKOUT
  // ════════════════════════════════════════════════════════════════
  describe("Account lockout", function () {
    it("locks account after MAX_FAILED attempts", async function () {
      const username = "lockout_test_user";
      // Create the user first
      const bcrypt = require("bcryptjs");
      const hash = await bcrypt.hash("RealPass123!", 10);
      await db.query(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO UPDATE SET id=users.id RETURNING id",
        [username, hash, "Lockout Test", "viewer"]
      );

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/login").send({ username, password: "WrongPass1!" });
      }

      // 6th attempt should be locked out (429)
      const res = await request(app).post("/api/auth/login").send({ username, password: "WrongPass1!" });
      expect(res.status).to.equal(429);
      expect(res.body.error).to.match(/locked/i);

      // Cleanup
      await db.query("DELETE FROM users WHERE username = $1", [username]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. LOGOUT / SESSION INVALIDATION
  // ════════════════════════════════════════════════════════════════
  describe("Logout and session invalidation", function () {
    it("logout returns 200 and invalidates session", async function () {
      // Login to get a fresh token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.viewer.username, password: TEST_USERS.viewer.password });
      const token = loginRes.body.token;

      // Verify token works
      const meRes = await request(app).get("/api/auth/me").set("x-session-token", token);
      expect(meRes.status).to.equal(200);

      // Logout
      const logoutRes = await request(app).post("/api/auth/logout").set("x-session-token", token);
      expect(logoutRes.status).to.equal(200);

      // Verify token no longer works
      const meRes2 = await request(app).get("/api/auth/me").set("x-session-token", token);
      expect(meRes2.status).to.equal(401);
    });

    it("new login invalidates previous sessions (session fixation protection)", async function () {
      // Login twice
      const login1 = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.collector.username, password: TEST_USERS.collector.password });
      const token1 = login1.body.token;

      const login2 = await request(app)
        .post("/api/auth/login")
        .send({ username: TEST_USERS.collector.username, password: TEST_USERS.collector.password });
      const token2 = login2.body.token;

      // First token should be invalidated
      const me1 = await request(app).get("/api/auth/me").set("x-session-token", token1);
      expect(me1.status).to.equal(401);

      // Second token should work
      const me2 = await request(app).get("/api/auth/me").set("x-session-token", token2);
      expect(me2.status).to.equal(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. MISSING FIELDS
  // ════════════════════════════════════════════════════════════════
  describe("Missing fields", function () {
    it("returns 400 when username is missing", async function () {
      const res = await request(app).post("/api/auth/login").send({ password: "test" });
      expect(res.status).to.equal(400);
    });

    it("returns 400 when password is missing", async function () {
      const res = await request(app).post("/api/auth/login").send({ username: "test" });
      expect(res.status).to.equal(400);
    });

    it("returns 400 when body is empty", async function () {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).to.equal(400);
    });
  });
});
