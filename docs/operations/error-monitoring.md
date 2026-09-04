# Error Monitoring Readiness

## Architecture Overview
The application is designed for provider-neutral error monitoring without requiring a paid SaaS service. All error data is captured in structured application logs (Winston), enabling any log analysis tool or service to consume it.

## What Errors Are Captured

### 1. Request-Level Errors (automatic via Express middleware)
- All `res.status(...).json(...)` responses from `errorHandler`
- Validation errors (Zod `safeParse` failures → 400)
- Validation errors from `validate()` middleware → 400
- Multer file upload limit errors → 400
- Authentication errors → 401
- Authorization errors → 403
- Not found → 404
- Client errors (400-499) → status code + message
- PostgreSQL errors (constraint violations, syntax, permissions) → logged, generic 500 in prod
- File system errors (ENOENT, EACCES) → logged, generic 500
- Unexpected/unhandled errors → full stack + context in dev; generic 500 in prod

### 2. Application-Level Errors (manual logging)
- `logger.info()`, `logger.warn()`, `logger.error()` calls from route handlers
- Audit log entries (`auditService.log()`)
- Startup messages (db connect, service ready)
- Background scanner messages (alert scanner every 6 hours)

### 2. Performance Errors
- Slow database queries (if log-level is debug)
- Failed migrations
- Backup/verify/restore failures

## Safe Metadata Captured (never redacted)
- `correlationId` — request trace identifier
- `timestamp` — ISO timestamp
- `level` — error/warn/info
- `method` — HTTP method
- `url` — request URL
- `status` — HTTP response status code
- `duration` — response generation time (if logged)
- `userId` — authenticated user ID (where safe, via `req.user?.id`)
- `role` — authenticated user role (where safe)
- `ipAddress` — client IP (from `req.ip` or `req.connection.remoteAddress`)
- `dbCode` — PostgreSQL error code (e.g., `23505`, `42P01`) — **always hashed/redacted in prod**
- `errorCode` — application-level error code (never the raw message in prod)

## What Is Always Redacted / Never Logged
- Passwords (`password_hash`, plaintext passwords from req.body)
- Session tokens (`x-session-token` header value)
- Authorization headers (`Authorization: Bearer ...`)
- Complete request bodies (especially if they contain sensitive data)
- Credit card numbers, Fayda IDs, or other PII (beyond what the model naturally handles)
- Stack traces in production (`IS_PROD` guard in errorHandler)
- Database connection strings, passwords, SSL configs

## Request ID Correlation
Every error log entry includes `correlationId`, enabling traceability across:
- Incoming HTTP request → `X-Request-ID` response header
- Backend processing → `correlationId` in Winston format
- Database errors → logged with `url: req.url` and `code: err.code`
- Response → client sees `X-Request-ID` header (for their own correlation)
- Log aggregation: filter/sort by `correlationId` to trace a single request's path

## Metadata Fields (safe to capture)
| Field | Source | Redaction Status |
|---|---|---|
| `correlationId` | middleware/correlationId.js | Never redacted (enables tracing) |
| `timestamp` | Winston `format.timestamp` | Never redacted |
| `level` | Winston level | Never redacted |
| `method` | `req.method` | Never redacted |
| `url` | `req.url` | Never redacted |
| `status` | response status code | Never redacted |
| `duration` | custom route middleware (optional) | Never redacted |
| `userId` | `req.user?.id` | Never redacted (authenticated only) |
| `role` | `req.user?.role` | Never redacted (authenticated only) |
| `ipAddress` | `req.ip` / `req.connection.remoteAddress` | Never redacted |
| `dbCode` | `err.code` from pg | Redacted in prod (shown as `db_error` only) |
| `errorCode` | application-defined | Redacted in prod (generic message only) |
| `message` | `err.message` | **Redacted in prod** → `"Internal server error"` |
| `stack` | `err.stack` | **Redacted in prod** → omitted entirely |
| `args` | custom log args | Redacted based on content |

## Provider-Neutral Architecture
The system writes to Winston transports, which are:
1. **Console** — development output with colorization
2. **Daily rotate file** — `app-%DATE%.log` (30-day retention), `error-%DATE%.log` (90-day retention)

Any of the following can consume these logs:
- `tail -f logs/app-2026-01-15.log`
- `grep "correlationId" logs/app-*.log`
- `awk`/`sed`/`python` analysis
- Future SaaS ingestion (Datadog, New Relic, etc.) — the format is JSON, ready for any log aggregator
- ELK stack, Splunk, etc.

No proprietary SDK or agent is required. The only dependency is `winston` + `winston-daily-rotate-file`, already in `package.json`.

## Environment-Specific Behavior

### Development (`NODE_ENV` ≠ "production")
- `level: "debug"` — captures all messages
- `stack` included in error logs
- Full error messages in HTTP responses
- Correlation IDs still generated

### Production (`NODE_ENV` = "production")
- `level: "warn"` — only warnings and errors captured
- `stack` omitted from error logs
- Generic `"Internal server error"` in HTTP responses (no stack traces)
- Detailed diagnostics only in `logger.error()` calls (application-controlled)
- `correlationId` still generated and logged

## Alerting (Optional, No Dependency)
The following can be implemented without adding a paid monitoring dependency:
- **Simple shell script** watching `error-%DATE%.log` for `ERROR` level and triggering `mail` or `wall`
- **Log rotation** already handled by `winston-daily-rotate-file` (30d app, 90d error)
- **Cron-based check**: `0 * * * * grep -c "ERROR" logs/error-$(date +%F).log >> /var/log/error-count.log`
- **Health check integration**: if `/api/ready` returns `not_ready`, page on-call

## Implementation Status
✅ Winston logger with correlationId — implemented (Phase 13)  
✅ Error handler with IS_PROD guard — implemented (Phase 13)  
✅ Structured JSON logs — implemented (Phase 13)  
✅ `X-Request-ID` response header — implemented (Phase 13)  
✅ No secrets in logs — verified (Phase 13 audit)  
✅ Provider-neutral log format — ready for any log aggregator  
❌ Optional: Cron-based alert on error count — not yet implemented (can be added simple shell script)  
❌ Optional: Integration with external log service — not required (architecture is provider-neutral)