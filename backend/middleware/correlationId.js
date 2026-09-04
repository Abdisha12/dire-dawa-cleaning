// backend/middleware/correlationId.js — Request correlation ID middleware
const { v4: uuidv4 } = require("uuid");

function correlationIdMiddleware(req, res, next) {
  req.correlationId = uuidv4();
  res.setHeader("X-Request-ID", req.correlationId);
  next();
}

module.exports = correlationIdMiddleware;
