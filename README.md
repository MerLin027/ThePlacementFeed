<div align="center">
  <img src="client/public/logo-mark.png" alt="The Placement Feed logo" width="110" />
  <h1>The Placement Feed</h1>
  <p>Campus placement drives for CHARUSAT students, in one place.</p>
  <p><a href="https://theplacementfeed.vercel.app"><strong>theplacementfeed.vercel.app</strong></a></p>
</div>

The Placement Feed lists every drive the Career Development and Placement Cell (CDPC) runs: who is
hiring, for which role, what it pays, who can apply and when applications close. Students browse
and apply. The CDPC admin posts drives and manages applicants from a protected dashboard.

## What it does

**For students**

- Home shows open drives first, closest deadline first, with past drives tucked into their own section.
- Search by company or role (press <kbd>/</kbd> to jump to the search) and filter by status, branch and CTC.
- Each drive page has the job description, eligibility, important dates and the selection rounds.
- A timeline groups every drive by month.
- With an account, a student can apply in the app and track each application's status. A drive can
  also link to an external form.
- A notification bell reports new drives, status changes and postponements, plus changes to the
  student's own applications.

**For CDPC staff**

- Create, edit, postpone and delete drives. A drive's status follows its dates automatically, and
  staff can pin a status by hand.
- For each drive, review applicants, change their status one at a time or in bulk, and export to
  Excel.
- Manage student accounts: search, reset a password, delete.
- Two roles. **Admins** use the Dashboard and Students pages: all of the above. The one **super
  admin** also manages Setup (branches, institutes, the university name), its own profile, and the
  team: add admins (a name and an email), edit, reset passwords, disable and delete them. Nobody can
  be made a second super admin.

Everyone signs in on the same page: students and admins with their email, the super admin with its
username or email.
There is no email sending. A student who forgets their password asks the CDPC, and staff issue a
random one-time password, shown once. It works for 72 hours and only to set a new password. New
staff accounts start the same way.

## Built with

| Part | Stack |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 8 |
| Backend | Node.js 24 LTS, Express 5, Mongoose 9 (MongoDB) |
| Hosting | Vercel (frontend), Render (API), MongoDB Atlas (database) |

The frontend's animations are plain CSS, with no animation library, and they switch off when the
operating system asks for reduced motion.

## Run it locally

You need **Node.js 24 LTS** (22.22 or newer also works) and a MongoDB database, either local or on Atlas.

```bash
git clone https://github.com/MerLin027/ThePlacementFeed.git
cd ThePlacementFeed
```

**API** (http://localhost:5000)

```bash
cd server
cp ../.env.example .env    # then fill in the values
npm install
npm run dev
```

**Website** (http://localhost:5173), in a second terminal

```bash
cd client
cp .env.example .env       # VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

On first start, the API creates the super admin from `ADMIN_USERNAME` and `ADMIN_PASSWORD` (an
existing single admin from an older version becomes the super admin automatically). The super admin
signs in on the normal login page with that username, and can add a name and an email on its
Profile page. If nobody can sign in as the super admin any more, run
`node server/scripts/resetAdmin.js` to restore its access.

### Configuration

`server/.env`:

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Database connection string |
| `CLIENT_URL` | yes | The website's address (https in production), for CORS and CSRF checks |
| `NODE_ENV` | yes | `development` locally, `production` when deployed |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | first start | Create the super admin |
| `PORT` | no | Defaults to 5000 (Render sets it) |
| `CRON_SECRET` | no | Enables `GET /api/cron/trigger` for an external scheduler |
| `PROXY_SECRET` | no | Same value as in Vercel; lets rate limits see each visitor's address (see Deployment) |

`client/.env`: `VITE_API_URL`, the address of the API in development. Production builds call `/api`
on the site's own domain instead.

Sessions are kept on the server (no signing secret to manage): see [server/API.md](server/API.md)
for how access works, every endpoint, its limits and what it records in the audit trail.

## Tests

The `tests/` folder holds the automated checks (about 1,300 in 36 suites). They cover the API, the website in a
real browser (Playwright) and accessibility (axe-core) at desktop and phone sizes. They only run
against a local, throwaway MongoDB on port 27099 and refuse any other database, so your real data
is never touched.

```bash
# 1. In its own terminal, start a scratch MongoDB (7 or 8) for the tests
mkdir -p tests/output/db
mongod --dbpath tests/output/db --port 27099 --bind_ip 127.0.0.1

# 2. In another terminal (after npm install in client/ and server/)
cd tests
npm run setup                 # once: installs Playwright, axe-core and a Chromium build
npm test                      # starts the API and the website itself, then runs every suite (~6 min)
node run.mjs phaseE-test      # or run selected suites by file name
```

## Deployment

- **Website:** Vercel, building `client/`. `vercel.json` proxies `/api/*` to the API on Render, so
  the browser only ever talks to the site's own domain and the session cookies are first-party
  (phone browsers block cookies from another site, which used to break logging in on phones). Each
  proxied request carries `PROXY_SECRET` (a Vercel environment variable) in a header; the API
  believes the visitor address Vercel forwards only when that matches its own `PROXY_SECRET`.
  Every other path goes to the single-page app. `vercel.json` also
  sets the security headers (Content-Security-Policy, no framing, no MIME sniffing). The policy only
  lets the site call its own origin (the API is reached through the proxy). If the API moves, update
  the proxy destination in `vercel.json`; to add another outside service, update `connect-src` (or
  the matching directive) too.
  Scripts must come from the site itself. Inline *styles* are allowed on purpose: React `style`
  attributes and the toast library need them, and a static host can't issue per-request nonces.
- **API:** Render, with the root directory set to `server`. It builds on Node 24, as set by
  `engines` in `server/package.json`. The free tier sleeps when idle, so the first request after a
  quiet spell can take up to a minute. The site shows a "waking up" message meanwhile.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. Anything from 2022 onwards works, which means
Chrome 99, Safari 15.4 and Firefox 97 or newer. Older browsers can't load the styles.

## Project layout

```
client/   React website: pages/, components/, context/ (the signed-in account), index.css (theme)
server/   Express API. index.js starts it; src/app.js builds it; src/routes/ decides who may call what
          (public, auth, student, admin); src/features/ holds each area's routes, rules and logic;
          src/models/, src/middleware/, src/lib/. API.md describes every endpoint
tests/    Regression suites and their runner
```

---

Built as a practical tool for CHARUSAT's placement season. Released under the [MIT License](LICENSE).
