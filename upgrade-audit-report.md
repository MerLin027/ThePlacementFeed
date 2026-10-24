# Upgrade Audit Report

**Plan:** `upgrade-audit-plan.md` · **Subject:** branch `upgrade/deps` vs `main` (17 upgrade commits + audit-plan commit)
**Started:** 2026-10-24 · **Runtime used:** Node 24.22.1 (target) and 22.23.4 (fallback), local MongoDB 8.0 on port 27099
**Status:** COMPLETE (2026-10-24) — Pass 1, Pass 2 and Pass 3 done · fix plan approved (M-1 option 1) · fixes in progress, see Fix log

Severity: **C** Critical · **H** High · **M** Medium · **L** Low · **I** Info.
Evidence files live in the session scratchpad `audit/` folder (command output, logs).

---

## Verdict

**The upgrade is sound.** No Critical or High findings. For users on current browsers the API contract, stored
data, security posture, performance and visuals are unchanged or better, and a rollback to `main` is safe
(data and password hashes stay compatible). Two Medium findings: **browser support** (M-1, caused by
Tailwind 4) and **regression tests not in the repository** (M-2, pre-existing practice). Eight Lows (a ninth, L-1, was withdrawn as a false positive during the fixes) — one
caused by Express 5 (L-7), one documentation error from the upgrade (L-2), the rest pre-existing or parity
with `main`. 15 Info notes, including two positive side-effects (pre-existing 500s fixed, skeleton
pulse now works).

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | M-1 (upgrade), M-2 (pre-existing) |
| Low | 9 | L-2, L-7 (upgrade) · L-5 (parity) · L-3, L-4, L-6, L-8, L-10 (pre-existing) · L-9 (test tooling) — L-1 withdrawn; L-10 found during the fixes |
| Info | 15 | I-1 … I-15 |

---

## Pass 1 — Normal audit

| # | Check | Result | Evidence |
|---|---|---|---|
| A1 | Versions | **Pass.** All 32 direct dependencies (16 client, 16 server) are on their npm `latest` dist-tag; no pre-release versions. Node 24.22.1 is the current 24.x LTS (security release 2026-10-20). | `A1-A2.txt` |
| A2 | Lockfile integrity | **Pass.** lockfileVersion 3; client 248 / server 325 entries; every `resolved` URL is `https://registry.npmjs.org/`, every entry has a `sha512` integrity hash; no git/file/tarball sources. `npm ls --all` clean in both. Root `dependencies`/`devDependencies`/`engines` match `package.json`. (`overrides` is never written to the lockfile root by npm; the `uuid ^11.1.1` override is in effect — `exceljs` resolves `uuid@11.1.1`.) | `A1-A2.txt`, `npmls-*.err` |
| A3 | Vulnerabilities | **Pass.** `npm audit` 0 (all severities) in both packages. Independent OSV.dev batch query of all **523** unique installed package@version pairs: **0** known vulnerabilities. | `A3.txt` |
| A4 | Deprecations | **Pass with notes.** Runtime: no Node `DeprecationWarning`/`ExperimentalWarning` and no library warnings (Mongoose, Vite) across 24 API logs, the Vite log and all runner logs, on both Node versions (`--trace-deprecation`). Browser console: only the app's expected 401 session-check responses. Install time: npm 11 deprecation notices for `inflight`, `lodash.isequal`, `rimraf@2`, `fstream`, `glob@7` — all transitive under `exceljs@4.4.0` (→ I-2). | `A6-node*.txt` |
| A5 | Build & lint | **Pass.** Build OK on both Node versions; the 14 output files are **byte-identical** on Node 22.23.4 and 24.22.1 (JS 239.7 kB gzip, CSS 10.8 kB gzip). Lint exit 0, 0 errors, 18 warnings (→ I-3). | `dist-*.txt`, `lint-*.txt` |
| A6 | Regression | **Pass.** 24 suites from clean test data: **767/767 on Node 24.22.1** and **767/767 on Node 22.23.4**, 0 crashed suites. | `A6-node24.txt`, `A6-node22.txt` |
| A7 | Commit hygiene | **Pass.** 18 commits: messages match their content, each has the attribution trailer, no stray files (no `dist/`, logs, `.env`, OS junk) and no unexpectedly large non-lockfile files. | `A7.txt` |
| A8 | Secrets & config | **Pass with one Low.** No secret patterns (URIs with credentials, keys, tokens, JWTs, private keys) in added lines. `.env` (client/server), `client/dist`, `HISTORY.md`, `node_modules` are ignored; no `.env` tracked. All 10 server env vars are documented in the README; the root `.env.example` lacks `DEFAULT_STUDENT_PASSWORD` (→ L-1, pre-existing). | `A8.txt` |
| A9 | Licences | **Pass with notes.** Client: MIT 218, MPL-2.0 24, ISC 3, Apache/BSD 3. Server: MIT 285, ISC 20, Apache 7, BSD 7, others 6. The MPL-2.0 packages are `lightningcss` builds (dev-only CSS tool, never shipped; → I-4). Server oddities `buffers` (no licence field), `chainsaw` (MIT/X11), `jszip` (MIT OR GPL-3.0 — MIT can be chosen) are under `exceljs` and unchanged from `main` (→ I-5). | `A9.txt` |
| A10 | Docs accuracy | **Pass with one Info.** README stack table matches installed versions (19/19). Claims re-counted: 18 limiters use `limit` (0 `max` left), 11 `max-w-(--container-*)` (0 colliding `max-w-{xs..xl}` left), 15 new lint warnings, 24 suites / 767 checks. All 70 file paths referenced in README, plan and vault notes exist (8 "missing" ones are files described as removed, or vault-relative links). The Tailwind commit touches 35 files in `client/src`, docs say "32 files" (→ I-6). | — |

**Pass 1 verdict:** no Critical, High or Medium findings. The upgrade matches what was claimed.

---

## Pass 2 — Big picture

| # | Area | Result | Evidence |
|---|---|---|---|
| B1 | Deployment chain | **Pass with one Low.** MongoDB driver 6.20 → **7.7.0**, which supports MongoDB server **4.4–9.0** — every current Atlas cluster is in range. Render runs `npm start` (`node index.js`), no build step, nothing depends on Tailwind/PostCSS. Vercel builds `vite build`; per Vercel's docs `engines.node` **overrides the dashboard** and resolves to the highest available major (`>=22.0.0` → 24.x), so our client range builds on 24.x. Consequence: the documented "set Vercel to 22.x" runtime rollback does not work on Vercel, and the "set Vercel to 24.x" step is unnecessary (→ L-2). Render's `NODE_VERSION` override is a valid no-code fallback. Client output is byte-identical on 22/24, so Vercel's Node version has no user-visible effect. | Vercel docs (node-js-versions), driver `constants.js` |
| B2 | API contract | **Pass.** The same 56-request sequence (every endpoint, guest/student/admin, error paths) against `main` (Express 4/Mongoose 8, Node 22) and the branch (Node 24): **53/56 identical** in status, JSON shape, messages, cookie attributes and all security/CORS headers, apart from HSTS (180 → 365 days, Helmet 8 default, on every response). The 3 differences are intended: repeated query key and object username **500 → 400** (pre-existing crashes fixed); bracketed query key → 400 from the sanitiser, which runs before the route's rate limiter (→ I-7). | `B2-diff.txt`, `contract-*.json` |
| B3 | Data compatibility | **Pass.** Identical writes through both servers store documents with the **same fields and BSON types** (placements, applications, students). The branch reads/updates/exports/logs in against data written by `main`; **rollback-safe**: `main` reads branch data, verifies bcryptjs-3 `$2b$` hashes (incl. a password changed on the branch) and honours a branch-set forced reset. Indexes: identical keys, names and uniqueness; only Mongoose 8's `background: true` flag is gone (ignored by MongoDB ≥ 4.2). Mongoose 9 starting on Mongoose-8-built indexes (and back): no errors, nothing to drop or create (→ I-9). | `B3.txt`, `B3-indexes.txt` |
| B4 | Security posture | **Pass — equal or stronger.** Headers/CORS/CSRF/cookies/error bodies unchanged (B2); HSTS stronger. NoSQL-injection battery (25 payloads: login bypass with `$ne/$gt/$regex/$where`, query widening, body `$set`/`tokenVersion`/`__proto__`/dotted keys/immutable email, admin params, bulk ids): **no effect on the branch**; stored data unchanged; 5 payloads that crashed `main` (500) now get 400. XSS: the same hostile markdown (31 vectors) renders to **byte-identical** HTML with react-markdown 9.1 (`main`) and 10.1 — no script/iframe/object/embed/base/meta/form/style, event handlers, `javascript:` or `data:` URLs; raw `<input>` reduced to disabled checkboxes; one `<link rel=preload as=image>` is React 19's server-render image hint (not emitted in browser rendering). | `B4-injection.txt`, `xss-*.html` |
| B5 | Performance | **Pass with notes.** API: boot to health 1.27–1.29 s vs 1.5–1.6 s; 300 reads 833–881 ms vs 911–954 ms; memory after reads ≈ 85 MB vs 60–80 MB; 5000-row export same size and speed, peak 114–128 MB vs 94–96 MB (→ I-10). Client: JS +6.6 kB, CSS +2.2 kB brotli (→ I-12). Slow 4G (3 runs, median): first paint 4.68–4.72 s vs 4.45–4.48 s (+0.23 s); the icon stylesheet is requested at 0.18 s on both (preload works; no extra waterfall from the layered `@import`). Icons become usable only at **≈ 12.5 s on both** — the full Material Symbols variable font is downloaded (→ L-3, pre-existing). | `B5-server.txt`, `B5-front.txt` |
| B6 | Browser support | **Medium finding.** Rendered both builds in real older engines (Playwright-bundled Chromium 98 and 110) and current Chromium 153. **Chromium 98** (no cascade layers): `main` renders correctly, the branch is **completely unstyled** (all Tailwind 4 rules live in `@layer`). **Chromium 110** (layers, no `oklch`/`color-mix`): layout, MD3 colours, cards and buttons correct, but Tailwind's default-palette colours (amber/emerald/red/gray — monogram backgrounds, "Closes in" chips, error tints) and every `/NN` opacity colour, **including the focus rings** (`ring-primary/20`), are missing. Chromium 153: identical to `main`. Feature inventory: `main` CSS used none of `@layer`/`@property`/`oklch`/`color-mix`; the branch uses all four (26 `@supports` fallbacks cover only some cases) (→ M-1). | `b6/*/report.json`, `b6/cmp-home.png` |
| B7 | Dependency health & supply chain | **Pass with notes.** No direct dependency is deprecated or has an archived repository; most released within the last 4 months. Oldest: `rehype-raw`/`rehype-sanitize` (2023-08, stable unified ecosystem) and **`exceljs` (last release 2023-10, last commit 2025-01)**, which carries the five deprecated transitive packages (→ I-11). Install scripts unchanged vs `main` (only macOS-only `fsevents`); the new native tools ship as prebuilt optional per-platform packages without install scripts. | `B7-health.txt` |
| B8 | Operability | **Pass with one pre-existing Low.** Same tz database (2026e) and ICU (78.3) on Node 22/24; node-cron computes the next run as 00:05 IST on both. Production logs identical in format (startup lines, morgan `combined`, no dotenv banner). README setup steps work as written (the client falls back to `http://localhost:5000` = the server default). Every request with a malformed id writes a full stack trace to the server log — unauthenticated log noise (→ L-4, pre-existing). | — |

**Pass 2 verdict:** one Medium (browser support), one new Low (deploy docs) plus two pre-existing Lows, no Critical/High. For users on current browsers, API behaviour, data, security and performance are unchanged or better.

---

## Pass 3 — Small picture

| # | Area | Result | Evidence |
|---|---|---|---|
| S1 | `sanitizeRequest.js` edge cases | **Pass with one Low (parity).** Deeply nested JSON (5k–400k levels, up to 0.8 MB) overflows the recursive `clean()` → caught by Express → **500** in < 0.3 s, server stays healthy; `main`'s `express-mongo-sanitize` overflows identically (→ L-5). Wide arrays (100k objects) and 60k-key bodies: normal 400 in < 0.1 s. Full-width `＄`, `constructor`/`prototype` keys: 400 (harmless). Brackets, dots and `$` inside query **values** work; the client never sends dotted or `$` keys. Unlike the old library the new one does not sanitise headers — no header is used in a query (I-13 note). | `S1.txt` |
| S2 | Type checks on every input | **Pass with two Lows (pre-existing).** 648 fuzz requests per server (8 wrong-type values × every body field of 12 write endpoints + 9 malformed values × every query parameter of 5 list endpoints): `main` 12 × 500, branch **3 × 500** — the branch fixes all 12 of `main`'s. The 3 left: a NUL byte in `search` (`%00`) makes MongoDB reject the regex → 500 on the public drive list, admin students and applicants — **also on `main`** for `search=%00` (→ L-6). Type coercion: student/applicant text fields correctly reject non-strings (400), but the **admin drive form stores numbers/booleans/objects as text** in `company`, `role` (and `jdDescription` for numbers/booleans), e.g. `"[object Object]"` — on both servers (→ L-8). | `S2.txt`, `S2-coercion.txt` |
| S3 | Express 5 sweep | **Pass with one Low (upgrade).** No wildcard/regex routes, no `app.del`, `req.param`, `res.send(status)`, `res.redirect('back')`; `clearCookie` uses dedicated options (cookie attributes identical in B2). 15 routing edge cases (trailing slashes, case, double slashes, encoded dots, HEAD, OPTIONS) identical to `main`. **But:** when the port is already in use, Express 5 passes the error to the `listen` callback, which ignores it — the server logs "Server running … on port N", keeps running its cron job and serves nothing; `main` exits with `EADDRINUSE` (→ L-7). | `S3` (console) |
| S4 | Mongoose 9 sweep | **Pass.** 60+ query calls reviewed: every `find`/`countDocuments` filter starts as an object (no `find(null)`), no update pipelines, `populate` with fixed field lists, only one hook (rewritten), `findOneAndUpdate` uses `returnDocument`, default `mongoose.connect` options. | — |
| S5 | Rate limiting | **Pass.** All 18 limiters compared with `main`: identical windows, limits, messages, `skipSuccessfulRequests` and header settings (`standardHeaders: true` = same `RateLimit-*` headers, confirmed in B2); the only change is the intended `ipKeyGenerator` in the per-account login key. | — |
| S6 | Helmet / bcrypt / dotenv / JWT | **Pass.** Headers per B2. bcrypt cost 12 everywhere; hash+compare 641 ms (bcryptjs 3) vs 658 ms (2.4) — login latency unchanged; hashes cross-verify (B3). JWT verify pins `algorithms` in both middlewares. dotenv: `resetAdmin` loads `server/.env` by absolute path; `index.js` still reads `.env` from the working directory, which is `server/` for `npm start` and on Render (→ I-13). | — |
| S7 | Tailwind class diff | **Pass.** 899 class tokens in the source checked against both compiled stylesheets: **0** classes that `main` generated and the branch silently drops, **0** new spellings that fail to compile (detector validated with known and invented tokens). 29 renamed pairs (`rounded-sm`→`rounded-xs`, `!x`→`x!`, `outline-none`→`outline-hidden`, `w-[22rem]`→`w-88`, the 11 `max-w-(--container-*)`, …) compute to the same visible styles. | `S7-dead.txt`, `S7-pairs.txt` |
| S8 | `index.css` | **Pass.** All **118 theme tokens** (colours, radii, spacing, fonts, type scale incl. line-height/letter-spacing/weight, animations, keyframes) identical to `tailwind.config.js`, none missing or extra. All **80** class combinations that mix a component class (`btn-*`, `input-field`, `select-field`, `card`, `skeleton`, `label`) with other utilities compute identically in default/hover/focus/disabled (**307/307**) — Tailwind 4's different ordering did not flip any override. `.markdown-body`: 23/29 identical, 6 cosmetic (0.03 px rounding; `space-y` margin moved from top to bottom with the same gap; same blockquote colours in oklab). Positive: `main`'s build contains an **empty `@keyframes pulse{}`**, so skeleton loaders never pulsed; on the branch they pulse and respect reduced motion (→ I-14). | `S8-tokens.txt`, `S8-combos.txt` |
| S9 | UI states | **Pass.** 11 states pixel-identical (0.000 %) between the `main` and branch production builds: phone menu, notification panel, filters panel, empty search, card hover, keyboard focus on nav, admin login error, delete-confirm dialog, drive-form validation errors, Windows high-contrast (forced colours) login with focus, print of a drive page. Reduced motion: animations and transitions 0.01 ms on both; forced colours: focus outline 3 px solid on both. | `s9/` |
| S10 | Router / markdown / misc | **Pass.** react-router 8 behaviour is covered by the existing suites (14 navigation/redirect assertions, 13 focus/scroll-on-route-change, 7 for 404, 5 forced password change) — all green. Markdown plugin setup unchanged (only class renames in `PlacementDetail.jsx`). `engines`, `vite.config.js`, `resetAdmin.js` verified in Pass 1/Phase 9. | — |
| S11 | Lockfile review | **Pass.** Every added package traces to an expected parent — client +22 (Tailwind 4 engine/Vite plugin incl. 12 per-platform binaries, 2 small react-router deps), server +4 (Express 5 `router`, rate-limit `ip-address`, Mongoose `@standard-schema/spec`, `is-promise`); client −65 (the Tailwind 3/PostCSS toolchain), server −6 (incl. `express-mongo-sanitize`). The `uuid` override is **still needed**: without it `exceljs` would pull `uuid@8.3.2` (GHSA-w5hq-g745-h8pq). | — |
| S12 | The tests themselves | **Medium + Low.** The 24 suites / 767 checks exist **only in the session scratchpad** — nothing is in the repository, so they will be lost and cannot be re-run for future changes (→ M-2, pre-existing practice). The harness drops a suite that hangs until its 400 s timeout from the totals without flagging it (simulated; final runs unaffected — all 24 suites reported) (→ L-9). 9 tautological `ok(true, …)` rely on a preceding `waitForURL` throwing; ~70 fixed waits remain in browser suites (source of the 2 timing flakes seen) (→ I-15). New upgrade suites assert real properties (DOM inspection for XSS, stored documents for injection, parsed xlsx for export). | — |

**Pass 3 verdict:** one Medium (tests not in repo), five Lows (one caused by Express 5), no Critical/High.

---

## Findings

| ID | Sev | Pass | Area | Finding | Suggested action |
|---|---|---|---|---|---|
| M-1 | M | 2 | Browser support | Tailwind 4 makes the site **unusable in browsers without CSS cascade layers** (Chrome < 99, Safari < 15.4, Firefox < 97 — before ~March 2022) and **degraded in Chrome 99–110 / Safari 15.4–16.1**: default-palette colours (status chips, monograms, error tints) and all `/NN` opacity colours incl. **focus rings** disappear. Affected devices include iPhone 6s/7/SE (1st gen), capped at iOS 15. `main` works in all of them. | Decide the support floor. Cheap partial fix for the second group: hex values for the default-palette colours used and hex+alpha (or `@supports` fallbacks) for focus rings/tints. The first group can only be served by staying on Tailwind 3 or by a CSS post-processing step that flattens layers. |
| M-2 | M | 3 | Tests (pre-existing) | The regression suites (24 suites, 767 checks) and the audit tools live only in the session scratchpad — not in the repository. They will be lost, and future changes (or a post-merge check) cannot be re-verified. | Move the suites into the repo (e.g. `tests/`), with a README, a guard that refuses any non-local MongoDB URI, and one `npm run test:all` entry point. |
| L-1 | ~~L~~ | 1 | Config docs | **Withdrawn — false positive.** `.env.example` does document the variable as `# DEFAULT_STUDENT_PASSWORD=college123` (commented out because it is optional); the Pass 1 check only matched uncommented lines. | None. |
| L-2 | L | 2 | Deploy docs | The deploy checklist and Phase 9 N6 say "Vercel → Node.js 24.x" and "Vercel 22.x = no-code runtime rollback". On Vercel, `engines.node` overrides the dashboard (our range builds on 24.x), so the dashboard step is unnecessary and the Vercel rollback does not work as written. Render's `NODE_VERSION` fallback is correct. Harmless in practice (client build is byte-identical on 22/24). | Correct the checklist, N6 and the user guide. |
| L-3 | L | 2 | Performance (pre-existing) | The icon stylesheet requests the complete Material Symbols variable font (`wght,FILL@100..700,0..1`, all icons): on slow 4G icons appear only after ≈ 12.5 s, on `main` and the branch alike. | Request only the icons and axes used (Google Fonts `icon_names=` + fixed weight/fill), or self-host a subset. |
| L-4 | L | 2 | Logging (pre-existing) | Requests with a malformed id (`/api/placements/not-an-id`) log a full stack trace — anyone can generate log volume without authentication. | Log CastError/validation errors as one line without the stack. |
| L-5 | L | 3 | Input handling (parity with `main`) | Deeply nested JSON bodies (≥ ~5k levels, well under the 1 MB limit) overflow the recursive sanitiser → 500 + stack trace in the log; the old library behaved the same. | Iterative sanitising with a depth limit → 400. |
| L-6 | L | 3 | Input handling (pre-existing) | A NUL byte in `search` (`?search=%00`) makes MongoDB reject the regex → unauthenticated 500 on `/api/placements`, admin students and applicants (`main` too; the branch additionally for `%00%ff`). | Reject or strip NUL (and other control characters) in query strings → 400. |
| L-7 | L | 3 | Startup (Express 5) | If the port is taken, Express 5 hands the error to the `app.listen` callback, which ignores it: the server logs "Server running…", keeps the cron job running and serves nothing. `main` exits with `EADDRINUSE`. Unlikely on Render (assigned port), confusing locally. | `app.listen(PORT, (err) => { if (err) { log; process.exit(1); } … })`. |
| L-8 | L | 3 | Validation (pre-existing) | The admin drive form accepts numbers/booleans/objects for `company`, `role` (and numbers/booleans for `jdDescription`) and stores them as text (`"123"`, `"true"`, `"[object Object]"`); `.trim()` coerces before the length check. Admin-only; data quality. | Add `.isString()` before `.trim()` on admin text fields. |
| L-9 | L | 3 | Test tooling | A suite that hangs until its timeout leaves no summary line and silently drops out of the totals. | Count suites with a summary line vs suites run; flag missing ones as failures. |
| L-10 | L | fixes | Accessibility (pre-existing) | Found when the suites moved to axe-core 4.14 (Group D): rule `label-content-name-mismatch` (serious, WCAG 2.5.3 "Label in Name") — the admin postpone toggle shows "Postpone" but was named "Mark <company> as postponed", and the Home Filters button's `aria-label` overrode its visible text. axe 4.10 did not check this rule. Voice-control users saying "click Postpone" could not reach the button. | Build the names from the visible text (+ screen-reader-only extras), no overriding `aria-label`. |
| I-1 | I | 1 | Lockfile | `overrides` (`uuid ^11.1.1`) is not mirrored in the lockfile root — normal npm behaviour; the override is applied. | None. Re-check whether the override is still needed in Pass 3 (S11). |
| I-2 | I | 1 | Dependencies | Five deprecated transitive packages (`inflight`, `lodash.isequal`, `rimraf@2`, `fstream`, `glob@7`) — all under `exceljs@4.4.0` (newest ExcelJS, last release 2023). No advisories (npm audit + OSV). Pre-existing. | Assess in Pass 2 (B7). |
| I-3 | I | 1 | Lint | 18 warnings: 15 new React-Compiler-style rules from oxlint 1.89 (`set-state-in-effect` ×13, `purity`, `refs`) + 3 pre-existing `only-export-components`. Documented as a follow-up. | Review individually in Pass 3. |
| I-4 | I | 1 | Licences / build | `lightningcss` (MPL-2.0) is a dev-only build dependency; two copies installed (1.32.0 via Tailwind, 1.33.0 via Vite). | None. |
| I-5 | I | 1 | Licences | `buffers`, `chainsaw`, `jszip` (dual MIT/GPL) under `exceljs` — unchanged from `main`. | None (MIT applies to `jszip`). |
| I-6 | I | 1 | Docs | Docs say the Tailwind migration touched "32 files"; the commit changes 35 `client/src` files (32 by the upgrade tool + manual `max-w` fixes). | Reword in the final docs update. |
| I-7 | I | 2 | Rate limiting | Bracketed query keys are rejected (400) by the app-level sanitiser before route rate limiters, so these requests are not counted. They do no DB work; malformed JSON behaved the same on `main`. | None, or note in docs. |
| I-8 | I | 2 | Headers | HSTS max-age 180 → 365 days (Helmet 8 default). Stronger; no `preload` directive, so reversible. | None. |
| I-9 | I | 2 | Database | Mongoose 9 no longer sets `background: true` on indexes; existing Mongoose-8 indexes are accepted as-is in both directions (no rebuild). | None. |
| I-10 | I | 2 | Memory | A 5000-row export peaks ≈ 20–30 MB higher (114–128 MB vs 94–96 MB); ≈ 85 MB after reads. Well within Render's 512 MB. | None. |
| I-11 | I | 2 | Dependency health | `exceljs` is dormant (~21 months without a commit) and pulls in deprecated packages; no advisories today. | Track; consider a maintained alternative in a future round. |
| I-12 | I | 2 | Bundle | +9 kB brotli in total; single ~800 kB JS chunk (pre-existing; Vite warns). First paint +0.23 s on slow 4G. | Optional future code-splitting. |
| I-13 | I | 3 | Config | `index.js` loads `.env` from the working directory (fine for `npm start`/Render, both run in `server/`); the new sanitiser does not sanitise headers (none are used in queries). | Optional: absolute `.env` path like `resetAdmin.js`. |
| I-14 | I | 3 | UI (positive) | `main`'s build has an empty `@keyframes pulse{}` — skeleton loaders never pulsed in production; on the branch they pulse and stop under reduced motion. | None. |
| I-15 | I | 3 | Test quality | 9 tautological `ok(true, …)` after `waitForURL`; ~70 fixed waits in browser suites (2 timing flakes seen during the upgrade). | Replace with explicit assertions / polling when the suites move into the repo (M-2). |

---

## Fix plan (for approval — nothing has been changed)

Grouped by priority. Every group ends with the full regression on Node 24 and 22, plus a targeted test for
each fix, and its own commit on `upgrade/deps`.

| Group | Findings | What | Effort |
|---|---|---|---|
| **A — before merging** | M-1 (decision), L-7, L-2 | **M-1:** you choose the browser floor. Option 1 (recommended): accept Tailwind 4's floor (Safari 16.4 / Chrome 111 / Firefox 128 for full fidelity), document it, and add cheap fallbacks so 2022–early-2023 browsers keep status colours and focus rings (hex values for the default-palette colours we use; hex+alpha focus rings). Option 2: also flatten cascade layers in the build so pre-2022 browsers work — more invasive, not recommended. Option 3: return to Tailwind 3 — loses the cleared advisory and the CSS-first setup. **L-7:** handle the `listen` error. **L-2:** correct the Vercel notes in the deploy checklist/N6/user guide. | Small (option 1) |
| **B — hardening (pre-existing, cheap)** | L-5, L-6, L-4, L-8 (L-1 withdrawn) | Depth-limited iterative sanitiser (→ 400); reject NUL/control characters in query strings (→ 400); log client errors (CastError/validation) as one line without stack; `.isString()` on admin text fields; add `DEFAULT_STUDENT_PASSWORD` to `.env.example`. | Small |
| **C — performance (pre-existing)** | L-3 | Request only the Material Symbols icons and axes the app uses (icons ≈ 12.5 s → expected well under 2 s on slow 4G); verify every icon still renders. | Small–medium |
| **D — keep the safety net** | M-2, L-9, I-15 | Move the regression suites into the repository with a local-only DB guard and a single entry point; fix the harness's missing-summary gap; replace `ok(true…)` and the worst fixed waits. | Medium |
| **Tracked, not now** | I-3, I-11, I-12 | oxlint React-Compiler warnings; `exceljs` replacement; code-splitting. | — |

Recommended order: A → B → D → C (C can run in parallel with D). Groups B–D do not block the merge; A does.

---

## Fix log

Approved 2026-10-24 with **M-1 option 1** (accept Tailwind 4's floor, add cheap fallbacks).

### Group A — done
- **M-1:** the 26 default-palette shades the app uses are pinned to their Tailwind 3 hex values in `@theme` (v4's `oklch()` is unreadable before Chrome 111 / Safari 15.4). Opacity colours inside `@utility` (input/select focus rings, markdown link underline, blockquote) use named `rgb()` tokens — v4 emits no fallback there. Root cause of the missing focus rings, found by bisecting in Chromium 110: it rejects `var(--x,)` (empty fallback) when `--x` is a registered `@property`, which Tailwind uses in every ring, filter and transform; `client/vite.config.js` rewrites the 51 occurrences to `var(--x, )` in the built CSS. Result in Chromium 110: **0/49** probed colour/ring classes broken (was 12); Home and login identical to current Chromium. Chromium 98 (pre-2022) remains unsupported by decision. README gains a "Browser support" table.
- **L-7:** the `app.listen` callback now exits with `Failed to start server: …` on errors (verified: EADDRINUSE → exit 1; normal start unchanged).
- **L-2:** deploy checklist, Phase 7/9 notes, N6, user steps and vault corrected — Vercel follows `engines.node`; the runtime rollback is Render-only and Vercel needs none (byte-identical client builds).
- **Verification:** lint 0 errors, build OK; full regression **767/767 on Node 24.22.1 and on 22.23.4**, no warnings; back-to-back visual comparison with `main`: 24/32 views pixel-identical, the other 8 the known anti-aliasing-only differences.

### Group B — done
- **L-5:** the sanitiser now limits nesting to 32 levels and answers deeper bodies with **400** "Request body is too deeply nested" (was a stack overflow → 500 + stack trace, as on `main`). Real payloads nest 3 levels at most.
- **L-6:** query strings with control characters (incl. NUL) are rejected with **400** before any handler runs (was a MongoDB regex error → 500 on three endpoints).
- **L-4:** client errors (CastError, Mongoose ValidationError, duplicate key, 4xx from body parsing) are logged as **one line without a stack**; real server errors keep the full log entry.
- **L-8:** `company`, `role`, `jdDescription` and selection-round name/description reject non-strings (`isString` before `trim`); required/blank fields keep their "is required" message.
- **L-1:** **withdrawn — false positive.** `.env.example` already documents `# DEFAULT_STUDENT_PASSWORD=college123` (commented out because it is optional); the Pass 1 check only matched uncommented lines.
- **Verification:** sanitiser unit checks (real payloads pass; 5,000-level body → 400; operators still stripped; NUL/tab in query → 400; Unicode, brackets, dots, `$` in values pass). Over HTTP vs `main`: deep-nesting cases 400 (main 500); type fuzz 648 requests → **0 server errors** (main 12); server log: client errors one line each, 0 stack traces. Full regression **767/767 on Node 24.22.1 and 22.23.4**.

### Group D — done
- **M-2:** the 24 regression suites (767 checks) now live in `tests/`: `tests/run.mjs` (starts Vite once and a fresh API per suite, from `tests/output/` so `server/.env` is never read; per-suite 400 s timeout; one retry if the API fails to start), `tests/lib/env.cjs` (refuses any non-local MongoDB), `tests/lib/cleanup.cjs`, pinned **Playwright 1.64.1** and **axe-core 4.14.0** (latest stable), Chromium installed into the gitignored `tests/.playwright-browsers`. `tests/README.md`, a README "Tests" section and the vault describe setup and use.
- **L-9:** a suite that crashes, times out or ends without its summary line now counts as a failure (exit code ≠ 0); the runner caught exactly that once (an API start that timed out, now retried).
- **I-15:** the 9 tautological `ok(true, …)` checks are real assertions (a timeout is a counted FAIL, the suite continues). Fixed waits remain (documented).
- **L-10 (new, found here):** axe-core 4.14 checks `label-content-name-mismatch` (WCAG 2.5.3), which 4.10 did not: the postpone toggle ("Postpone", named "Mark … as postponed") and the Home Filters button (`aria-label` overriding its text). Names are now built from the visible text plus screen-reader-only extras ("Postpone Infosys", "Filters, 2 active").
- **Verification:** all 24 suites pass on the final code with the in-repo runner on Node 24 (743 checks in one run, the remaining 24 in a re-run of the suite whose API start had timed out), no deprecation warnings.
