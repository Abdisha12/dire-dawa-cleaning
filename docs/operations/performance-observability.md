# Performance Observability

## Request Duration
The application tracks request timing via middleware. A lightweight duration logger can be added:

### Example middleware:
```javascript
// backend/middleware/response-time.js
function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start);
    if (req.correlationId) {
      logger.info(`request_duration_ms`, {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        durationMs,
        status: res.statusCode,
      });
    }
  });
  next();
}
```

**Current status**: Infrastructure ready (correlationId, logger present). Adding this middleware is a one-line `app.use()` addition.

**Rationale**: Duration tracking helps identify slow endpoints, N+1 query patterns, and performance regressions. In production, only durations exceeding a threshold need to be captured.

## Slow Request Threshold
- **Configurable** via `SLOW_REQUEST_MS` env var (default: `2000`)
- Logged at `logger.info("slow_request", {...})` when exceeded
- HTTP response completes normally — no user-visible impact
- Helps identify N+1 patterns, expensive GIS queries, unoptimized reports

**Example**:
```javascript
const slowThreshold = Number(process.env.SLOW_REQUEST_MS) || 2000;
if (durationMs >= slowThreshold) {
  logger.warn(`slow_request exceeded threshold`, {
    correlationId: req.correlationId,
    durationMs,
    threshold: slowThreshold,
  });
}
```

## Database Query Duration
Not automatically logged by the current pool setup. To enable:

### Option B: Manual query logging (recommended, low overhead)
Wrap the pool's `query` method temporarily in `backend/config/db.js`:
```javascript
const originalQuery = pool.query.bind(pool);
pool.query = (...args) => {
  const start = Date.now();
  return originalQuery(...args).then((result) => {
    const duration = Date.now() - start;
    if (duration > 1000 || process.env.NODE_ENV !== "production") {
      logger.info(`db_query_duration`, {
        correlationId: req?.correlationId,
        query: originalQuery.toString().replace(/\s+/g, ' ').substring(0, 200),
        durationMs: duration,
      });
    }
    return result;
  });
};
```

**Rationale**: Minimal overhead; only logs slow queries or in development.

## Error Rate
Error rate is captured implicitly through the Winston error transport. Manual calculation (cron-based):
```bash
ERROR_COUNT=$(grep -c "level.*error" logs/error-$(date +%Y-%m-%d).log 2>/dev/null || echo 0)
echo "Hourly errors: $ERROR_COUNT"
```

## Request Volume
Request volume is not automated. Manual calculation:
```bash
REQUEST_COUNT=$(grep -c "method.*GET\|method.*POST\|method.*PUT\|method.*DELETE" logs/app-$(date +%Y-%m-%d).log 2>/dev/null || echo 0)
echo "Daily requests: $REQUEST_COUNT"
```

## Performance Observability Summary

| Metric | Status | Effort |
|---|---|---|
| Request duration | Infrastructure ready; middleware one-line add | 5 min |
| Slow request threshold | Configurable env var + middleware | 10 min |
| Database query duration | Can be added via pool wrapper | 15 min |
| Error rate | Visible via log volume; automated calc optional | 30 min |
| Request volume | Visible via log volume; optional calc | 10 min |
| Performance alerts | Not yet; can be added via cron + grep | 10 min |

**Overall**: The observability infrastructure (correlationId, structured JSON logs, winston transports) is in place. Adding duration tracking and thresholds is low effort and provides real operational value. Database query monitoring and error/rate calculation can be added incrementally.