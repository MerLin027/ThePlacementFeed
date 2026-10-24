# Regression tests

24 suites (about 770 checks) covering the API, the browser UI, accessibility (axe-core), the
dependency upgrade (Express 5, Mongoose 9, Helmet 8, rate limits, sanitiser, XSS, Excel export) and
the Node 24 runtime. They were written during the October 2026 work and moved into the repository by
the upgrade audit (finding M-2).

> **Local only.** Every suite talks to a throwaway local MongoDB and to servers the runner starts
> itself. `tests/lib/env.cjs` refuses any database that is not on `localhost`/`127.0.0.1`, and the API
> is started from `tests/output/`, where no `.env` file exists — so `server/.env` (production Atlas) is
> never read.

## Setup (once)

1. Node 24 LTS (22.22+ also works), and `npm install` in both `client/` and `server/`.
2. A local MongoDB 7 or 8 that the tests may write to, on port 27099:
   ```powershell
   mkdir tests\output\db
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath tests\output\db --port 27099 --bind_ip 127.0.0.1
   ```
   (Leave it running in its own terminal. Use `TEST_MONGODB_URI` for another local address.)
3. In `tests/`:
   ```powershell
   cd tests
   npm run setup        # installs Playwright + axe-core and a Chromium build into tests/.playwright-browsers
   ```

## Run

```powershell
cd tests
npm test                          # all suites
node run.mjs phase3-api upgrade3-test   # selected suites (file names without extension)
```

The runner removes leftover test data, starts the Vite dev server (port 5173) and — fresh for every
suite, so in-memory rate limits reset — the API (port 5099). It prints one line per suite and a total.
A suite that crashes, times out (400 s) or ends without its summary line counts as failed, and the exit
code is non-zero.

Logs: `tests/output/logs/<suite>.log`, the API output of the last suite in `tests/output/server.log`,
screenshots in `tests/output/shots/`.

To also check deprecations: `$env:NODE_OPTIONS='--trace-deprecation'; npm test`, then search the logs
for `DeprecationWarning`.

## The suites

| Suite | Covers |
|---|---|
| `phase1-*` … `phase5-*` | student accounts, sessions, CSRF, applications, admin students/applicants, Excel export |
| `phaseA-*` … `phaseG-*` | status automation, notifications, my applications, accessibility, home/timeline, admin pages, full page audit |
| `eligibility-unit` | eligibility text |
| `upgrade2-test` … `upgrade5-test`, `upgrade9-test` | Helmet/bcrypt/rate-limit, Express 5 + sanitiser, Mongoose 9, markdown XSS, Node 24 runtime checks |

Known limitation: browser suites still use some fixed waits (`waitForTimeout`); on a slow machine a
check may occasionally need a re-run.
