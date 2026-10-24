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

**For the admin**

- Create, edit, postpone and delete drives. A drive's status follows its dates automatically, and the
  admin can pin a status by hand.
- For each drive, review applicants, change their status one at a time or in bulk, and export to
  Excel.
- Manage student accounts: search, reset a password, delete.

There is no email. A student who forgets their password asks the CDPC, and the admin issues a
temporary one. It works for 72 hours and has to be changed at the next login.

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

On first start, the API creates the admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The
admin signs in at `/admin/login`, which is deliberately not linked in the menu. To change the admin
credentials later, run `node server/scripts/resetAdmin.js`.

### Configuration

`server/.env`:

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Database connection string |
| `JWT_SECRET` | yes | Signs session tokens (32+ random characters) |
| `COOKIE_SECRET` | yes | Signs cookies (32+ random characters) |
| `CLIENT_URL` | yes | The website's address, for CORS and CSRF checks |
| `NODE_ENV` | yes | `development` locally, `production` when deployed |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | first start | Create the admin account |
| `PORT` | no | Defaults to 5000 (Render sets it) |
| `CRON_SECRET` | no | Enables `GET /api/cron/trigger` for an external scheduler |
| `DEFAULT_STUDENT_PASSWORD` | no | Temporary password after an admin reset (default `college123`) |

`client/.env`: `VITE_API_URL`, the address of the API.

## Tests

The `tests/` folder holds 786 automated checks in 26 suites. They cover the API, the website in a
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
npm test                      # starts the API and the website itself, then runs every suite
node run.mjs phaseE-test      # or run selected suites by file name
```

## Deployment

- **Website:** Vercel, building `client/`. `vercel.json` sends every path to the single-page app and
  sets the security headers (Content-Security-Policy, no framing, no MIME sniffing). The policy only
  lets the site call its own origin and the API at `https://theplacementfeed-api.onrender.com`. If the
  API moves, or you add another outside service, update `connect-src` (or the matching directive) too.
- **API:** Render, with the root directory set to `server`. It builds on Node 24, as set by
  `engines` in `server/package.json`. The free tier sleeps when idle, so the first request after a
  quiet spell can take up to a minute. The site shows a "waking up" message meanwhile.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. Anything from 2022 onwards works, which means
Chrome 99, Safari 15.4 and Firefox 97 or newer. Older browsers can't load the styles.

## Project layout

```
client/   React website: pages/, components/, context/ (sessions), index.css (theme and motion)
server/   Express API: routes/, models/, middleware/, services/ (apply rules), jobs/ (daily status update)
tests/    Regression suites and their runner
```

---

Built as a practical tool for CHARUSAT's placement season. Released under the [MIT License](LICENSE).
