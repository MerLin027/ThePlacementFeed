# Implementation Plan — Student Accounts, In-App Applications & Admin Management

> **Status: FINAL DRAFT (v3) — awaiting go-ahead. No application code has been written.**
> v3 = v2 plus your latest requests: **email verification removed entirely**, a mellow "one account per email/roll number" warning, and an **admin Students page** (list, reset password to `college123`, delete account). All paths were checked against the repo on 2026-10-22.
> **Process rules:** one git commit at the end of each phase; update `HISTORY.md` each phase (`.agents/AGENTS.md` rule); update the Obsidian vault notes after the last phase.

---

## 0. What changed

### v3 (this revision)
| Request | How the plan changes |
|---|---|
| Skip email verification, maybe forever | **Removed everywhere**: no `isEmailVerified`, no verification/reset tokens, no Resend, no email service, no email env vars, no "verify before apply" rule. Email is just a unique login identifier. The old Phase 5 is deleted. Nothing in the design needs email later, so there is nothing to "plan around" except what is listed in §12. |
| No email means no self-service reset | "Forgot password" is handled by the admin (below). The login page says: *"Forgot your password? Ask the CDPC admin to reset it."* |
| Warn students that email + roll number are one-time | Signup and Profile show a calm, non-error notice (§8.2). The server enforces it (unique indexes, fields immutable). |
| Admin page: all students, reset password, delete | New **Phase 4 — Admin Students** (§6.4, §9). Reset sets `college123`; delete removes the account. |
| Default password `college123` | Allowed, but it's a publicly known string, so it is only ever a **temporary** password: forced change on first login and an expiry (§5.2). |

### Kept from v2
CSRF exact-origin fix (current `startsWith` check lets `https://app.vercel.app.evil.com` through), `Cancelled` step removed, `customAnswers` + admin controls for `applicationMode`/`customPrompts`, canonical branch list, `/my/summary` endpoint, server-only `missingFields`, separate `routes/applicants.js`, role claim checked in both middlewares, URL-prefix-based 401 handling, drive delete cascade.

---

## 1. Decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | Per-drive `applicationMode: 'external' \| 'in_app' \| 'both'`, default `'external'` | Existing drives unchanged. |
| D2 | Pipeline `Applied → Shortlisted → Interviewing → Offered → Rejected` + `adminNote` | Simple, matches campus workflow. |
| D3 | **No email verification, no email sending, ever (for now).** Email is a login ID only | Your call. Consequence: email is unverified, so it is never used for anything trusted. |
| D4 | Signup open to any email domain; `email` unique; `(institute, rollNumber)` unique | Admin sees and can remove any account. |
| D5 | `email`, `rollNumber`, `institute` immutable after signup; academic fields editable; applications snapshot the profile | Historical records stay accurate. |
| D6 | **Admin deletes an account = hard delete of the `Student`, with that student's applications kept but PII-scrubbed** (§6.4) | Frees the email/roll number so a student who made a typo can sign up again; keeps placement records. |
| D7 | Deleting a drive cascades to its applications; confirm dialog shows the count | No orphans. |
| D8 | Excel export only, max 5000 rows, streaming | CSV is the injection-prone format. |
| D9 | **Admin reset always sets the default password** (`DEFAULT_STUDENT_PASSWORD`, default value `college123`); the admin cannot choose a custom one | Matches your spec; no passwords pass through the admin UI. |
| D10 | **Students cannot delete their own account** (admin-only) | Not requested; keeps scope tight. Easy to add later. |
| D11 | **Branches are shown by full name everywhere** (e.g. "Information Technology"), but stored as the existing short codes (`IT`) | Requested during Phase 4. Live drives already store codes in `eligibility.branches`, so display-only names avoid a data migration and keep matching intact. Single map: `client/src/constants/branches.js`. |

**Needs your confirmation (one question):** D6 means that after the admin deletes an account, that email/roll number *can* be used to sign up again. That reads as the sensible recovery path to me, and it doesn't contradict "can't reuse" for live accounts, but say so if you want deleted identities permanently blocked instead.

---

## 2. Skills applied

| Skill | Used for |
|---|---|
| `secure-coding-practices` | Every phase; checklist in §10. Especially: generic auth failures (3.6), bcrypt (3.8), temp-password rules (3.23–3.24: expire quickly, force change on first use), re-auth for sensitive actions (3.33), audit logging of admin actions (7.21), centralized authz + deny by default (5.x), CSRF (4.16), cookie flags (4.18–19), no PII in logs/errors (7.13). |
| `ui-ux-pro-max` | Forms (visible labels, inline errors, helper text), 44×44px targets, loading/disabled async buttons, destructive-action confirmation, keyboard order, mobile-first, contrast ≥ 4.5:1. |
| `design-taste-frontend` | Restraint only (trust-first, calm, no decorative motion). Reuse existing Material Design 3 tokens and classes (`btn-primary`, `btn-secondary`, `input-field`, `card`). The skill itself says it is not for dashboards/tables, so it is not used for layout. |

---

## 3. Impact map (verified)

| Area | File | Change |
|---|---|---|
| Server entry | `server/index.js` | Mount `/api/students/auth`, `/api/students`, `/api/applications`, `/api/admin/students`. Applicants router mounts from `placements.js`. |
| Admin auth | `server/middleware/auth.js` → renamed `requireAdmin.js` | Read `admin_token`; verify `role === 'admin'` |
| Admin routes | `server/routes/auth.js` | `token` → `admin_token` (set and clear); JWT gains `role:'admin'` |
| CSRF | `server/middleware/csrfCheck.js` | Exact-origin comparison |
| Errors | `server/middleware/errorHandler.js` | Duplicate key `400` → `409` |
| Validation | `server/middleware/validate.js` | Student/application/applicant/admin-student rule sets; `applicationMode`, `customPrompts` on placements |
| Models | `server/models/Placement.js` | `applicationMode`, `customPrompts` |
| New server | `models/Student.js`, `models/Application.js`, `middleware/requireStudent.js`, `routes/studentAuth.js`, `routes/students.js`, `routes/applications.js`, `routes/applicants.js`, `routes/adminStudents.js`, `constants/branches.js` | — |
| Client | `api/axios.js`, `context/AuthContext.jsx`, `components/ProtectedRoute.jsx`, `Navbar.jsx`, `PlacementCard.jsx`, `PlacementDetail.jsx`, `PlacementForm.jsx`, `AdminDashboard.jsx`, `App.jsx` | Modified |
| Dependencies | server: `exceljs` (Phase 5) only. Client: none. No email library. | — |
| Untouched | `Admin.js`, `seed.js`, `statusCron.js`, `resetAdmin.js` | — |

---

## 4. Data model

### 4.1 `Student`
```
email            String  required, unique, lowercase, trim, max 254
rollNumber       String  required, trim, stored UPPERCASE, max 20
institute        String  required, enum ['CHARUSAT'], default 'CHARUSAT'
passwordHash     String  required, select:false
firstName, lastName  String  trim, max 100
branch           String  enum BRANCHES
cgpa             Number  0–10
activeBacklogs   Number  int ≥ 0, default 0
historyBacklogs  Number  int ≥ 0, default 0
graduationYear   Number  int 2020–2040
phone            String  /^\+?[0-9]{10,15}$/
resumeUrl        String  https only, max 500
mustChangePassword  Boolean default false      (true after an admin reset)
tempPasswordExpiresAt  Date                    (set on admin reset; cleared on change)
tokenVersion     Number  default 0
timestamps: true
```
Indexes: `{ email:1 } unique`, `{ institute:1, rollNumber:1 } unique`, `{ createdAt:-1 }`.
`toJSON` strips `passwordHash`, `tokenVersion`, `__v`.
`getMissingFields()` → subset of `['firstName','lastName','branch','cgpa','graduationYear','phone','resumeUrl']`.

### 4.2 `Application`
```
driveId, studentId (ObjectId refs, required)
snapshot  { firstName,lastName,email,rollNumber,institute,branch,cgpa,
            activeBacklogs,historyBacklogs,graduationYear,phone }
resumeUrl (https, max 500), coverNote (max 2000)
customAnswers [{ question(max 500, snapshotted), answer(max 2000) }]
consentGiven  Boolean, must be true
status  Applied|Shortlisted|Interviewing|Offered|Rejected (default Applied)
adminNote max 1000;  timestamps: true
```
Indexes: `{driveId,studentId} unique`, `{driveId,status,createdAt:-1}`, `{studentId,createdAt:-1}`. Duplicate → `409 ALREADY_APPLIED`.

### 4.3 `Placement` additions
`applicationMode` (enum, default `'external'`), `customPrompts` (max 5: `{question, required}`).

---

## 5. Auth & sessions

### 5.1 Basics
- Cookies: `admin_token` (3 h) and `student_token` (7 d). Flags: `httpOnly`, `secure` in prod, `sameSite: None` prod / `Lax` dev, `path:'/'`; clear with identical options.
- JWT `{ sub, role, tokenVersion? }`, `HS256` pinned in `verify`. Each middleware checks `role`; tokens aren't interchangeable.
- `requireStudent`: verify JWT → load student → reject if missing or `tokenVersion` mismatch (`401`); fails closed.
- Passwords: 8–72 chars, bcrypt cost 12, no composition rules. Unknown-email login does a dummy compare (same as admin) → identical `401 Invalid credentials`.
- Authenticated **change password** (`POST /api/students/me/password`, needs current password) is the only way a student changes it. It bumps `tokenVersion` and reissues the cookie.

### 5.2 Admin reset flow with the default password `college123`
A known, predictable password is only acceptable if it is short-lived and useless for anything but setting a real one:

1. Admin clicks **Reset password** → server sets `passwordHash = bcrypt(DEFAULT_STUDENT_PASSWORD)`, `mustChangePassword = true`, `tempPasswordExpiresAt = now + 72h`, `tokenVersion++` (kicks out any current session).
2. `DEFAULT_STUDENT_PASSWORD` is an optional env var; if unset it is `college123`. It must pass the same length policy.
3. On login with a password while `tempPasswordExpiresAt` has passed → `401 Invalid credentials` (admin must reset again). No separate message, so it isn't distinguishable.
4. While `mustChangePassword` is true, the session is **restricted server-side**: `requireStudent` returns `403 PASSWORD_CHANGE_REQUIRED` for every route except `GET /students/auth/check`, `GET /students/me`, `POST /students/me/password`, `POST /students/auth/logout`. This is enforced in the middleware (deny by default; those four routes opt in), not just by the UI.
5. The new password must differ from the default (`400`). On success: `mustChangePassword=false`, expiry cleared, `tokenVersion++`, fresh cookie.
6. Client: login response/`check` include `mustChangePassword`; the app routes to `/change-password` and the axios interceptor redirects there on `PASSWORD_CHANGE_REQUIRED`.
7. The admin is told in the UI to hand the temporary password to the student in person/by trusted channel. The password is never returned by the API (the UI just displays the configured default from the success message text it already knows: "Password reset to the default. Ask the student to log in and change it within 72 hours." — it doesn't echo the value).

Residual risk (documented, accepted): between a reset and the student's first login, anyone who knows the student's email and the default could log in; the 72 h expiry, the restricted session, and the login rate limit bound this.

### 5.3 Frontend 401/403 handling
Interceptor chooses the redirect by request URL prefix (`/api/students/*`, `/api/applications/*` → student login; else admin login), ignores login/check URLs of both roles, and redirects to `/change-password` on `PASSWORD_CHANGE_REQUIRED`.

---

## 6. API

Common: JSON only; mutating routes are `limiter → csrfCheck → auth → validate → handler`; handlers use field allowlists (never spread `req.body`); `isMongoId` on ids; errors via `next(err)`.

### 6.1 Student auth `/api/students/auth`
| Method | Path | Auth | Limit | Notes |
|---|---|---|---|---|
| POST | `/signup` | — | 30/15 min/IP | `{email, rollNumber, institute, password}` → `201` + logs the student in; `409` "An account with these details already exists…" |
| POST | `/login` | — | 5 failed/15 min per (IP, email) + 100/15 min/IP | sets `student_token`; returns `{mustChangePassword}` |
| POST | `/logout` | none (only clears the cookie) | 300/15 min | |
| GET | `/check` | student* | 300/15 min | `{authenticated, student:{id,email,firstName,missingFields,mustChangePassword}}` |

> **Rate-limit note (implemented in Phase 1):** students on campus Wi-Fi share one public IP, so pure per-IP limits like the admin's 5/15 min would lock out a whole lab. Brute force is throttled per (IP, email) on failed attempts only, with looser per-IP caps. The default password is also rejected as a chosen password at signup.

### 6.2 Student profile `/api/students`
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | DTO + `missingFields` (*allowed while restricted) |
| PATCH | `/me` | allowlist: `firstName,lastName,branch,cgpa,activeBacklogs,historyBacklogs,graduationYear,phone,resumeUrl` |
| POST | `/me/password` | `{currentPassword,newPassword}` (*allowed while restricted); 5/15 min |

### 6.3 Applications `/api/applications` (student)
`POST /` (10/15 min per student), `GET /my` (paginated, own only), `GET /my/summary` → `[{driveId,status}]`.

### 6.4 Admin students `/api/admin/students` (requireAdmin)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | `?page&limit(≤100, default 25)&search&branch&sort`; search matches email, rollNumber, first/last name (regex-escaped). Returns a minimal DTO: `id, email, rollNumber, institute, firstName, lastName, branch, graduationYear, createdAt, mustChangePassword`. No phone/CGPA/resume here. |
| POST | `/:id/reset-password` | Sets default password per §5.2. `{ success, message }` only. 30/15 min. |
| DELETE | `/:id` | Scrubs then deletes (below). 30/15 min. |

**Delete, in this order (each step idempotent so a retry after a crash finishes the job):**
1. `Application.updateMany({ studentId }, { $set: snapshot scrub })`: `firstName:'Deleted'`, `lastName:'User'`, `email:''`, `phone:''`, `rollNumber:''`; keep `branch/cgpa/backlogs/graduationYear` (needed for the drive's records); also blank `resumeUrl` and `coverNote`.
2. `Student.deleteOne({ _id })`. The unique indexes free the email and roll number immediately.
3. Admin actions (reset, delete) are logged server-side with the admin id, target student id and action. No email, no password.

If the id does not exist: `404`. If it exists but is invalid: `400`.

### 6.5 Applicants `/api/placements/:driveId/applicants` (admin)
`GET /` (list + `stats`; `?page&limit≤100&status&branch&cgpaMin&cgpaMax&search&sort`), `GET /export` (xlsx stream, 5/15 min), `PATCH /bulk-status` (`{applicationIds[≤100], status}` scoped to `driveId`; registered **before** `/:appId`), `PATCH /:appId` (`{status?, adminNote?}`, verifies drive ownership).

---

## 7. Application rules engine (`POST /api/applications`)

Fixed order, failures return `{success:false, code, message}`:
1. Validate body; allowlist fields; `consentGiven === true`.
2. Drive exists → `404`.
3. `Completed` → `DRIVE_COMPLETED`; `isPostponed` → `DRIVE_POSTPONED`; `deadline < now` → `DEADLINE_PASSED` (all `400`).
4. `applicationMode === 'external'` → `400 EXTERNAL_ONLY`.
5. `missingFields` non-empty → `422 INCOMPLETE_PROFILE` + `missing`.
6. Eligibility: branch (only if drive lists branches), `cgpa >= drive.cgpa`, `activeBacklogs <= drive.backlog` → `400 INELIGIBLE_*`.
7. Required `customPrompts` answered; answers matched to the drive's own prompts server-side.
8. Create with server-built `snapshot`; `status`/`studentId` never from the body. `11000` → `409 ALREADY_APPLIED`.

(No email-verification step.) User text is stored as plain text and rendered by React (auto-escaped).

> **Implemented in Phase 3:** rules live in `server/services/applicationRules.js` (pure function, mirrored for button state in `client/src/utils/applyState.js`). Deadlines are whole IST days — a drive with deadline "25 Oct" accepts applications through 25 Oct, the same convention the status cron uses (`server/utils/dates.js`, shared with the cron). A drive's in-app form opens only on the detail page (`?apply=1`); cards are links, so their buttons route there. `GET /api/placements/:id/application-count` (admin) powers the delete warning.

---

## 8. Frontend

**Style:** existing MD3 tokens/classes only; static Tailwind class strings; ≥ 44px targets; visible labels; inline errors; loading + disabled on every submit; `aria-live` for status messages; focus rings kept; modals via existing `Modal.jsx`; destructive actions use the existing `ConfirmDialog`.

### 8.1 Pages & components
New pages: `StudentLogin`, `StudentSignup`, `StudentProfile`, `ChangePassword`, `AdminStudents`, `AdminApplicants`. New components: `ApplyButton`, `ApplyModal`, `ProfileCompletionBanner`, `StudentsTable`, `ApplicantTable`, `ApplicantFilters`.
`AuthContext` → `{ role, user, loading, loginAdmin, loginStudent, logout, refresh }`, probing both check endpoints on mount. `ProtectedRoute` → `RequireRole` (also bounces a restricted student to `/change-password`). `returnTo` is honoured only if it starts with a single `/`.
Navbar: logged out `Login · Sign up`; student `Profile · Logout`; admin `Dashboard · Students · Logout`. The public admin link is removed (`/admin/login` stays reachable by URL).

### 8.2 The "one-time identity" notice (mellow wording)
Shown as a calm info panel (info icon, neutral surface colour, normal text colour, **not** red/warning) on **Signup**, directly above the email/roll number fields, plus helper text under each field, and again as read-only helper text on **Profile**:

> **A quick heads-up** 🙂 Your email and roll number are used only once and can't be changed later, and each can belong to just one account. Please double-check them before you sign up. If you ever make a mistake, the CDPC admin can help you out.

- Helper under email: *"This becomes your login. It can't be changed later."*
- Helper under roll number: *"Please enter it exactly as on your ID card. One account per roll number."*
- On `409`, the form message stays gentle: *"An account with these details already exists. If this is you, try logging in — or ask the CDPC admin for help."*
- Login page: *"Forgot your password? Please ask the CDPC admin to reset it."*

### 8.3 `ApplyButton` states (UX only; server is authoritative)
1. External-only drive with `formUrl` → existing link (Completed still hidden).
2. Logged out → "Log in to apply" → `/login?returnTo=…`.
3. Missing profile fields → "Complete profile to apply" → `/profile?returnTo=…` with a banner from `missingFields`.
4. Eligible → "Apply Now" → `ApplyModal` (prefilled summary, resume URL, optional note, custom prompts, consent checkbox).
5. Terminal, disabled with visible reason text (not tooltip-only): Applied (+ status), Not eligible (branch/CGPA/backlogs), Postponed, Deadline passed.

### 8.4 `AdminStudents` page (`/admin/students`)
Server-side paginated table (name, roll number, email, branch, grad year, joined), search box + branch filter, "Password reset pending" badge when `mustChangePassword`. Row actions (icon buttons with text labels/`aria-label`, 44px targets): **Reset password** and **Delete**. Both open `ConfirmDialog`:
- Reset: *"Reset <name>'s password to the default? They'll be asked to choose a new one when they next log in, within 72 hours."*
- Delete: *"Delete <name>'s account? Their applications are kept for your records but their personal details are removed. They can sign up again afterwards. This can't be undone."* with a red destructive button; focus defaults to Cancel.
Success/failure via `react-hot-toast`; table refreshes from the server response.

---

## 9. Phases (one commit each)

Every phase ends with: lint/build, the phase's verification (real HTTP/browser checks against a throwaway local MongoDB, test data cleaned up), the §10 checklist over the diff, a `HISTORY.md` entry, then commit.

### Phase 1 — Auth foundation (backend)
**Scope:** `constants/branches.js`; CSRF exact-origin fix; duplicate → `409`; `auth.js` → `requireAdmin.js` + `admin_token` + role claim; `Student` model; `requireStudent` (with the restricted-session mechanism); `studentAuth.js` (signup, login, logout, check) + limiters; validators; mount in `index.js`.
**Verify:** admin login/logout/check work with the new cookie; the old `token` cookie no longer works; CSRF rejects `https://<host>.evil.com` and accepts the real origin; signup `201`, duplicate email and duplicate roll number both `409`; wrong password and unknown email give identical `401`; 6th login → `429`; student cookie rejected by admin routes and vice versa; no `passwordHash`/`tokenVersion` in any response; restricted-session logic unit-checked by flipping `mustChangePassword` directly in the DB.
**Deploy note:** admin cookie rename forces one admin re-login.

### Phase 2 — Frontend auth, profile & password change
**Scope:** `AuthContext`, `axios.js`, `RequireRole`, Navbar, `StudentLogin/Signup/Profile/ChangePassword`, `/students/me` GET/PATCH and `POST /me/password`, mellow notice (§8.2), `returnTo`, `ProfileCompletionBanner`.
**Verify (browser):** nav for all three roles; student at `/admin/dashboard` → `/admin/login` (sessions are independent, so a student is simply "not an admin"); `/profile` logged-out → login → back; `returnTo=//evil.com` ignored; PATCH with `email`/`rollNumber`/`passwordHash` has no effect; password change works, old cookie dies, new password ≠ default enforced; admin and student sessions coexist; 375px mobile has no horizontal scroll; notice text renders on signup and profile.

### Phase 3 — In-app applications
**Scope:** `Placement` fields + validators + `PlacementForm` controls; `Application` model; `applications.js`; rules engine; `ApplyButton`, `ApplyModal`; wire into `PlacementCard`/`PlacementDetail`; drive-delete cascade with count in the confirm dialog.
**Verify:** every rules-engine branch returns its code; body can't set `status`/`studentId`/`snapshot`; profile edits don't change existing snapshots; student A can't read student B's applications; existing external drives behave exactly as before; all `ApplyButton` states render.

### Phase 4 — Admin Students management
**Scope:** `adminStudents.js` (list, reset-password, delete), validators, limiters, admin action logging; `AdminStudents` page + route + Navbar link; wire the full forced-change flow end to end.
**Verify:** student cookie gets `401`/`403` on every `/api/admin/*` route; list is paginated/searchable/capped at 100 and returns only the minimal DTO; reset → student logs in with `college123`, is confined to the four allowed routes (everything else `403 PASSWORD_CHANGE_REQUIRED`), must change password, and the old session is dead; an expired temp password (expiry set to the past in the DB) is refused with the generic `401`; reset never returns a password in any response; delete scrubs applications' PII, removes the student, and the same email/roll number can sign up again; deleting twice → `404`; logs contain no passwords/emails.

### Phase 5 — Admin applicant management & export
**Scope:** `applicants.js` (list/stats/update/bulk/export), `exceljs`, `AdminApplicants` + table/filters, "View Applicants" in `AdminDashboard`; applicant UI tolerates scrubbed/deleted students.
**Verify:** student cookie `401` on all applicant routes; cross-drive `appId` refused; bulk update only affects the given drive; filters/sort/regex-escaped search; page size ≤ 100; xlsx opens with correct columns; a seeded name `=HYPERLINK("http://x","y")` isn't a live formula; export capped at 5000; no PII in logs.

### Phase 6 — Wrap-up
README + `.env.example` (document optional `DEFAULT_STUDENT_PASSWORD`), vault notes (project note, System Overview, Decisions/Gotchas for cookie split, CSRF fix, default-password policy) with fresh verification dates, `npm audit` on both packages, regression pass of existing public/admin flows. Commit.

---

## 10. Security checklist (re-run before each commit)

- [ ] Server-side validation (type, length, range, allowlist); ids `isMongoId`; query params cast to primitives
- [ ] No mass assignment; responses built from DTOs
- [ ] Authz from verified token + DB only; every new route has explicit auth; deny by default
- [ ] Mutations behind `csrfCheck`; cookie flags correct; secrets only in env
- [ ] Generic auth errors, uniform timing; rate limits on every auth/mutating/expensive route
- [ ] Default password: never returned by the API, forced change enforced in middleware, expires, can't be reused as the new password
- [ ] Admin reset/delete logged (actor, target id, action) with no PII or secrets
- [ ] Errors: no stack traces/PII to the client
- [ ] Free text rendered as text; URLs `https` only with `rel="noopener noreferrer"`
- [ ] Export: typed cells, dangerous prefixes neutralized, fixed filename
- [ ] New dependency (`exceljs`) reviewed; `npm audit` clean

---

## 11. Rollout & compatibility

- Existing drives: `applicationMode` defaults to `'external'`; no migration.
- Existing admin sessions end once (cookie rename).
- Env additions: none required. Optional `DEFAULT_STUDENT_PASSWORD` (defaults to `college123`). `requiredEnvVars` unchanged. No email provider, nothing external to set up.
- Render cold starts apply to new endpoints; forms reuse existing loading patterns.
- Phases are independent commits; only Phase 1 forces a re-login.

---

## 12. Consequences of having no email, and later options

- Password recovery is admin-only; admins are the support channel. If volume grows, the cheapest upgrade is email-based reset later (add a token model + provider; no schema changes needed now).
- Emails are unverified, so a student could type someone else's email. This is harmless today because email is never used to send anything or to prove identity; the admin can delete bogus accounts.
- Signup `409` reveals that an email/roll number is registered (residual enumeration risk, rate-limited, accepted).
- Later ideas: Google OAuth (would give verified email for free), student self-delete, status-change notifications, applicant analytics, eligibility-aware home filter, bookmarks, Argon2id, CSV bulk student import.
