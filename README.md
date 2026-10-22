<div align="center">
  <img src="client/public/logo.png" alt="The Placement Feed" width="180" />
  <h1>The Placement Feed</h1>
  <p>Placement drive tracker for CHARUSAT CDPC — browse, search, and manage campus drives.</p>

  [![Deployed on Vercel](https://img.shields.io/badge/deployed-vercel-black?logo=vercel)](https://theplacementfeed.vercel.app)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
</div>

---

**[theplacementfeed.vercel.app](https://theplacementfeed.vercel.app)** — Students can browse, filter, and search active/past placement drives, create an account, and apply to drives in-app. A single authenticated admin manages drives, student accounts and applicants from a protected dashboard.

---

## Stack

| | Technology | Version |
|---|---|---|
| **Frontend** | React | 19.2 |
| | Vite | 8.1 |
| | Tailwind CSS | 3.4 |
| | React Router | 7.18 |
| | Axios | 1.18 |
| | react-markdown + remark-gfm / rehype-raw / rehype-sanitize | 9.0 / 4.0 / 7.0 / 6.0 |
| | react-hot-toast | 2.6 |
| **Backend** | Node.js | no version pinned in repo |
| | Express | 4.21 |
| | Mongoose | 8.6 |
| | node-cron | 4.6 |
| | JWT + bcryptjs | 9.0 / 2.4 |
| | ExcelJS (applicant export) | 4.4 |
| **Database** | MongoDB (local dev) / MongoDB Atlas (prod) | — |
| **Deployment** | Frontend → Vercel, Backend → Render | — |

---

## Features

- Browse, search, and filter placement drives by branch, status, CTC range, and keyword
- Drive detail pages with full JD rendered as Markdown (GFM + sanitized HTML)
- Selection process steps shown per drive (round name + description)
- Per-drive application mode: external form link (`formUrl`), **in-app application**, or both
- Timeline view — drives grouped chronologically by month
- Automatic status transitions (Upcoming → Ongoing → Completed) via daily cron at 00:05 IST; skipped if status was manually overridden
- Postponed-drive handling — toggle `isPostponed`; status automation resettable per drive
- Notification polling every 20 s via `GET /api/placements/changes` — toast alerts on new, edited, postponed, or status-changed drives; persisted in `localStorage`, synced across tabs
- **Student accounts** — sign up with email + roll number (one account each, can't be changed later), profile with academic details, change password; 7-day session in its own httpOnly cookie
- **In-app applications** — eligibility checked server-side (status, postponed, deadline, branch, CGPA, backlogs, profile completeness); profile is snapshotted at submission; optional per-drive questions; students see their application status
- Admin dashboard — create, edit, delete drives (deleting a drive also deletes its applications); protected by JWT in httpOnly cookie (3 h session)
- **Admin applicants page** per drive — filter, sort, change status (single or bulk), private notes, and **Excel export** (formula-injection safe)
- **Admin students page** — search students, reset a password to the default, or delete an account (applications are kept with personal details removed)
- Branches are shown by full name (e.g. *Information Technology*) and stored as short codes (`IT`)
- Security hardened: Helmet, CORS, rate-limiting, exact-origin CSRF checks, input validation + allowlists, separate admin/student sessions with token revocation, audit log for admin account/export actions, ReDoS-safe search

---

## Local Setup

> Requires Node.js (no specific version pinned in the repo; 18+ recommended) and a MongoDB instance (local or Atlas).

```bash
git clone https://github.com/MerLin027/ThePlacementFeed.git
cd ThePlacementFeed
```

**Server**
```bash
cd server
cp ../.env.example .env   # fill in your values
npm install
npm run dev               # → http://localhost:5000
```

**Client** (separate terminal)
```bash
cd client
npm install
npm run dev               # → http://localhost:5173
```

### Environment variables

**Server** (`server/.env`):

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | ✅ | Atlas connection string (or local) |
| `JWT_SECRET` | ✅ | Long random string |
| `COOKIE_SECRET` | ✅ | Long random string |
| `CLIENT_URL` | ✅ | Vercel URL in prod; `http://localhost:5173` locally |
| `NODE_ENV` | ✅ | `production` on Render, `development` locally |
| `ADMIN_USERNAME` | initial seed only | Used once on first boot to create admin |
| `ADMIN_PASSWORD` | initial seed only | Used once on first boot to create admin |
| `PORT` | auto-set by Render | Defaults to 5000 |
| `CRON_SECRET` | optional | Bearer token for `GET /api/cron/trigger`; endpoint is disabled when unset |
| `DEFAULT_STUDENT_PASSWORD` | optional | Temporary password set when the admin resets a student account. Defaults to `college123` |

**Client** (`client/.env`):

| Variable | Required |
|---|---|
| `VITE_API_URL` | ✅ |

The server auto-creates the admin account on first boot from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. After rotating credentials with `node scripts/resetAdmin.js`, those two vars can be dropped from the environment.

### Student accounts & password resets

There is no email sending. A student who forgets their password asks the CDPC admin, who resets it from **Students** in the admin dashboard. The account then gets the default password (`DEFAULT_STUDENT_PASSWORD`), which:

- works for **72 hours** only,
- signs the student out of every device when it's set,
- only lets the student reach the change-password screen until they pick a new password (enforced by the API, not just the UI),
- can't be kept as the new password.

Hand the temporary password to the student in person.

> **Render cold starts:** The free tier spins down after inactivity — first request may take 30–50 s. The app shows a loading state during this time.

---

## Structure

```
ThePlacementFeed/
├── client/                  # Vite + React frontend
│   ├── public/              # Static assets (logo, favicons)
│   └── src/
│       ├── api/             # Axios instance + session-expiry interceptor
│       ├── constants/       # Branch names, application statuses
│       ├── context/         # AuthContext (admin + student), NotificationContext, MyApplicationsContext
│       ├── hooks/           # usePlacementsFetch, useApplyState
│       ├── utils/           # Apply-state rules, IST dates, form errors, safe redirects
│       ├── components/
│       │   ├── Layout/      # Navbar, Footer
│       │   ├── Notifications/ # NotificationBell
│       │   └── ...          # ApplyButton, ApplyModal, Applicant*, RequireRole, PlacementForm, etc.
│       └── pages/           # Home, PlacementDetail, Timeline, Student*, ChangePassword, Admin*
└── server/                  # Express API
    ├── config/              # DB connection, admin seed
    ├── constants/           # Auth settings, branch codes + names
    ├── jobs/                # node-cron status transition job
    ├── middleware/          # requireAdmin, requireStudent, CSRF, validation, error handler
    ├── models/              # Placement, Admin, Student, Application
    ├── routes/              # /api/auth, /api/placements (+ /:driveId/applicants), /api/students,
    │                        # /api/applications, /api/admin/students
    ├── services/            # Application eligibility rules
    ├── utils/               # Cookies, sessions, IST dates, audit log, regex escaping
    └── scripts/             # resetAdmin.js (credential rotation)
```

---

*A student project built as a practical tool for CHARUSAT's placement season. MIT licensed.*
