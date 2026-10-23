# Dependency Upgrade Plan

**Status:** IN PROGRESS — Phases 0–5 done (C1 used, C2 not needed); Phase 6 (Tailwind CSS 4) in progress.
**Replanned 2026-10-23:** version policy added; react-router 8 added as Phase 7; final phase is now Phase 8.
**Goal:** move every outdated dependency to its latest version with no regressions, no new
vulnerabilities, and the existing regression suite (619 checks at the Phase 0 baseline) still green after every phase.
**Rule:** one phase = one commit on branch `upgrade/deps`. A phase is only "done" when its gate
passes. Nothing is pushed or merged to `main` until the user says so.

## Version policy (user requirement, 2026-10-23)

Only **stable releases**: the version npm publishes under the `latest` dist-tag, with no
pre-release identifier (`-alpha`, `-beta`, `-rc`, `-pre`, `-next`, `-canary`, nightly or
experimental builds). `package.json` keeps caret ranges; the lockfile pins the exact versions that
were tested. Runtime: Node 22 LTS (Render resolves the bounded `engines` range to the latest 22.x).

**Audit (2026-10-23, every direct dependency of client and server):** all installed versions are
stable `latest` releases — no pre-releases. Two newer stable releases had appeared since the
inventory: **react-router 8.5.0** (major; v8 has been stable since 8.0.0 on 2026-06-17 — the
inventory missed it) and **mongoose 9.11.4** (patch). Both are added below. Phase 8 re-runs this
audit before sign-off so the final state is current.

## Inventory (from `npm outdated`, 2026-10-23)

| Package | Current | Target | Kind |
|---|---|---|---|
| react, react-dom | 19.2.7 | 19.3.1 | minor |
| @types/react, @types/react-dom | 19.2.17 / 19.2.3 | 19.3.0 | minor |
| @vitejs/plugin-react | 6.0.3 | 6.1.2 | minor |
| autoprefixer | 10.5.2 | 10.6.1 | minor (removed later by Tailwind 4) |
| oxlint | 1.73.0 | 1.89.0 | minor (new rules may flag code) |
| react-hot-toast | 2.6.0 | 2.6.1 | patch |
| mongoose | 8.24.1 | 8.24.6, then 9.11.3 | patch, then **major** |
| helmet | 7.2.0 | 8.3.0 | **major** |
| express-rate-limit | 7.5.1 | 8.7.1 | **major** |
| bcryptjs | 2.4.3 | 3.0.3 | **major** |
| dotenv | 16.6.1 | 18.0.9 | **major** |
| express | 4.22.3 | 5.3.0 | **major** |
| react-markdown | 9.1.0 | 10.1.0 | **major** |
| tailwindcss | 3.4.19 | 4.3.3 | **major** |
| react-router | 7.18.4 | 8.5.0 | **major** (added in replan) |
| mongoose (patch) | 9.11.3 | 9.11.4 | patch (added in replan; taken in Phase 8) |

Everything else (axios, vite, express-validator, jsonwebtoken, exceljs, node-cron,
morgan, cors, cookie-parser, nodemon, …) is already current.

## What the code audit found (this decides the phases)

| Finding | Where | Consequence |
|---|---|---|
| `pre('validate', function (next) { … next(); })` | `server/models/Placement.js:156` | **Breaks on Mongoose 9** (callback `next` removed) → rewrite |
| `express-mongo-sanitize@2.2.0` assigns to `req.query` | `server/index.js:58` | `req.query` is a read-only getter in Express 5 → likely crash/no-op; open upstream issues confirm |
| `express-validator` `.toInt()/.toFloat()` on `query()` | `server/middleware/validate.js:362-400` | writes back into `req.query`; must be verified on Express 5 |
| `req.body.*` / `hasOwnProperty.call(req.body, …)` | `students.js:84`, `applicants.js:286`, `placements.js:332…` | Express 5 leaves `req.body` **undefined** when there is no body → TypeError |
| `keyGenerator` uses `req.ip` | `studentAuth.js:42` | express-rate-limit 8 warns about IPv6 subnets → use `ipKeyGenerator` |
| `max:` option on 15 limiters | all routes | renamed `limit` (v7 deprecation, still accepted) → rename to be safe |
| `require('dotenv').config()` | `index.js:1`, `scripts/resetAdmin.js:1` | dotenv ≥17 prints a banner line by default → `quiet: true` |
| Mongoose 9 requires **Node ≥ 20.19**; no `engines` declared; Render picks its own Node | `server/package.json` | must pin Node on Render **before** deploying |
| No wildcard routes, no `app.del`, no `req.param()`, no `findOne(null)`, no `background` index options | server | Express 5 route syntax and most Mongoose 9 changes need no edits |
| `<ReactMarkdown>` passed no `className` | `PlacementDetail.jsx:278` | react-markdown 10 needs no code change; XSS sanitisation must still be re-tested |
| Custom theme in JS (colours, spacing `xs…xl`, radii, fonts, font sizes with line-height, keyframes) | `tailwind.config.js` | must move to CSS `@theme`; spacing names collide with container-size names → verify |
| 67 bare `border`, 10 `rounded-sm`, 4 `shadow-sm`, 1 `rounded`, 1 `outline-none`, 1 `flex-grow`, `placeholder-outline`, `!pl-10` | client `src` | Tailwind 4 renamed/removed/changed defaults → visual diffs |
| `@apply` in `@layer components` with `focus:`, `hover:` | `index.css` | works in v4 but must be re-verified |

## Phase map

```
Phase 0  Baseline & safety net
Phase 1  Safe in-range updates (client + server)
Phase 2  Server small majors: helmet 8, bcryptjs 3, dotenv 18, express-rate-limit 8
Phase 3  Express 5  (+ sanitiser, body, query handling)
Phase 4  Mongoose 9 (+ Node pin)
Phase 5  react-markdown 10 (+ XSS regression)
Phase 6  Tailwind CSS 4 (6a tooling → 6b theme → 6c classes → 6d visual diff)
Phase 7  react-router 8 (+ Node 22.22 prerequisite)            [added in replan]
Phase 8  Final verification, version re-audit, docs, deploy checklist
--- contingency phases, only if the trigger happens ---
Phase C1  Replace express-mongo-sanitize        (trigger: it fails on Express 5)
Phase C2  Read validated query via matchedData  (trigger: .toInt() on req.query fails)
Phase C3  Tailwind visual repair pass           (trigger: 6d finds visual diffs)
Phase C4  Pin-and-defer a package               (trigger: any package cannot be made to pass its gate)
```

Order is deliberate: smallest blast radius first; server before client; the two big framework
swaps (Express, Mongoose) are separate so a failure points at exactly one cause; Tailwind goes last
because it touches every page.

---

## Phase 0 — Baseline & safety net

- Create branch `upgrade/deps` from `main`.
- Start local MongoDB on port 27099 (never `server/.env`, never Atlas) and run the **whole existing
  suite on current code** → baseline recorded: **619/619** across 19 suites (2026-10-23) (`phase1…phaseG`, `eligibility-unit`).
- Capture **before screenshots** of all 32 audited page views (desktop + phone) into the scratchpad;
  Phase 6 compares against them.
- Record `npm audit` (full, including dev) and `npm ls --depth=0` for both packages.
- Add `engines.node` to both packages — server `>=20.19.0 <23` (Mongoose 9), client
  `^20.19.0 || ^22.12.0` (Vite 8). Upper bounds matter: Render resolves an open range such as
  `>=20.19.0` to the newest Node release (a future, untested major). With the bound it resolves to
  the latest 22.x — the version all checks run on. `NODE_VERSION` on Render overrides this if set.
  **Deploy note:** set Node 22 on Render before deploying anything from this branch.

**Gate:** baseline 619/619 on untouched code; screenshots saved; engines committed.
**Commit:** `chore(deps): upgrade baseline and Node engine pin`.

## Phase 1 — Safe in-range updates

- Client: `react`, `react-dom` 19.3.1; `@types/react*` 19.3.0; `@vitejs/plugin-react` 6.1.2;
  `autoprefixer` 10.6.1; `react-hot-toast` 2.6.1; `oxlint` 1.89.0.
- Server: `mongoose` 8.24.6 (stay on 8 for now).
- `npm install`, `npm run lint` (fix or justify any new oxlint findings), `npm run build`.
- Result: oxlint 1.89 enables React-Compiler-style rules by default (`set-state-in-effect` ×13,
  `purity` ×1, `refs` ×1) — all warnings (exit 0) on established patterns (loading flags in
  effects, latest-ref, `new Date()` in the footer). Left as visible warnings, not refactored here;
  follow-up candidate after the upgrade.
- React minor: watch for new dev-mode warnings in the browser console (our suites assert zero
  console errors).

**Gate:** lint clean, build OK, full regression 619/619, axe clean, no new console errors.
**Commit:** `chore(deps): in-range updates (react 19.3, vite plugin, oxlint, mongoose 8.24.6)`.

## Phase 2 — Server small majors

Done together because they are independent, low-risk and each has an obvious test.

1. **helmet 8** — `app.use(helmet())` uses defaults, so the only effect is HSTS max-age 365 days.
   Confirm response headers (CSP/HSTS) in a test; confirm the API still serves the client origin.
2. **bcryptjs 3** — API unchanged (`hash/compare/genSalt`). Test: existing `$2a$` hashes (admin,
   DUMMY_HASH, seeded students) still verify; new hashes verify; login timing path unchanged.
3. **dotenv 18** — `require('dotenv').config({ quiet: true })` in `index.js` and `resetAdmin.js`
   so production logs stay clean.
4. **express-rate-limit 8** — go straight to ≥ 8.3 (8.0.0–8.0.1 had an IPv4 key-sharing bug).
   - Rename `max` → `limit` on all limiters.
   - `studentAuth.js` `loginAccountLimiter`: use `ipKeyGenerator(req.ip)` from the package.
   - Boot the server and confirm **no `ERR_ERL_*` validation warnings** in the log.
   - Re-run the lockout/limit tests (login 5/15 min, per-account key, apply 10, export 5).

**Gate:** regression 619/619 incl. rate-limit tests; boot log has no warnings; header test passes.
**Commit:** `chore(deps): helmet 8, bcryptjs 3, dotenv 18, express-rate-limit 8`.

## Phase 3 — Express 5

1. Install `express@5`. Boot and exercise every route group.
2. **Request body:** add a tiny guard so handlers never see `undefined` — e.g.
   `app.use((req, _res, next) => { req.body ??= {}; next(); })` after the parsers — instead of
   patching each `req.body.x`. Test: PATCH/POST with no body and with wrong content-type return the
   normal validation 400, never a 500.
3. **Query handling:** run the Home filters, `closing_soon` sort, pagination and the applicants
   filters. Check `express-validator`'s `.toInt()/.toFloat()` on `query()` still deliver numbers.
   - If this fails → **Phase C2**.
4. **express-mongo-sanitize:** run a NoSQL-injection test (`?status[$ne]=x`, body `{"email":{"$gt":""}}`
   on login). Expected: rejected/stripped exactly as today.
   - If it throws or silently stops sanitising → **Phase C1**.
5. Error flow: async handlers now forward rejected promises to the error middleware. Verify the
   central error handler still returns the same JSON shape and no stack traces in production mode.
6. Confirm `trust proxy`, CSRF origin check, cookie flags (httpOnly/SameSite/Secure) and the
   constant-time cron secret check are unchanged (existing tests cover these).

**Gate:** 619/619, injection tests pass, no 500s on empty/odd bodies, 404 handling unchanged.
**Commit:** `chore(deps): express 5`.

**Result:** `express-mongo-sanitize` crashed every request on Express 5 → **C1 done**: replaced by
`middleware/sanitizeRequest.js`, which also pins `req.query` (so validator coercion persists — C2 not
needed), defaults `req.body` to `{}`, and rejects bracketed query keys with 400. The new suite also
found three pre-existing 500s on Express 4 (object username on admin login; object/array `branch` or
`search` on the drive list) — fixed with string-only checks. Regression 696/696 + `upgrade3-test` 57.

## Phase 4 — Mongoose 9

1. Confirm Node ≥ 20.19 locally (v22.12 ✔) and that Render is pinned (Phase 0).
2. Install `mongoose@9`.
3. **Rewrite the hook** in `models/Placement.js:156` — drop the `next` argument:
   ```js
   placementSchema.pre('validate', function () {
     if (this.driveDate && this.deadline && this.deadline > this.driveDate) {
       this.invalidate('deadline', 'Deadline cannot be after the drive date');
     }
   });
   ```
4. Re-check against the migration guide: `isValidObjectId` (used in `requireStudent.js`, only gets
   strings from the JWT ✔), no `background` index option ✔, no `findOne(null)` ✔, no update
   pipelines ✔, aggregation (`closingSoonPipeline`) must be re-run, unique-index creation on a
   **fresh** DB (`Student` email/roll, `Application` drive+student) must still produce the same
   indexes and the same duplicate-key error mapping.
5. MongoDB driver 7: verify connection options in `config/db.js` still valid, and confirm the Atlas
   cluster's server version is supported by driver 7 (check before deploy; local mongod is 8.0 ✔).
6. Run the status-cron and notification tests specifically (they use conditional `updateOne` and
   `serverTime` cursors).

**Gate:** 619/619, new-DB index check identical to before, deadline-after-drive validation test
still returns the same message, cron/aggregation tests pass.
**Commit:** `chore(deps): mongoose 9 and validate-hook rewrite`.

**Result:** only the hook needed changing. `upgrade4-test` (26): indexes built by Mongoose 9 on a
fresh DB are identical to those Mongoose 8 built (all four models, no `background`); hook message,
duplicate-key 409s, CastError 400, aggregation, cron, changes feed and delete cascade unchanged.
Regression 723/723. Atlas server version vs driver 7 remains a deploy-checklist item.

## Phase 5 — react-markdown 10

- Install `react-markdown@10`. No `className` is passed (wrapper `div.markdown-body` already styles
  it), so no code change is expected; ESM-only is fine under Vite.
- Re-check that `remark-gfm`, `rehype-raw`, `rehype-sanitize` peers are satisfied.
- **Security regression (must pass):** render drive descriptions containing `<script>`, `<img onerror>`,
  `<iframe>`, `javascript:` links, and inline styles → all neutralised; external links still open in a
  new tab with `rel="noopener noreferrer"`; tables/lists/code blocks still styled.

**Gate:** XSS cases neutralised, markdown visuals unchanged, build + axe clean.
**Commit:** `chore(deps): react-markdown 10`.

**Result:** no code change. `upgrade5-test` (18) renders a hostile description in the browser: no
script ran, no script/iframe/form/button, no on* or style attributes, no `javascript:` links, every
link `_blank` + `noopener noreferrer`; a raw `<input>` survives only as a disabled checkbox (GitHub
sanitise schema, used by GFM task lists). Headings, lists, tables, code, quotes still render and
are styled. Regression 741/741.

## Phase 6 — Tailwind CSS 4  (largest; four sub-steps, one commit at the end, WIP commits allowed)

**6a — Tooling.** Install `tailwindcss@4` and `@tailwindcss/vite`; add the plugin to
`vite.config.js`; delete `postcss.config.js` and remove `autoprefixer`/`postcss` deps.
Run `npx @tailwindcss/upgrade` on the clean branch and review its diff line by line. Decide browser
floor (Chrome 111+, Safari 16.4+, Firefox 128+) — acceptable for a college audience; note it in the
README.

**6b — Theme into CSS.** Replace `tailwind.config.js` with `@theme` in `index.css`:
- colours → `--color-*` (all MD3 tokens + `brand-*`),
- radii → `--radius-*` (keep `DEFAULT` behaviour: `rounded` = 0.25rem),
- spacing tokens `base/xs/sm/md/gutter/lg/xl/container-max` → `--spacing-*`
  (**check collisions:** `max-w-sm|md|lg|xl` and `w-xs` must still resolve to the intended sizes —
  v4 resolves them from `--container-*`; test every use),
- fonts → `--font-*`; the 9 type scales → `--text-*` with `--text-*--line-height`,
  `--text-*--letter-spacing`, `--text-*--font-weight`,
- `keyframes` + `animation` → `@keyframes` + `--animate-*`.
Keep the global `prefers-reduced-motion` rule.

**6c — Class and default changes.**
- `@tailwind base/components/utilities` → `@import "tailwindcss"`.
- Renames: `shadow-sm`→`shadow-xs`, `rounded-sm`→`rounded-xs`, bare `rounded`→`rounded-sm`
  (only where the old value is wanted — our `DEFAULT` radius is custom, so check each),
  `outline-none`→`outline-hidden`, `flex-grow`→`grow`, `placeholder-outline`→`placeholder:text-outline`,
  `!pl-10`→`pl-10!`.
- **Default border colour changed** (v3 gray-200 → v4 `currentColor`): 67 bare `border` uses —
  give each an explicit colour or add a base-layer rule restoring `border-outline-variant`.
- Default `ring` width/colour changed; confirm `ring-2 ring-primary/20` focus styles unchanged.
- Buttons now default to `cursor: default`; the `.btn-*` classes already set cursors where needed — verify.
- Re-check each `@apply` block in `index.css` (`.btn-primary`, `.input-field`, `.markdown-body …`).

**6d — Visual and accessibility diff.** Re-run the 32-view audit; compare against the Phase 0
screenshots (pixel diff with a tolerance, then eyeball every flagged view); axe clean; all touch
targets ≥ 44 px; no horizontal scroll; no console errors; `npm audit` shows the
`postcss-selector-parser` / `braces` findings **gone**.
- Any visual diff → **Phase C3**.

**Gate:** zero unexplained visual diffs, axe clean, build size not materially larger, audit clean.
**Commit:** `chore(deps): tailwind css 4 (css-first theme)`.

## Phase 7 — react-router 8  (added in replan)

**Prerequisite:** react-router 8 requires **Node ≥ 22.22.0** (and React ≥ 19.2.7 ✔, ESM-only ✔
under Vite). The local machine has Node 22.12.0 → the user upgrades local Node to the current 22.x
LTS (22.23.4) — a patch-level update within the same LTS line. Client `engines` becomes `^22.22.0`
(Vite 8's 20.19 support no longer applies once react-router needs 22.22). Vercel's "22.x" setting and
Render's bounded range already resolve to 22.23.

**Code audit:** the client uses declarative mode only — `BrowserRouter`, `Routes`, `Route`,
`Navigate`, `Link`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams`, all imported
from `react-router` (not `react-router-dom`). No loaders/actions, `useMatches`, route `meta`,
middleware or future flags — the areas v8 changed. Expected code change: none.

**Steps:** confirm the v8 changelog against this list; install `react-router@8`; build; full
regression (routing, guards, redirects on 401 and on forced password change, `?apply=1`, search
params on Home/admin lists, 404 page, skip link and focus-on-route-change are all covered by the
existing browser suites).

**Gate:** build OK, full regression green, no console warnings from the router.
**Commit:** `chore(deps): react-router 8`.

## Phase 8 — Final verification, version re-audit, docs, deploy checklist

- **Version re-audit:** list every direct dependency's installed version against npm `latest`;
  take newer stable patch/minor releases (e.g. mongoose 9.11.4), re-run the full regression;
  a newer *major* goes back into the plan as its own phase. No pre-releases.
- Fresh install from lockfiles (`rm -rf node_modules && npm ci`) in both packages; `npm run build`.
- Full regression (all suites) → 619/619; axe over all page views; `npm audit` (full) = 0.
- Update `README.md` tech-stack versions, `HISTORY.md`, this plan's status, the vault notes
  (`Projects/The_Placement_Feed.md`, `Architecture/Dependencies_Map.md`, add a decision note on the
  Tailwind 4 move and the Node 22 requirement), and the memory file.
- **Deploy checklist (written, not executed):**
  1. Check the Render build log shows Node 22.x (and that `NODE_VERSION`, if set, is 22);
     2. confirm the Atlas server version supports driver 7;
  3. deploy the server first (API contract unchanged), smoke-test `/api/health` and a login;
  4. deploy the client on Vercel, smoke-test Home, a drive page, signup, apply, admin login;
  5. rollback = redeploy the previous Render/Vercel build; code rollback = `git revert` the phase commit.

**Gate:** everything above green. Merge to `main` and push only on the user's explicit go-ahead.
**Commit:** `docs: dependency upgrade complete`.

---

## Contingency phases (created only if the trigger fires)

**C1 — Replace `express-mongo-sanitize`.** Trigger: crash or no-op on Express 5. Preferred fix: a
small in-repo middleware (~25 lines) that strips keys starting with `$` or containing `.` from
`req.body` and `req.params` in place and, for `req.query`, validates and rejects (400) instead of
mutating. Alternatives: a maintained fork that supports Express 5. Add unit tests for nested objects,
arrays and prototype-pollution keys (`__proto__`, `constructor`). Remove the old dependency.

**C2 — Validated query values.** Trigger: `.toInt()/.toFloat()` no longer reach handlers. Fix: read
values from `matchedData(req, { locations: ['query'] })` in the affected handlers
(`placements.js` list, applicants list, admin students list) instead of `req.query`.

**C3 — Tailwind visual repair.** Trigger: any diff from 6d. Fix per view: explicit border colours,
radius/shadow tokens, spacing/container collisions. Re-run 6d until clean. If a systemic issue
remains, add a compatibility layer in `@layer base` rather than editing dozens of components.

**C4 — Pin and defer.** Trigger: a package cannot pass its gate within reasonable effort (for
example a plugin without v4 support). Pin the last good version, record the reason and the exact
failing check in `HISTORY.md`, and continue with the remaining phases. The final report must name
anything deferred and any advisory it leaves open.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Render builds on a Node < 20.19 (Mongoose 9 refuses to start) or on an untested new major | Bounded `engines` range (resolves to latest 22.x); Render build log checked in the deploy checklist |
| A "latest" version is a pre-release or a brand-new major slips in | Version policy above; re-audit in Phase 8 |
| A regression only shows against production data | Test against a local mongod seeded with realistic data; never touch `server/.env` / Atlas from tests |
| Tailwind 4 subtly changes visuals | Before/after screenshots, axe, 44 px check; Phase C3 |
| Sanitiser silently stops working (security regression) | Dedicated injection tests are a gate in Phase 3; never "fix" by removing the middleware |
| Upgrade tool rewrites too much | Run on a clean branch, review the diff, commit nothing unreviewed |
| Many changes hard to bisect | One commit per phase; Express and Mongoose deliberately separate |

## Effort (rough)

Phases 0–2: small. Phase 3: medium. Phase 4: small–medium. Phase 5: small. Phase 7: small. Phase 6: the largest,
roughly as much as the rest combined. Contingency phases are expected to be needed for C1 and C3.
