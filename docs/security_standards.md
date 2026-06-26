# Application Security Standards

## Overview
This document outlines the security standards and requirements for the [Project Name/System] application. Given the nature of the data (NDPS cases, legal records), strict adherence to these guidelines is mandatory to ensure the confidentiality, integrity, and availability of sensitive information.

## Core Security Principles
- **Least Privilege**: Users and processes should only have access to the resources necessary for their roles.
- **Defense in Depth**: Layered security controls to protect against potential threats.
- **Fail Securely**: The system must default to a secure state if an error occurs or a component fails.

## Technical Security Requirements

### 1. Authentication & Authorization
- **Password Hashing**: All user passwords must be hashed using `bcrypt` with a high enough cost factor.
- **JWT Management**: JSON Web Tokens (JWT) must have short expiration times and use secure signing keys stored in environment variables.
- **Role-Based Access Control (RBAC)**: Access to specific modules (e.g., admin dashboards, legal records) must be strictly enforced based on user roles defined in the backend.

### 2. Data Integrity & Protection
- **SQL Injection Prevention**: Use of Prisma ORM ensures parameterized queries; however, all dynamic inputs must still be validated against expected types/formats.
- **XSS Prevention**: All frontend components must escape and sanitize data before rendering to prevent Cross-Identity Scripting.
- **Data Encryption**: Highly sensitive fields (e.g., personal identifiers, specific case details) should be encrypted at rest where appropriate.

### 3. Infrastructure & Transport
- **HTTPS Only**: The application must only serve over TLS/SSL.
- **CORS Policy**: Strict Cross-Origin Resource Sharing policies must be enforced to allow access only from authorized domains.
- **Security Headers**: Use `helmet` or similar middleware to set standard HTTP headers (e.g., `X-Content-Type-Options`, `X-Frame-Options`).

### 4. Request Handling & Rate Limiting
- **Rate Limiting**: Implement `express-rate-limit` on all public endpoints, especially login, registration, and search functionalities, to mitigate brute-force and DoS attacks.
- **Input Validation**: All incoming requests must be validated against a predefined schema (e.g., Joi or Zod) before processing.

### 5. File & Media Security
- **File Uploads**: Uploaded files via `multer` must be scanned for malicious content, and their file types/sizes must be strictly validated.
- **Safe Pathing**: Ensure that file storage paths are not constructed using unsanitized user input to prevent directory traversal attacks.

### 6. Dependency Management
- **Automated Scanning**: Regularly audit dependencies for known vulnerabilities (e.g., `npm audit` or Snyk).
- **Update Policy**: Critical security patches for core libraries (`express`, `pg`, `prisma`) must be applied within 48 hours of release.

## Compliance & Logging
- **Audit Logs**: All actions involving sensitive data access or modification must be logged with timestamps, user IDs, and action types.
- **Sensitive Data Masking**: Log files must not contain plain-text passwords, session tokens, or PII.
Security Audit & Remediation Plan — GarudaNDPS_TPT
Context
GarudaNDPS_TPT is a law-enforcement NDPS (narcotics) case-management system holding highly sensitive PII and case evidence. The user asked whether the codebase contains vulnerabilities. A full read-only audit was performed across three areas: authentication/authorization, injection/data-access, and secrets/uploads/config/dependencies.

The codebase already shows prior hardening ("SECURITY FIX #N" comments, bcrypt cost 12, account lockout, scope-based IDOR protection on offenders, CSV formula escaping, Aadhaar masking, explicit-field whitelists, parameterized enforcement queries, httpOnly cookies). The findings below are the remaining substantiated gaps, prioritized for remediation.

Findings (deduplicated, by severity)
CRITICAL
C1 — Live production DB credentials + JWT signing secret live on disk and must be treated as compromised. backend/.env contains a reachable Neon Postgres prod credential and the prod JWT_SECRET. Mitigation in place: .env is git-ignored and was never committed (verified). But the JWT secret being known to anyone with dev/local access = full auth-token forgery for any role. Same prod credential is reused in backend/.env.test with a weak test secret, so tests run against live data.
HIGH
H1 — Privilege/scope fully trusted from JWT; no DB re-check. auth.middleware.ts:52 re-checks is_active/locked_until from DB but takes role, department, police_station_id, district, division_id straight from the decoded token. A demoted/reassigned user keeps old privileges & data scope until token expiry (effectively up to 7 days via non-rotating refresh).
H2 — IDOR on surveillance per-offender history. surveillance.controller.ts:152-187 (getOffenderSurveillanceHistory) applies no PS/district scope and the route has no permission gate — any authenticated user can enumerate any offender's surveillance records by ID.
H3 — IDOR on surveillance update. surveillance.controller.ts:109-149 uses findUnique by PK with no scope check before update — cross-station record tampering.
H4 — IDOR on IMEI records. imei.controller.ts:7-90 (get/create/update) applies no offender-scope check; requirePermission is a capability gate, not row-level scope.
H5 — CSRF exposure. Auth cookies set with sameSite:'none' (auth.controller.ts:99,181,229) and no CSRF token / Origin check on mutating routes. Browsers attach the credentialed cookie to cross-site requests; the request executes server-side before CORS blocks the response.
H6 — seed-full.ts plants password123 for privileged accounts (sp/asp/sdpo/sho...) with no production guard, unlike other seed scripts that require SEED_PASSWORD + a NODE_ENV check.
H7 — xlsx@0.18.5 (SheetJS) unpatched Prototype Pollution + ReDoS, reachable via attacker-uploaded Excel in import.controller.ts:327 (XLSX.read(req.file.buffer)). No npm-registry fix exists for this line.
MEDIUM
M1 — Refresh token never rotated / no reuse detection. auth.controller.ts:191 returns the same opaque refresh token; a stolen refresh token is valid for its full 7-day life.
M2 — Unscoped writes attributed to arbitrary stations/offenders. intelligence.controller.ts:64-93 and surveillance.controller.ts:84 (create) take psId/ offenderId from the body with no scope validation and no permission gate.
M3 — Unbounded pagination. offenders.controller.ts:54-55 takes size from query with no cap (?size=1000000 → heavy join + count = cheap DoS); page/size unvalidated (NaN/negative).
M4 — Unrestricted/oversized import payloads. import.controller.ts accepts client aoa/ rows arrays (up to 50MB body) processed in unbounded per-row write loops; confirmDprImport trusts client-supplied row.isValid.
M5 — frontend/public/QuickShareSetup.exe (~11 MB) committed and publicly served from a govt law-enforcement site (supply-chain/malware-distribution surface; provenance unknown).
M6 — backend/uploads/ not git-ignored; an uploaded image is already committed — future PII/evidence uploads risk being committed.
LOW
L1 — Login tokens also returned in JSON body (auth.controller.ts:113-116,189-192), undermining the httpOnly-cookie protection; frontend doesn't use them.
L2 — JWT verify doesn't pin algorithm (auth.middleware.ts:34) — add algorithms:['HS256'].
L3 — Global error handler leaks err.message to clients (server.ts:140).
L4 — Frontend trusts localStorage.garuda_user.role for UI gating (AuthContext.jsx) — exposes admin UI; not a server bypass.
L5 — Login rate limiter IP-only & generous (20/15min); trust proxy + XFF spoofing risk.
L6 — Stateless access token can't be revoked; 8h lifetime; idle-timeout is client-only.
L7 — uploadDocument accepts file if mime OR ext matches (laxer than photo filter); no magic-byte check.
L8 — PDF export filename built from unsanitized offender.full_name (export.controller.ts:310) — header-value injection via CR/LF/quotes.
L9 — check-admin.ts reveals legacy admin password convention Admin@123.
Verified clean (no action)
Mass-assignment (explicit whitelists), enforcement raw query (parameterized Prisma.sql), CSV formula injection (escaped), all orderBy are hardcoded literals, CORS uses an explicit allowlist (not wildcard), no hardcoded JWT fallback in app code, .env not committed, SSE has connection limits, audit logger doesn't over-log PII.

Remediation plan (suggested order)
Phase A — Credentials (do first, outside code):

Rotate the Neon DB password and JWT_SECRET; move to Vercel env-var store. All existing JWTs become invalid after rotation (acceptable).
Point .env.test at a disposable/local DB with its own throwaway secret.
Phase B — Access control (highest code risk): 3. In auth.middleware.ts, extend the existing DB lookup to also select role, department, police_station_id, district, division_id and overwrite the decoded values before req.user=. 4. Add scope checks to surveillance (getOffenderSurveillanceHistory, updateSurveillanceRecord, createSurveillanceRecord) and IMEI (get/create/update) controllers — reuse the existing getOffenderWhere(user) / scope helpers (utils/scope.ts, pattern in offenders.controller.ts). Add requirePermission gates on the matching routes. 5. Validate psId/offenderId against caller scope in intelligence/surveillance create.

Phase C — CSRF & token hygiene: 6. If frontend & API are same-site, switch cookies to sameSite:'lax'. Otherwise add a CSRF token (double-submit) + Origin allowlist check on non-GET routes. 7. Rotate refresh tokens on /refresh with reuse detection; stop returning tokens in JSON body; pin algorithms:['HS256']; shorten access-token lifetime.

Phase D — Input/DoS hardening: 8. Clamp pagination (Math.min(Math.max(Number(size)||10,1),100)), validate numeric inputs. 9. Cap import row counts, batch in a bounded transaction, re-derive validation server-side. 10. Tighten uploadDocument (require mime AND ext); sanitize PDF Content-Disposition filename.

Phase E — Repo hygiene & deps: 11. git rm --cached backend/uploads/*, add uploads/ to backend/.gitignore + .gitkeep. 12. Remove/relocate QuickShareSetup.exe; verify provenance. 13. Replace/upgrade xlsx to a patched SheetJS build or exceljs; add parse size/time bounds. 14. Delete dev probe scripts (check-admin.ts); make seed-full.ts env-gated like other seeds. 15. Return generic 500 messages in production (server.ts).

Verification
After Phase B, write/extend tests in backend/src/__tests__/surveillance.test.ts and a new imei.test.ts: a station-scoped user must get 403/404 reading/updating another station's records. Existing scope.test.ts shows the pattern.
After Phase A/C, confirm login → access → refresh still works (auth.test.ts), tokens no longer appear in JSON body, and an old token fails after secret rotation.
Run the existing Jest suite (backend npm test) against a non-prod DB.
Manual: attempt ?size=1000000 on offenders list → capped; upload a renamed .html as a document → rejected.
Note: This plan is an analysis/remediation roadmap. No code changes have been made.