<div align="center">
  <img src="client/public/logo512.png" alt="The Placement Feed" width="180" />
  <h1>The Placement Feed</h1>
  <p>Placement drive tracker for CHARUSAT CDPC — browse, search, and manage campus drives.</p>

  [![Deployed on Vercel](https://img.shields.io/badge/deployed-vercel-black?logo=vercel)](https://theplacementfeed.vercel.app)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
</div>

---

**[theplacementfeed.vercel.app](https://theplacementfeed.vercel.app)** — Students can browse, filter, and search active/past placement drives. A single authenticated admin manages all drive entries from a protected dashboard.

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
| **Database** | MongoDB (local dev) / MongoDB Atlas (prod) | — |
| **Deployment** | Frontend → Vercel, Backend → Render | — |

---

## Features

- Browse, search, and filter placement drives by branch, status, CTC range, and keyword
- Drive detail pages with full JD rendered as Markdown (GFM + sanitized HTML)
- Selection process steps shown per drive (round name + description)
- Direct **Apply Now** link on drives that have a registration URL (`formUrl`)
- Timeline view — drives grouped chronologically by month
- Automatic status transitions (Upcoming → Ongoing → Completed) via daily cron at 00:05 IST; skipped if status was manually overridden
- Postponed-drive handling — toggle `isPostponed`; status automation resettable per drive
- Notification polling every 60 s via `GET /api/placements/changes` — toast alerts on new, edited, postponed, or status-changed drives; persisted in `localStorage`, synced across tabs
- Admin dashboard — create, edit, delete drives; protected by JWT in httpOnly cookie (3 h session)
- Security hardened: Helmet, CORS, rate-limiting, CSRF origin checks, input sanitization, ReDoS-safe search

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

**Client** (`client/.env`):

| Variable | Required |
|---|---|
| `VITE_API_URL` | ✅ |

The server auto-creates the admin account on first boot from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. After rotating credentials with `node scripts/resetAdmin.js`, those two vars can be dropped from the environment.

> **Render cold starts:** The free tier spins down after inactivity — first request may take 30–50 s. The app shows a loading state during this time.

---

## Structure

```
ThePlacementFeed/
├── client/                  # Vite + React frontend
│   ├── public/              # Static assets (logo, favicons)
│   └── src/
│       ├── api/             # Axios instance + 401 interceptor
│       ├── context/         # AuthContext, NotificationContext
│       ├── hooks/           # usePlacementsFetch
│       ├── components/
│       │   ├── Layout/      # Navbar, Footer
│       │   ├── Notifications/ # NotificationBell
│       │   └── ...          # FilterBar, PlacementCard, PlacementForm, etc.
│       └── pages/           # Home, PlacementDetail, Timeline, AdminDashboard, AdminLogin
└── server/                  # Express API
    ├── config/              # DB connection, admin seed
    ├── jobs/                # node-cron status transition job
    ├── middleware/          # Auth, CSRF, validation, error handler
    ├── models/              # Placement, Admin schemas
    ├── routes/              # /api/placements, /api/auth
    └── scripts/             # resetAdmin.js (credential rotation)
```

---

*A student project built as a practical tool for CHARUSAT's placement season. MIT licensed.*
