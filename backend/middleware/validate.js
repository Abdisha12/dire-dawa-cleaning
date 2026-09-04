function sanitizeValue(val) {
  if (typeof val === "string") {
    return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<[^>]+>/g, "");
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === "object" && val.constructor === Object) {
    const cleaned = {};
    for (const [k, v] of Object.entries(val)) {
      cleaned[k] = sanitizeValue(v);
    }
    return cleaned;
  }
  return val;
}

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
        errors.push(
          ...result.error.issues.map((i) => ({
            source: "body",
            path: i.path.join("."),
            message: i.message
          }))
        );
      } else {
        req.body = sanitizeValue(result.data); // Use parsed/trimmed/sanitized values
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((i) => ({
            source: "query",
            path: i.path.join("."),
            message: i.message
          }))
        );
      } else {
        req.query = sanitizeValue(result.data);
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map((i) => ({
            source: "params",
            path: i.path.join("."),
            message: i.message
          }))
        );
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
