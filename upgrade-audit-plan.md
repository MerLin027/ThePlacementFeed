# Upgrade Audit Plan

**Status:** APPROVED 2026-10-24 — Pass 1 in progress. Report: `upgrade-audit-report.md`.
**Subject:** everything on branch `upgrade/deps` compared with `main` — 17 commits, 56 files
(+2297 / −1941 lines incl. lockfiles; +980 / −392 without), Phases 0–9 of `upgrade-plan.md`.
**Goal:** independently confirm that the upgrade is correct, secure and complete before it is merged
and deployed — and find anything the upgrade phases missed.

## Ground rules

1. **Re-verify, don't trust.** Every claim in `upgrade-plan.md`, `HISTORY.md`, commit messages and the
   vault is treated as unproven until re-checked with fresh evidence (commands, output, diffs).
   The upgrade already showed why: a Mongoose deprecation was missed in Phase 4 and the test summary
   once hid crashes.
2. **Audit only.** No fixes during the audit. Every finding is recorded with evidence, then
   summarised in a fix plan that the user approves separately. (Exception: none — even one-liners wait.)
3. **Severity:** Critical (breaks production / security hole) · High (likely bug or real risk) ·
   Medium (edge case, degraded behaviour) · Low (polish, docs) · Info (observation, no action).
4. **Safety:** local throwaway MongoDB (port 27099) only; never `server/.env` / Atlas; nothing is
   pushed, deployed or merged.
5. **Runtime:** Node 24.22.1 (deploy target); re-check on 22.23.4 wherever behaviour could differ.
6. **Skills:** `secure-coding-practices` (OWASP checklist) for every security item; the UI/UX skills
   in `.claude` for the visual and accessibility items.

## Pass 1 — Normal audit (standard checklist, repeatable)

| # | Check | How | Pass condition |
|---|---|---|---|
| A1 | Versions | every direct dependency vs npm `latest` dist-tag and pre-release markers; Node 24.22.1 is LTS | all stable `latest`, no pre-releases (version policy) |
| A2 | Lockfile integrity | `npm ci` from scratch in both packages; every `resolved` URL is `registry.npmjs.org`; every entry has an `integrity` hash; no `git+`/`file:`/tarball URLs; lockfile ↔ `package.json` in sync (`npm ls` clean, no extraneous/missing/invalid) | clean |
| A3 | Vulnerabilities | `npm audit` (full) both packages; cross-check advisories for the exact installed versions of the majors (Express 5.3, Mongoose 9.11, Helmet 8.3, express-rate-limit 8.7, Tailwind 4.3, react-router 8.5, Vite 8.3) | 0, or each finding explained |
| A4 | Deprecations | install notices; runtime `--trace-deprecation` across all suites; library-level warnings (Mongoose, Vite, React) in server, Vite and browser consoles | none unexplained |
| A5 | Build & lint | `npm run build`, `npm run lint`; build reproducibility Node 22 vs 24 | build OK, lint exit 0, identical output |
| A6 | Regression | full suite (24 suites, 767 checks) on Node 24 and 22, from clean test data | 767/767 on both |
| A7 | Commit hygiene | each of the 17 commits: message matches content, nothing unrelated, no secrets, no stray files (`dist/`, logs, `.env`), attribution lines | clean |
| A8 | Secrets & config | diff scanned for keys/tokens/URIs; `.gitignore` still covers `.env`, `dist`, `HISTORY.md`; `server/.env.example` still matches the variables the code reads | clean |
| A9 | Licences | licences of new/changed packages (`@tailwindcss/vite`, majors) compatible with the project | no copyleft surprises |
| A10 | Docs accuracy | README stack table, `upgrade-plan.md`, vault notes vs the actual repo state (versions, files, commands) | every statement true |

## Pass 2 — Big picture (system level)

| # | Area | Questions |
|---|---|---|
| B1 | Deployment chain | Does Render resolve Node 24 from `engines`; does the Render build/start command still work (`npm start`, no PostCSS/Tailwind config at the server); does Vercel's build work with `@tailwindcss/vite` and no `postcss.config.js`; Atlas ↔ MongoDB driver 7 compatibility (documented minimum server version); is the deploy order / rollback in the checklist actually executable? |
| B2 | API contract | Is every endpoint's request/response shape unchanged between `main` and the branch (status codes, JSON shapes, headers, cookies)? Compare both branches side by side against the same local DB — the client deployed on Vercel and the API on Render may briefly run different versions during a deploy. |
| B3 | Data compatibility | Can Mongoose 9 read and write documents created by Mongoose 8 in production shape (dates, arrays, subdocuments, `recentChanges`, snapshots, `tokenVersion`)? Index definitions identical? Any casting/validation behaviour change (e.g. `strictQuery`, null filters) on existing data? |
| B4 | Security posture before vs after | Headers (Helmet 7 → 8: CSP, HSTS, COOP/CORP), CORS, CSRF, cookies, rate limits (keys, IPv6, `trust proxy`), NoSQL-injection defence (old library vs new middleware), XSS (react-markdown 10), error leakage. Anything weaker than on `main`? |
| B5 | Performance | Client bundle and CSS size (gzip) vs `main`; first-render cost (icon font now via CSS `@import` + preload — waterfall?); API boot time and memory on Node 24; export streaming memory with many rows. |
| B6 | Browser support | Tailwind 4 needs Safari 16.4+, Chrome 111+, Firefox 128+ (`oklch`, `@property`, cascade layers, `color-mix`). What do older phones (campus audience) see — broken or just less pretty? Decide and document. |
| B7 | Dependency health & supply chain | Maintenance status of every direct dependency (last release, open security issues); `exceljs` (last release 2023, deprecated transitive deps) — risk and alternatives; install scripts in the tree; packages added/removed by the upgrade. |
| B8 | Operability | Logs (dotenv quiet, morgan), cron behaviour on Node 24, timezone/IST date logic unchanged, cold-start behaviour on Render, documentation a new maintainer would need. |

## Pass 3 — Small picture (line by line)

| # | Area | Detail |
|---|---|---|
| S1 | `sanitizeRequest.js` | Edge cases: deeply nested JSON (recursion depth → stack overflow / DoS within the 1 MB limit), huge arrays, `Object.create(null)` bodies, keys like `constructor`/`prototype`, unicode look-alike `$` (`＄`), keys with `.` in legitimate data, `Buffer`/`Date` values, urlencoded `extended: true` objects, repeated query keys (arrays), bracket rejection vs legitimate `[` in values, behaviour when `req.query` is read before the middleware runs. Compare against what `express-mongo-sanitize` did. |
| S2 | String-only checks | `auth.js` admin login and `placements.js` list/changes: every parameter path, empty strings, very long strings, arrays; any other handler still destructuring `req.query`/`req.body` without type checks (sweep all routes). |
| S3 | Express 5 sweep | Every route file: async error propagation, `res.status().json()` patterns, `req.params` usage, any `req.query` writes, router-level `mergeParams`, 404 behaviour, `express.urlencoded` behaviour change, `res.redirect`/`res.send(status)` signatures. |
| S4 | Mongoose 9 sweep | Every model and query: hooks (`next` removed), `findOneAndUpdate` options, `lean()` shapes, `id` virtual, `countDocuments`, aggregation pipeline, `isValidObjectId` callers, transactions (none?), connection options in `config/db.js`. |
| S5 | Rate limiting | All 18 limiters: `limit` value unchanged vs `max`, window, key generator, `skipSuccessfulRequests`, message format, `standardHeaders` draft version (header names the client may rely on). |
| S6 | Helmet / bcrypt / dotenv / JWT | Exact header values vs `main`; bcrypt cost and `$2b$` hashes verify on old code (rollback safety: can `main` verify passwords set on the branch?); dotenv path/quiet in both entry points; JWT unchanged. |
| S7 | Tailwind class diff | All 32 migrated files, every changed class: semantic equivalence (`rounded-sm`→`rounded-xs`, `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, `!x`→`x!`, `break-words`→`wrap-break-word`, `w-[22rem]`→`w-88`, `order-none`→`order-0`, …); the 11 `max-w-(--container-*)`; any remaining `max-w-{xs..xl}` or spacing-name collision (`w-*`, `h-*`, `size-*`, `basis-*`, `gap-*`) introduced since. |
| S8 | `index.css` | `@theme` tokens vs old `tailwind.config.js` value by value (colours, radii, spacing, fonts, type scale incl. line-height/letter-spacing/weight, keyframes/animations); layer order; compat rules (border, placeholder, cursor); every `@utility` that used to be `@layer components` (variants like `hover:`/`disabled:` still apply to them?); `.markdown-body` nested rules. |
| S9 | UI states not covered by screenshots | Hover, focus-visible, active, disabled, error and loading states; open dropdowns/menus/dialogs/toasts; notification panel; mobile menu; empty states; `prefers-reduced-motion`; high-contrast (forced colours); print of a drive page — computed-style comparison `main` vs branch. |
| S10 | Router / markdown / misc | react-router 8: navigation, `Navigate` redirects, search params, 404, scroll/focus restoration; react-markdown 10: plugin order and sanitize schema unchanged; `index.html` preload + CSS `@import` (icons before the font loads); `vite.config.js`; `engines` strings; `resetAdmin.js`. |
| S11 | Lockfile line review | Every changed top-level entry: expected version, expected source; no unexpected new transitive packages (diff of the full dependency tree `main` vs branch); `overrides` (`uuid`) still applied and still needed. |
| S12 | The tests themselves | Do the new suites (`upgrade2`–`5`, `upgrade9`) assert the real security properties, or could they pass while broken? Timing-based waits left in older suites; leftover-data assumptions; does the harness report every failure mode (crash, timeout, server failed to start)? |

## Deliverables

1. **`upgrade-audit-report.md`** — per check: what was done, evidence (command + key output), result.
2. **Findings table** — ID, severity, area, description, evidence, suggested fix, effort.
3. **Fix plan** for approval — grouped by severity; Critical/High first; each with its own verification.
4. Short summary to the user after each pass (normal → big picture → small picture), so issues
   surface early.

## Order and checkpoints

```
Pass 1 (normal)  →  checkpoint: summary + findings so far
Pass 2 (big)     →  checkpoint: summary + findings so far
Pass 3 (small)   →  checkpoint: full report + fix plan  →  user approves fixes  →  fix phase(s)
```
If a Critical finding appears in any pass, it is reported to the user immediately rather than at the
checkpoint.

## What I cannot check from here (needs the user, or stays documented)

- Render/Vercel/Atlas dashboards (Node version settings, Atlas server version) — the audit documents
  exactly what to look at; the user confirms.
- Real old devices for B6 — checked with documented browser-support data and emulated older engines
  where possible.
