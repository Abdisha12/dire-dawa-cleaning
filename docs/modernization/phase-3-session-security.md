# Session Security — Phase 3 Foundation

**Backend (inspected `backend/middleware/auth.js:4`, `backend/routes/auth.js:43`):**
- Session store: `sessions` table (`id` UUID v4, `user_id` FK, `expires_at` TIMESTAMPTZ, `created_at`).
- Token: `uuidv4()` on login, previous sessions for user deleted (`DELETE FROM sessions WHERE user_id=$1`), 8h expiry (`SESSION_EXPIRY_HOURS`), `DELETE FROM sessions WHERE expires_at<NOW()` on login.
- Validation: `authenticate` checks `headers["x-session-token"] || Authorization: Bearer` → `SELECT ... WHERE s.id=$1 AND s.expires_at>NOW() AND u.is_active=TRUE`.
- Business logic preserved: `bcrypt.compare`, lockout `5/15m` (`LOGIN_MAX_FAILED`), audit `LOGIN/LOGOUT`, password never leaves bcrypt, no frontend hashing.
- Logout: `DELETE FROM sessions WHERE id=$1` (idempotent).

**Frontend compatibility (this phase):**
- `lib/api.ts:30` sends both `x-session-token` (primary, current API requirement) and `Authorization: Bearer` for forward-compatibility.
- `lib/auth.ts` + `lib/auth-context.tsx` store token under `ddcms_token` and user JSON under `ddcms_user` in `localStorage` — same keys as Vanilla `frontend/js/api.js:19` for coexistence, but **no secrets in source**, no hardcoding, no `console.log(token)`.
- `api.me()` validates session on app load (`AuthProvider.refresh`), 401 clears storage and redirects to `/login` (centralized in `api.ts:60`).
- Requests use `AbortController` timeout 15s (`lib/api.ts:28`), typed `ApiError` with `status/code/details` (401/403/409/429 mapped), no independent `fetch` outside `lib/api.ts` (Component → lib/api → backend).
- Password handling stays backend-only: `login` sends `{username,password}` over HTTPS, no frontend hashing, no storage of password.

**Do NOT (enforced):**
- Hardcoded tokens, logged tokens, secrets in `src/`, credentials in git. `NEXT_PUBLIC_API_URL` is origin only, not secret.
- Sensitive data in `localStorage` beyond token+user (no password, no hash).

**Future secure migration path (documented, not yet implemented to avoid breaking backend):**
- Prefer `HttpOnly Secure SameSite=Strict` cookie `Set-Cookie: session=…` from backend (`express` + `cookie-parser`), frontend `fetch(..., {credentials: "include"})` and drop `x-session-token` header.
- Requires backend change: `res.cookie("session", token, {httpOnly:true, secure:true, sameSite:"strict", maxAge: 8h})` + `authenticate` reading `req.cookies.session` before header fallback. Frontend then removes `localStorage` token.
- Kept compatible now: backend already accepts both header forms, so cookie can be added without breaking current `x-session-token` clients (Vanilla + Next.js).

**Operational context & Kebele selector security:**
- `KebeleProvider` (`lib/kebele-context.tsx`) fetches `GET /kebeles` (actual DB records, not hardcoded `id=1→Kebele1`), derives `collector_id` for Kebele Admin lock, `zone.kebele_id` for Leader. Frontend disables selector for locked roles; backend remains authoritative (`kebeles.collector_id`, `safer_zones.leader_id` checks).
