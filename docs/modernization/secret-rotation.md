# Secret Rotation Notice

**Created:** 2026-08-29 (Phase 0 — Remove Exposed Secrets)

---

## Why Rotation Is Required

The original project archive (`dire-dawa-cleaning.zip`) contained `.env` files with
real credential values that were distributed to anyone with access to the archive.

Even though these files were **not committed to the current Git repository**, the
original archive may have been shared, copied, or stored in locations where others
could access it.

**Any credential that was in the original archive must be considered compromised.**

---

## Credentials That Must Be Rotated

### 1. Database Password

- **What:** PostgreSQL application user password (`ddcms`)
- **Where it was:** `.env` file in the original archive, `docker-compose.yml` fallback (previously `DB_ROOT_PASSWORD` for MariaDB)
- **Current state:** `.env` not in Git; Docker Compose now requires explicit `.env`
- **Action required:**
  1. Generate a new strong password (32+ random characters)
  2. Update your local `.env` file with `DB_PASSWORD=<new-password>`
  3. If using Docker Compose: `docker compose down -v` then `docker compose up --build`
  4. The database volume will be recreated with the new password

### 2. Session Secret

- **What:** HMAC signing key for session tokens
- **Where it was:** `.env` file in the original archive, `docker-compose.yml` fallback
- **Current state:** `.env` not in Git; Docker Compose now requires explicit `.env`
- **Action required:**
  1. Generate a new random string (64+ characters recommended)
  2. Update your local `.env` file with `SESSION_SECRET=<new-secret>`
  3. All existing sessions will be invalidated (users must re-login)

### 3. Seed User Passwords

- **What:** Default password `password` for all 7 seed users
- **Where it was:** `database/schema.sql` (bcrypt hash)
- **Current state:** Still in schema.sql as seed data
- **Action required:**
  1. After first login, change all passwords via Settings → Change Password
  2. In production, delete or disable seed user accounts
  3. The bcrypt hash in schema.sql is only for development seed data

---

## How to Generate Secure Secrets

### Database Password
```bash
openssl rand -base64 32
```

### Session Secret
```bash
openssl rand -hex 32
```

### Or combined
```bash
# Generate both at once
echo "DB_PASSWORD=$(openssl rand -base64 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
```

---

## What Changed in This Commit

| File | Change |
|------|--------|
| `docker-compose.yml` | Removed hardcoded fallback secrets; now requires `.env` with `DB_PASSWORD` and `SESSION_SECRET` |
| `.github/workflows/ci.yml` | Replaced hardcoded `ddcms_root_pass` with `${{ secrets.DB_PASSWORD }}` |
| `backend/.env.example` | Replaced real-looking values with empty placeholders |
| `.env.example` (root) | Created with empty placeholders for Docker Compose |
| `backend/server.js` | Added startup validation that fails fast if secrets are missing |
| `.gitignore` | Added explicit rules for `.env` variants |

---

## For CI/CD (GitHub Actions)

Add these secrets to your GitHub repository settings (Settings → Secrets → Actions):

| Secret Name | Value |
|-------------|-------|
| `DB_PASSWORD` | Your CI database password |

The CI workflow now uses `${{ secrets.DB_PASSWORD }}` instead of hardcoded values.
