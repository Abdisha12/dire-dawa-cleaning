# Security Documentation

## Authentication Model

### Session-Based Authentication

The system uses opaque session tokens (UUID v4) stored in the `sessions` table.
No JWT is used. No tokens appear in URLs.

**Login flow:**
1. Client sends `POST /api/auth/login` with `{username, password}`
2. Server validates credentials against bcrypt hash
3. Server invalidates any existing sessions for that user (session fixation protection)
4. Server creates a new session with configurable expiry (default: 8 hours)
5. Server returns `{token, user}` — token is a UUID v4

**Token usage:**
- Header: `x-session-token: <token>` (preferred)
- Header: `Authorization: Bearer <token>` (alternative)
- Tokens in URLs are rejected (no `?token=` support)

**Logout:**
- `POST /api/auth/logout` deletes the session from the database
- Token becomes immediately invalid

**Session expiry:**
- Configurable via `SESSION_EXPIRY_HOURS` (default: 8)
- Expired sessions are pruned on every login
- Sessions are checked on every authenticated request

### Brute-Force Protection

- In-memory failed login tracking (resets on server restart)
- After 5 failed attempts (configurable: `LOGIN_MAX_FAILED`), account locks for 15 minutes (`LOGIN_LOCKOUT_MINUTES`)
- Returns HTTP 429 with clear lockout message
- Successful login clears failed attempt counter

### Password Requirements

- Minimum 8 characters
- Must contain at least one letter and one number
- Current password required for self-changes
- Admin can reset any user's password (audit logged)
- All password changes are audit-logged

## Authorization Model

### Role Hierarchy

| Role | Permissions |
|---|---|
| `admin` | Full access to all resources and user management |
| `collector` | Access to all zones within assigned kebeles |
| `leader` | Access only to their assigned zone |
| `viewer` | Read-only access, no create/update/delete |

### Role Enforcement

Authorization is enforced server-side in two layers:

1. **Route-level**: `requireRole("admin", "collector")` middleware blocks unauthorized roles
2. **Query-level**: Role-based SQL filtering restricts data visibility

### Kebele/Zone Scoping

**Collector scoping:**
- Collectors are assigned to kebeles via `kebeles.collector_id`
- Leader filtering applies: `WHERE sz.leader_id = ?` for leader role
- Collectors see all data within their assigned kebeles

**Leader scoping:**
- Leaders are assigned to a single zone via `safer_zones.leader_id`
- All list queries include: `WHERE sz.leader_id = ?`
- Leaders cannot create/update resources in other zones
- Zone access is verified via `zoneAccess` middleware

**Cross-zone access denial:**
- PUT/POST/DELETE operations verify zone ownership
- Leaders cannot modify entities in other zones
- Database-level constraints prevent orphaned references

## Secrets Management

### Required Secrets

| Secret | Purpose | Min Length |
|---|---|---|
| `DB_ROOT_PASSWORD` | MariaDB root access | 16+ chars |
| `DB_PASSWORD` | Application DB user | 16+ chars |
| `SESSION_SECRET` | Session signing | 32+ chars |
| `PAYMENT_WEBHOOK_SECRET` | Webhook HMAC verification | 32+ chars |

### Secret Rules

- Never commit `.env` files to version control
- Use different values for each secret (no sharing)
- Rotate secrets periodically
- `SESSION_SECRET` must be at least 32 characters (enforced at startup)
- `PAYMENT_WEBHOOK_SECRET` must be different from `SESSION_SECRET`
- Production: use a secrets manager (Docker secrets, AWS SSM, etc.)

### Environment Variables

See `backend/.env.example` for all required and optional variables.

## File Upload Rules

### Allowed Types

**Inspection photos:**
- JPEG, PNG, GIF, WebP, HEIC, HEIF
- Max 5MB (configurable: `MAX_FILE_SIZE_MB`)

**Documents:**
- PDF, DOC, DOCX, XLS, XLSX, CSV, TXT
- Images (same as inspection photos)
- Max 5MB

### Security Measures

1. **Magic byte validation**: File content is checked against actual file type (not just extension)
2. **Extension allowlist**: Only known-safe extensions are accepted
3. **Executable blocking**: `.exe`, `.bat`, `.sh`, `.php`, `.js` files are rejected
4. **Filename sanitization**: Dangerous characters stripped, path traversal prevented
5. **Path traversal guard**: Resolved path must be within uploads directory
6. **Size limits**: Enforced by both multer and custom middleware

### Upload Storage

- Inspection photos: `backend/uploads/inspections/`
- Documents: `backend/uploads/documents/`
- Files are stored with sanitized filenames
- Original filenames are preserved in the database (not on disk)

## Security Headers

### Helmet (Backend)

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; ...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Resource-Policy: cross-origin
```

### Nginx (Frontend)

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-XSS-Protection: 1; mode=block
Content-Security-Policy: (same as backend)
```

### CSP Directives

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Only same-origin by default |
| `script-src` | `'self' https://cdnjs.cloudflare.com` | Chart.js CDN |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles needed for SPA |
| `img-src` | `'self' data: https://api.qrserver.com` | QR code generation |
| `connect-src` | `'self'` | API calls only |
| `object-src` | `'none'` | No plugins |
| `frame-ancestors` | `'self'` | Prevent clickjacking |
| `base-uri` | `'self'` | Prevent base tag injection |
| `form-action` | `'self'` | Prevent form hijacking |

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 10 requests | 15 minutes |
| `POST /api/auth/*` | 30 requests | 15 minutes |
| `GET/PUT/DELETE /api/*` | 500 requests | 1 minute |

Rate limiting uses `express-rate-limit` with `trust proxy` enabled (behind nginx).

## Audit Logging

All significant actions are logged to the `audit_log` table:

| Action | Entity | Logged |
|---|---|---|
| `LOGIN` | session | username, role |
| `LOGOUT` | session | username |
| `CREATE` | user, payment, worker, etc. | old/new values |
| `UPDATE` | user, payment, worker, etc. | old/new values |
| `DELETE` | user, payment, worker, etc. | old/new values |

Audit logs include: user ID, action, entity type, entity ID, old/new values, IP address, user agent, timestamp.

Audit logs are append-only (no update/delete operations).

## SQL Injection Prevention

- All queries use parameterized statements (`?` placeholders)
- LIKE wildcards (`%`, `_`) are escaped in user input
- Zod validation sanitizes input before it reaches queries
- No string concatenation in SQL queries

## XSS Prevention

**Backend:**
- `esc()` function in sandbox.js for server-rendered HTML
- Zod validation trims and validates all string input

**Frontend:**
- `escapeHtml()`, `escapeAttr()`, `escapeJsStr()` in `utils.js`
- All dynamic HTML uses escaping functions
- `safeJsonDisplay()` for JSON in HTML contexts

## CSV Injection Prevention

- `sanitizeCSVValue()` prefixes formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with apostrophe
- Applied to all CSV report exports

## Production Deployment Security

### Pre-Deployment Checklist

- [ ] All secrets set in environment (not in code)
- [ ] `SESSION_SECRET` is 32+ characters
- [ ] `PAYMENT_WEBHOOK_SECRET` is set and different from `SESSION_SECRET`
- [ ] `DB_PASSWORD` is strong (16+ chars)
- [ ] `.env` file is NOT in the repository
- [ ] `NODE_ENV=production`
- [ ] HTTPS enabled (via nginx/reverse proxy)
- [ ] Firewall restricts database port (3306) to backend only
- [ ] Backup procedure tested
- [ ] Log rotation configured

### Network Security

- Database (port 3306) is NOT exposed to the internet
- Backend (port 5000) is NOT exposed — only accessible via nginx
- Frontend (port 80/443) is the only public endpoint
- Docker network isolates services

### Container Security

- Backend runs as non-root user (`appuser`)
- Frontend runs nginx (drops privileges after binding port 80)
- Resource limits set on all containers
- No unnecessary capabilities

## Reporting Vulnerabilities

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email: [SECURITY_EMAIL] (replace with actual contact)
3. Include: description, steps to reproduce, potential impact
4. Response time: within 48 hours
5. We will work with you to understand and address the issue
6. Credit will be given in the release notes (unless you prefer anonymity)
