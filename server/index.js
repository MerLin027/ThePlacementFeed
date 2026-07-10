require('dotenv').config();

// --- Fail fast if required env vars are missing ---
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
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

// --- Global error handler ---
app.use(errorHandler);

// --- Start server ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedAdmin();

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
