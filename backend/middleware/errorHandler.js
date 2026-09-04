// backend/middleware/errorHandler.js — Centralized Express error handler
// Classifies errors, prevents information leakage, returns consistent structure.
const logger = require("../config/logger");
const { ZodError } = require("zod");

const IS_PROD = process.env.NODE_ENV === "production";

function errorHandler(err, req, res, _next) {
  // ── Zod validation errors ──────────────────────────────────
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }))
    });
  }

  // ── Custom validation errors (from validate middleware) ─────
  if (err.validationErrors) {
    return res.status(400).json({
      error: err.message || "Validation failed",
      details: err.validationErrors
    });
  }

  // ── Multer file upload errors ──────────────────────────────
  if (err.code && err.code.startsWith("LIMIT_")) {
    return res.status(400).json({ error: "File upload limit exceeded" });
  }

  // ── Authentication errors ──────────────────────────────────
  if (err.status === 401 || err.message?.includes("session")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // ── Authorization errors ───────────────────────────────────
  if (err.status === 403) {
    return res.status(403).json({ error: err.message || "Insufficient permissions" });
  }

  // ── Not found ──────────────────────────────────────────────
  if (err.status === 404) {
    return res.status(404).json({ error: err.message || "Resource not found" });
  }

  // ── Client errors (400-level) ──────────────────────────────
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message || "Bad request" });
  }

  // ── PostgreSQL errors — never leak SQL or credentials ──────
  if (err.code && (err.code.startsWith("23") || err.code.startsWith("42") || err.code === "23505")) {
    logger.error("Database error", { code: err.code, message: err.message, stack: err.stack, url: req.url });
    if (err.code === "23505") {
      return res.status(409).json({ error: "Resource already exists" });
    }
    if (IS_PROD) {
      return res.status(500).json({ error: "Internal server error" });
    }
    return res.status(500).json({ error: `Database error: ${err.code}` });
  }

  // ── Legacy MySQL errors (fallback) ─────────────────────────
  if (err.code && err.code.startsWith("ER_")) {
    logger.error("Database error", { code: err.code, message: err.message, stack: err.stack, url: req.url });
    if (IS_PROD) {
      return res.status(500).json({ error: "Internal server error" });
    }
    return res.status(500).json({ error: `Database error: ${err.code}` });
  }

  // ── File system errors ─────────────────────────────────────
  if (err.code === "ENOENT" || err.code === "EACCES") {
    logger.error("File system error", { code: err.code, message: err.message, url: req.url });
    return res.status(500).json({ error: "File system error" });
  }

  // ── Unknown/unexpected errors ──────────────────────────────
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  if (IS_PROD) {
    return res.status(500).json({ error: "Internal server error" });
  }

  // In development, include the error message (but never the full stack)
  return res.status(500).json({
    error: err.message || "Internal server error",
    ...(err.code && { code: err.code })
  });
}

module.exports = errorHandler;
