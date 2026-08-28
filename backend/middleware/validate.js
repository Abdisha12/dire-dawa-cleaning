// backend/middleware/validate.js — Zod validation middleware
// Wraps Zod schemas into Express middleware for body, query, and params validation.
const { ZodError } = require("zod");

/**
 * Creates Express middleware that validates req.body, req.query, or req.params
 * against the provided Zod schemas.
 * @param {Object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
function validate(schemas, target) {
  if (target) {
    schemas = { [target]: schemas };
  }
  return (req, res, next) => {
    const errors = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({
          source: "body", path: i.path.join("."), message: i.message
        })));
      } else {
        req.body = result.data; // Use parsed/trimmed values
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({
          source: "query", path: i.path.join("."), message: i.message
        })));
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({
          source: "params", path: i.path.join("."), message: i.message
        })));
      } else {
        req.params = result.data;
      }
    }

    if (errors.length > 0) {
      const err = new Error("Validation failed");
      err.status = 400;
      err.validationErrors = errors;
      return next(err);
    }

    next();
  };
}

module.exports = validate;
