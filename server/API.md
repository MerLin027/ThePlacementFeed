# The Placement Feed API: reference

For reviewers and auditors: every endpoint, who may call it, how it is limited and what it records.
The code is the source of truth; this file is kept next to it.

## How access works

- **One session per browser.**
  - **The cookie:** `__Host-tpf_session` in production (`tpf_session` in development). It is httpOnly, Secure (production), SameSite=Lax, Path=/, with no Domain.
  - **Token and storage:** the value is a random 256-bit token. The server keeps only its SHA-256, in the `sessions` collection, where a TTL index removes expired rows.
  - **Lifetimes:** student sessions last 7 days; staff sessions last 3 hours and also end after 1 hour without a request.
  - **When a session ends:** logout, a password change (other devices), a reset, or disabling or deleting the account deletes the rows, so the session ends at once.
  - **On every request:** `authenticate` (features/auth/guards.js) loads the session and the account.
- **Access is decided per namespace, once, at the mount** (src/routes/):
  - `public.js`: no account.
  - `/api/auth`: signing in, out and up, and one's own password.
  - `student.js`: `requireStudentAllowPending` lets a student read the profile only; everything after the second guard needs `requireStudent`, so an account with a pending password change is refused.
  - `admin.js`: `requireStaff`, then `requirePermission(...)` per area.
- **Staff permissions** (features/auth/permissions.js):

  | Permission | super_admin | admin |
  |---|---|---|
  | drives:manage | ✓ | ✓ |
  | applicants:manage | ✓ | ✓ |
  | students:manage | ✓ | ✓ |
  | insights:view | ✓ | ✓ |
  | setup:manage | ✓ | — |
  | staff:manage | ✓ | — |

- **Pending password change.** After a reset, or for a new staff account, the one-time password only opens `/api/auth/password` and `/api/auth/session` (plus the student's profile read). Everything else answers 403 `PASSWORD_CHANGE_REQUIRED`.
- **Wrong kind of account.** A student on `/api/admin/*`, or staff on `/api/student/*`, gets 403 `FORBIDDEN`. With no session, the answer is 401.

## Protections on every request (src/app.js, in order)

1. **Request id:** `X-Request-Id`, also written to error logs and audit events.
2. **Visitor address:** taken from Vercel's `x-real-ip` only when the request carries the shared `PROXY_SECRET` (timing-safe comparison); otherwise the address that connected.
3. **Headers:** helmet security headers; CORS limited to `CLIENT_URL`.
4. **CSRF** (POST/PUT/PATCH/DELETE): the `Origin` (or `Referer`) must equal `CLIENT_URL`, otherwise 403 `CSRF_REJECTED`. This sits on top of the SameSite=Lax cookie.
5. **JSON only:** a request body must be `application/json`, otherwise 415. No form-encoded parser; 100 KB body cap.
6. **Input clean-up** (`sanitize`):
   - keys starting with `$`, containing `.`, or named `__proto__` are removed;
   - bodies nested deeper than 32 levels are refused (400);
   - query strings with control characters, bracketed keys or repeated keys are refused (400).
7. **Caching:** `Cache-Control: no-store` on every `/api` response (the catalog uses `no-cache`).
8. **Errors:** every error has the shape `{ success: false, code, message, errors?: [{ field, message }] }`. Library and parser messages are never echoed; unknown `/api` paths get a JSON 404.

## Endpoints

Rate limits are per 15 minutes, per visitor address unless noted (src/middleware/rateLimit.js). "Audit"
names the `audit_events` action written (ids and outcomes only; see below).

### Public

| Method | Path | Notes | Limit | Audit |
|---|---|---|---|---|
| GET | /api/health | `{ success, message }` | — | — |
| GET | /api/drives | List; filters `status`, `branch`, `ctcMin`, `ctcMax`, `search` (≤100), `sort`, `page` (≤10000), `limit` (≤50). Public fields only | publicRead 100 (shared) | — |
| GET | /api/drives/changes?since= | Change feed, 7-day lookback, ≤50 items | publicRead | — |
| GET | /api/drives/:id | One drive, public fields | publicRead | — |
| GET | /api/catalog | University, branches, active institutes | catalogRead 300 | — |
| GET | /api/cron/trigger | Bearer `CRON_SECRET` (timing-safe); 503 when unset | cronTrigger 10 | — |

### Auth (any account)

| Method | Path | Notes | Limit | Audit |
|---|---|---|---|---|
| POST | /api/auth/signup | Students only. Password policy; the same 409 for a taken email, roll number or staff email | studentSignup 30 | auth.signup |
| POST | /api/auth/login | `{ identifier, password }`: student email, or staff username or email. The same 401 for every failure, after the same bcrypt work | login 100; loginAccount 5 failures per (address, identifier) | auth.login (success/failure, known accounts only) |
| POST | /api/auth/logout | Ends this session | session 300 | auth.logout |
| GET | /api/auth/session | `{ authenticated, account }`; a stale cookie gives `{ authenticated: false, expired: true }` and is cleared | session 300 | — |
| POST | /api/auth/password | Signed in (a pending account too). `currentPassword` unless pending; the one-time password can't be kept; policy; ends other sessions and issues a new one | password: 5 wrong passwords per account | auth.password.change (success/failure) |

### Student (`/api/student`, a student session)

| Method | Path | Notes | Limit | Audit |
|---|---|---|---|---|
| GET | /api/student/profile | Allowed while a password change is pending | profileRead 300 | — |
| PATCH | /api/student/profile | Whitelisted fields only | profileUpdate 30 per account | — |
| PUT | /api/student/profile/institute | One-time choice (409 `INSTITUTE_LOCKED` after) | profileUpdate | — |
| GET | /api/student/applications | Own applications, `group`, `page`, `limit` (≤50) | applicationsRead 300 | — |
| GET | /api/student/applications/summary | Own `{ driveId, status }` for button states | applicationsRead | — |
| POST | /api/student/applications | Apply; server rules decide; snapshot and status are server-built | apply 10 per account | — |

### Staff (`/api/admin`, a staff session, then the permission shown)

| Method | Path | Permission | Limit | Audit |
|---|---|---|---|---|
| GET | /api/admin/drives | drives | applicantsRead 300 | — |
| POST | /api/admin/drives | drives | driveWrite 50 | drive.create |
| PUT | /api/admin/drives/:id | drives | driveWrite | drive.update |
| PATCH | /api/admin/drives/:id/postpone | drives | driveWrite | drive.postpone |
| PATCH | /api/admin/drives/:id/status-automation | drives | driveWrite | drive.statusAutomation |
| GET | /api/admin/drives/:id/application-count | drives | applicantsRead | — |
| DELETE | /api/admin/drives/:id | drives | driveWrite | drive.delete |
| GET | /api/admin/drives/:id/applicants | applicants | applicantsRead 300 | — |
| GET | /api/admin/drives/:id/applicants/insights | applicants | applicantsRead | — |
| GET | /api/admin/drives/:id/applicants/export | applicants | applicantsExport 5 | applicants.export (filters used, free text as "used" only) |
| PATCH | /api/admin/drives/:id/applicants/bulk-status | applicants | applicantsWrite 200 | applicants.bulkStatus |
| POST | /api/admin/drives/:id/applicants/bulk-delete | applicants | applicantsWrite | applicants.delete |
| PATCH | /api/admin/drives/:id/applicants/:appId | applicants | applicantsWrite | applicant.update |
| GET | /api/admin/students | students | studentsRead 300 | — |
| POST | /api/admin/students/:id/reset-password | students. Returns a random one-time password **once** | studentsWrite 30 | student.resetPassword |
| POST | /api/admin/students/:id/reset-institute | students | studentsWrite | student.resetInstitute |
| GET | /api/admin/students/:id/application-count | students | studentsRead | — |
| DELETE | /api/admin/students/:id?applications=retain\|delete | students | studentsWrite | student.delete |
| GET | /api/admin/insights?weeks= | insights | insightsRead 120 | — |
| GET | /api/admin/catalog | setup | catalogAdminRead 300 | — |
| PUT | /api/admin/catalog/university | setup | catalogAdminWrite 60 | catalog.university.update |
| POST | /api/admin/catalog/branches | setup | catalogAdminWrite | catalog.branch.create |
| PATCH | /api/admin/catalog/branches/:id | setup | catalogAdminWrite | catalog.branch.update |
| GET | /api/admin/catalog/branches/:id/usage | setup | catalogAdminRead | — |
| DELETE | /api/admin/catalog/branches/:id[?force=true] | setup | catalogAdminWrite | catalog.branch.delete |
| POST | /api/admin/catalog/institutes | setup | catalogAdminWrite | catalog.institute.create |
| PATCH | /api/admin/catalog/institutes/:id | setup | catalogAdminWrite | catalog.institute.update |
| DELETE | /api/admin/catalog/institutes/:id[?force=true] | setup | catalogAdminWrite | catalog.institute.delete |
| GET | /api/admin/staff | staff | staffRead 300 | — |
| POST | /api/admin/staff | staff. Returns the one-time password **once** | staffWrite 30 | staff.create |
| PATCH | /api/admin/staff/:id | staff. Never your own role or active flag; always one active super admin | staffWrite | staff.update |
| POST | /api/admin/staff/:id/reset-password | staff. Not your own; one-time password returned once | staffWrite | staff.resetPassword |
| DELETE | /api/admin/staff/:id | staff. Disabled accounts only, never your own | staffWrite | staff.delete |

## Passwords

- **Storage:** bcrypt, cost 12. Length is capped at 72 characters (bcrypt ignores the rest).
- **Policy** (features/auth/passwordPolicy.js):
  - students 8+ characters, staff 12+;
  - a blocklist of common and local passwords;
  - the password must not contain the email name, roll number or username (4+ characters).
- **One-time passwords** (features/auth/tempPassword.js):
  - 12 characters from a 54-character unambiguous alphabet (≈69 bits);
  - the server keeps only the hash; valid for 72 hours, and only for setting a new password.

## The audit trail

`audit_events` (models/AuditEvent.js) keeps entries for about 13 months (TTL index). Each entry holds:
- time, action and outcome;
- the actor: type, id and staff role;
- the target: type and id;
- details: counts, flags and enum values only;
- the visitor address and the request id.

It never stores emails, names, passwords, tokens or free text. Each event is also logged as an `[Audit]` line. A failed write is logged and never fails the request.

## Configuration (src/config/env.js, read once at start)

| Variable | Required | Notes |
|---|---|---|
| MONGODB_URI | yes | |
| CLIENT_URL | yes | The website's origin; https in production. CORS and CSRF compare against it |
| NODE_ENV | | `production` turns on Secure / `__Host-` cookies |
| PORT | | Default 5000 |
| PROXY_SECRET | recommended | The same value as in Vercel; without it rate limits see Vercel's address. A warning at start when shorter than 32 characters |
| CRON_SECRET | | Enables /api/cron/trigger; warned when shorter than 32 characters |
| ADMIN_USERNAME, ADMIN_PASSWORD | first start | Create the super admin when there is no staff account |

`scripts/resetAdmin.js` is the break-glass tool. It makes one account an active super admin with a password typed (hidden) at the terminal, and ends that account's sessions.
