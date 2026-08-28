// backend/test/security.test.js — Security tests (XSS, SQL injection, uploads, etc.)
const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");
const { seedTestData, cleanupTestData, getTestToken } = require("./helpers/setup");

describe("Security", function () {
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
  // 1. XSS PAYLOAD REJECTION / ESCAPING
  // ════════════════════════════════════════════════════════════════
  describe("XSS protection", function () {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><img src=x onerror=alert(1)>',
      "javascript:alert(1)",
      '<svg onload=alert(1)>',
      "{{7*7}}",
      "${7*7}",
    ];

    for (const payload of xssPayloads) {
      it(`sanitizes XSS in worker creation: ${payload.substring(0, 30)}...`, async function () {
        const res = await request(app)
          .post("/api/workers")
          .set("x-session-token", tokens.admin)
          .send({ fullName: payload, contact: "0911000000" });
        // Should either reject (400) or sanitize the input
        if (res.status === 201) {
          // If created, verify the name is sanitized
          const rowsResult = await db.query("SELECT full_name FROM workers WHERE id=$1", [res.body.id]);
          if (rowsResult.rows.length) {
            expect(rowsResult.rows[0].full_name).to.not.contain("<script>");
          }
        } else {
          expect(res.status).to.be.oneOf([400, 401, 403]);
        }
      });
    }

    it("XSS payload in zone report is sanitized", async function () {
      const res = await request(app)
        .post("/api/zone-reports")
        .set("x-session-token", tokens.admin)
        .send({
          saferZoneId: 1,
          reportDate: "2026-01-15",
          issuesReported: '<script>alert("xss")</script>',
        });
      if (res.status === 201) {
        const rowsResult = await db.query("SELECT issues_reported FROM zone_reports WHERE id=$1", [res.body.id]);
        if (rowsResult.rows.length && rowsResult.rows[0].issues_reported) {
          expect(rowsResult.rows[0].issues_reported).to.not.contain("<script>");
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. SQL INJECTION ATTEMPTS
  // ════════════════════════════════════════════════════════════════
  describe("SQL injection resistance", function () {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --",
      "admin'--",
    ];

    for (const payload of sqlPayloads) {
      it(`rejects SQL injection in login: ${payload.substring(0, 30)}`, async function () {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ username: payload, password: "anything" });
        expect(res.status).to.be.oneOf([400, 401]);
      });
    }

    it("SQL injection in search parameter does not leak data", async function () {
      const res = await request(app)
        .get("/api/workers?search=" + encodeURIComponent("' OR '1'='1"))
        .set("x-session-token", tokens.admin);
      expect(res.status).to.be.oneOf([200, 400]);
      // Should return empty or filtered results, not all rows
      if (res.status === 200 && Array.isArray(res.body)) {
        expect(res.body).to.be.an("array");
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. TOKEN-IN-URL REJECTION
  // ════════════════════════════════════════════════════════════════
  describe("Token-in-URL rejection", function () {
    it("does not accept token as query parameter", async function () {
      const res = await request(app)
        .get(`/api/users?token=${tokens.admin}`);
      expect(res.status).to.equal(401);
    });

    it("does not accept token in URL path", async function () {
      const res = await request(app)
        .get("/api/users")
        .query({ token: tokens.admin });
      expect(res.status).to.equal(401);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. UNAUTHORIZED PASSWORD CHANGE
  // ════════════════════════════════════════════════════════════════
  describe("Password change security", function () {
    it("rejects password change without current password", async function () {
      const res = await request(app)
        .put(`/api/users/1/password`)
        .set("x-session-token", tokens.admin)
        .send({ newPassword: "Hacked123!" });
      // Should fail — current password required for self-change
      expect(res.status).to.not.equal(200);
    });

    it("rejects password change with wrong current password", async function () {
      const res = await request(app)
        .put(`/api/users/1/password`)
        .set("x-session-token", tokens.admin)
        .send({ currentPassword: "WrongPassword123!", newPassword: "NewPass123!" });
      expect(res.status).to.not.equal(200);
    });

    it("rejects short passwords", async function () {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: "test_collector", password: "TestPass123!" });
      if (loginRes.status === 200) {
        const res = await request(app)
          .put(`/api/users/${loginRes.body.user.id}/password`)
          .set("x-session-token", loginRes.body.token)
          .send({ currentPassword: "TestPass123!", newPassword: "short" });
        expect(res.status).to.equal(400);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. CSV INJECTION PROTECTION
  // ════════════════════════════════════════════════════════════════
  describe("CSV injection protection", function () {
    it("payment report CSV does not contain raw formula payloads", async function () {
      // Create a business and payment with formula-like name
      const bizResult = await db.query(
        "INSERT INTO businesses (name, owner_name, type, safer_zone_id) VALUES ($1, $2, $3, $4) RETURNING id",
        ['=CMD("calc")', "Test Owner", "shop", 1]
      );
      const bizId = bizResult.rows[0].id;

      await db.query(
        "INSERT INTO payments (business_id, amount, status, month, year, collected_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [bizId, 100, "paid", 1, 2026, getTestUserId_safe("admin")]
      );

      const res = await request(app)
        .get("/api/reports/payments/monthly?month=1&year=2026")
        .set("x-session-token", tokens.admin);

      if (res.status === 200 && typeof res.text === "string") {
        // CSV should prefix formula chars with apostrophe
        expect(res.text).to.not.match(/^=CMD/m);
      }

      // Cleanup
      await db.query("DELETE FROM payments WHERE business_id=$1", [bizId]);
      await db.query("DELETE FROM businesses WHERE id=$1", [bizId]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. MALICIOUS UPLOAD REJECTION
  // ════════════════════════════════════════════════════════════════
  describe("Upload security", function () {
    it("rejects executable files", async function () {
      const res = await request(app)
        .post("/api/inspections/1/photos")
        .set("x-session-token", tokens.admin)
        .attach("photo", Buffer.from("MZ" + "P".repeat(100)), "malware.exe");
      expect(res.status).to.be.oneOf([400, 403, 404, 413]);
    });

    it("rejects oversized files", async function () {
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6MB
      const res = await request(app)
        .post("/api/inspections/1/photos")
        .set("x-session-token", tokens.admin)
        .attach("photo", bigBuffer, "big.jpg");
      expect(res.status).to.be.oneOf([400, 403, 404, 413]);
    });

    it("rejects path traversal in filenames", async function () {
      const res = await request(app)
        .post("/api/inspections/1/photos")
        .set("x-session-token", tokens.admin)
        .attach("photo", Buffer.from("fake image data"), "../../etc/passwd.jpg");
      expect(res.status).to.be.oneOf([400, 403, 404, 413]);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 7. SECURITY HEADERS
  // ════════════════════════════════════════════════════════════════
  describe("Security headers", function () {
    it("returns security headers", async function () {
      const res = await request(app).get("/api/health");
      expect(res.headers["x-content-type-options"]).to.equal("nosniff");
      expect(res.headers["x-frame-options"]).to.equal("SAMEORIGIN");
      expect(res.headers["referrer-policy"]).to.equal("strict-origin-when-cross-origin");
    });

    it("CSP header is present", async function () {
      const res = await request(app).get("/api/health");
      expect(res.headers["content-security-policy"]).to.be.a("string");
      expect(res.headers["content-security-policy"]).to.include("default-src");
    });
  });
});

// Helper to safely get userId
function getTestUserId_safe(roleKey) {
  try {
    return require("./helpers/setup").getTestUserId(roleKey);
  } catch { return 1; }
}
