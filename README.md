# The Placement Feed

A full-stack MERN application for tracking CHARUSAT CDPC campus placement drives. Public-read (anyone can browse/search/filter placement drives) and admin-write (single authenticated admin can manage entries).

## Tech Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | React 19, Vite, Tailwind CSS v3, React Router v6     |
| Backend    | Node.js, Express, Mongoose                           |
| Database   | MongoDB (local dev) / MongoDB Atlas (production)     |
| Auth       | JWT in httpOnly cookie, bcrypt                        |
| Deployment | Frontend → Vercel, Backend → Render                  |

## Features

- **Public Home Page** — Card grid of placements with filters (branch, status, CTC range), search (company/role), sort, and pagination
- **Detail View** — Full eligibility criteria, JD description, tags
- **Timeline** — Chronological view grouped by month
- **Admin Dashboard** — Add / edit / delete placements (protected)
- **Security** — Helmet, CORS, rate-limiting, CSRF checks, input sanitization, query validation

## Prerequisites

- Node.js 18+
- MongoDB (local instance or Atlas connection string)
- npm or yarn

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/MerLin027/ThePlacementFeed.git
cd ThePlacementFeed
```

### 2. Backend setup

```bash
cd server
cp ../.env.example .env    # Copy and edit with your values
npm install
npm run dev                 # Starts on http://localhost:5000
```

Create a `.env` file in the project root (or `server/` directory) with:

```
MONGODB_URI=mongodb://localhost:27017/placement-feed
JWT_SECRET=a-long-random-secret-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
COOKIE_SECRET=another-random-secret
NODE_ENV=development
CLIENT_URL=http://localhost:5173
PORT=5000
```

The server will automatically create the admin user on first startup using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values.

### 3. Frontend setup

```bash
cd client
cp .env.example .env       # Copy and edit
npm install
npm run dev                 # Starts on http://localhost:5173
```

Create a `.env` in `client/`:

```
VITE_API_URL=http://localhost:5000
```

## Environment Variables Reference

### Server (Render)

| Variable         | Description                                      | Required |
| ---------------- | ------------------------------------------------ | -------- |
| `MONGODB_URI`    | MongoDB Atlas connection string                  | ✅        |
| `JWT_SECRET`     | Secret for signing JWT tokens                    | ✅        |
| `ADMIN_USERNAME` | Admin login username                             | ✅        |
| `ADMIN_PASSWORD` | Admin login password                             | ✅        |
| `COOKIE_SECRET`  | Secret for signed cookies                        | ✅        |
| `NODE_ENV`       | Must be `production` on Render                   | ✅        |
| `CLIENT_URL`     | Your Vercel frontend URL (for CORS + CSRF)       | ✅        |
| `PORT`           | Port to listen on (Render sets this automatically)| ❌       |

### Client (Vercel)

| Variable       | Description                        | Required |
| -------------- | ---------------------------------- | -------- |
| `VITE_API_URL` | Your Render backend URL            | ✅        |

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repository
3. Set **Root Directory** to `server`
4. Set **Build Command** to `npm install`
5. Set **Start Command** to `npm start`
6. Add all server environment variables listed above
7. **Important:** Set `CLIENT_URL` to your actual Vercel deployment URL (e.g. `https://theplacementfeed.vercel.app`), **NOT** `http://localhost:5173`. CORS will block all requests otherwise.

### Frontend → Vercel

1. Import project on [Vercel](https://vercel.com)
2. Set **Root Directory** to `client`
3. Framework Preset should auto-detect as **Vite**
4. Add environment variable: `VITE_API_URL` = your Render backend URL (e.g. `https://theplacementfeed-api.onrender.com`)

### ⚠️ Cold Start Warning

Render's free tier spins down after 15 minutes of inactivity. The first request after idle may take **30–50 seconds** to respond while the server boots up. The app shows a friendly loading message during this time.

## Project Structure

```
ThePlacementFeed/
├── .env.example                # Server env template
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── index.js                # Express app entry point
│   ├── config/
│   │   ├── db.js               # MongoDB connection
│   │   └── seed.js             # Admin auto-seeding
│   ├── middleware/
│   │   ├── auth.js             # JWT cookie verification
│   │   ├── csrfCheck.js        # Origin/Referer CSRF check
│   │   ├── errorHandler.js     # Global error handler
│   │   └── validate.js         # express-validator rules
│   ├── models/
│   │   ├── Admin.js
│   │   └── Placement.js
│   └── routes/
│       ├── auth.js             # Login / logout / check
│       └── placements.js       # CRUD + filters + pagination
└── client/
    ├── .env.example            # Client env template
    ├── package.json
    ├── index.html
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        ├── api/
        │   └── axios.js        # Axios instance + 401 interceptor
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Layout/
        │   │   ├── Navbar.jsx
        │   │   └── Footer.jsx
        │   ├── BranchSelect.jsx
        │   ├── ColdStartLoader.jsx
        │   ├── ConfirmDialog.jsx
        │   ├── FilterBar.jsx
        │   ├── Modal.jsx
        │   ├── Pagination.jsx
        │   ├── PlacementCard.jsx
        │   ├── PlacementForm.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── StatusBadge.jsx
        │   └── TagInput.jsx
        └── pages/
            ├── AdminDashboard.jsx
            ├── AdminLogin.jsx
            ├── Home.jsx
            ├── PlacementDetail.jsx
            └── Timeline.jsx
```

## License

MIT
