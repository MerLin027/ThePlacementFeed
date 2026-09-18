require('dotenv').config();

// --- Fail fast if required env vars are missing ---
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'COOKIE_SECRET',
  'CLIENT_URL',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `FATAL: Missing required environment variables: ${missing.join(', ')}`
  );
  console.error('Please check your .env file or environment configuration.');
  process.exit(1);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const seedAdmin = require('./config/seed');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const placementRoutes = require('./routes/placements');

const app = express();

// Trust first proxy (Render sits behind a reverse proxy)
app.set('trust proxy', 1);

// --- Security middleware ---
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// --- Body parsing & sanitization ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize());

// --- Logging ---
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/placements', placementRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// External cron trigger — allows an external scheduler (e.g. cron-job.org, Render cron)
// to invoke the status-transition job via HTTP.
// Protected by a shared CRON_SECRET bearer token set in the server environment.
// This is the recommended approach for Render instances that sleep at midnight and therefore
// never fire the node-cron schedule. The job is idempotent and safe to call multiple times.
// Rate limit cron trigger: 10 requests per 15 minutes per IP
const cronLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many cron trigger attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/cron/trigger', cronLimiter, async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret is configured, disable the endpoint entirely
    return res.status(503).json({ success: false, message: 'Cron endpoint is not configured.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { runStatusTransitionJob } = require('./jobs/statusCron');
    await runStatusTransitionJob();
    res.json({ success: true, message: 'Status transition job executed successfully.' });
  } catch (err) {
    console.error('[CronTrigger] Error executing status transition job:', err);
    res.status(500).json({ success: false, message: 'Status transition job failed.' });
  }
});

// --- Global error handler ---
app.use(errorHandler);

// --- Start server ---
const PORT = process.env.PORT || 5000;

const { initCronJobs } = require('./jobs/statusCron');

const startServer = async () => {
  try {
    await connectDB();
    await seedAdmin();
    
    // Initialize scheduled jobs
    initCronJobs();

    app.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
