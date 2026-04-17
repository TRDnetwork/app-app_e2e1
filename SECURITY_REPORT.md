# Security Scan Report

## Critical Issues
- [server.js, line 35] **Exposed API Keys**: `process.env.JWT_SECRET` is used directly in `jwt.verify()` without validation. If undefined, it defaults to `undefined`, which weakens JWT verification. This could allow token forgery.
  - **Fix**: Validate presence of `JWT_SECRET` at startup and throw an error if missing.

- [app.js, lines 13-16] **Exposed API Keys**: Supabase URL and anon key are exposed via `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__`. These are client-side secrets and can be misused if intercepted or leaked.
  - **Fix**: These should not be exposed in frontend code. Instead, use environment variables during build time (e.g., via Vite/React env replacement) or inject securely. Since this is a static site, recommend using a build process that replaces `import.meta.env.VITE_SUPABASE_URL` etc.

- [realtime.js, line 9] **SQL Injection / Filter Injection**: The filter uses string concatenation with user ID from `supabase.auth.getUser()`. While the user ID is from auth, it's still unsafe to use raw values in filters without parameterization.
  - **Fix**: Use template literals only after confirming the value is a valid UUID. However, Supabase Realtime filter does not support parameterized queries, so sanitize input.

## Warnings
- [server.js] **Missing Rate Limiting**: Auth-related endpoints (not implemented here) and `/api/workouts` are not rate-limited. This could allow abuse or DoS.
  - **Fix**: Add rate limiting middleware for public and authenticated routes.

- [app.js] **XSS (Cross-Site Scripting)**: Although `escapeHtml()` is used, it's custom and may miss edge cases. Relying on manual escaping increases risk.
  - **Fix**: Prefer using `textContent` instead of `innerHTML` where possible.

- [server.js] **Insecure Error Handling**: Generic "Internal server error" messages are returned, but full error logs are printed to console. In production, this could leak stack traces via logs.
  - **Fix**: Ensure server logs are secured and not exposed.

- [server.js] **CORS Misconfiguration**: Origin is set from `process.env.CLIENT_URL` with no default restriction. If not set, defaults to `http://localhost:3000`, which is acceptable for dev but should be validated in prod.
  - **Fix**: Enforce `CLIENT_URL` in production.

## Passed Checks
- SQL Injection: All PostgreSQL queries use parameterized queries (`$1`, `$2`) — no string concatenation.
- Authentication: Protected routes use `authenticateToken` middleware.
- RLS: Database schema includes proper Row Level Security policies.
- Helmet: Security headers are applied via `helmet()` middleware.
- Path Traversal: No file operations based on user input.
- Data Exposure: No sensitive data in error responses (generic messages used).
- Content-Security-Policy: Partially covered by `helmet()`, but could be enhanced.

===