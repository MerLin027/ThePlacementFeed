/**
 * The only module that reads process.env. The values are parsed and checked once, on first use;
 * index.js calls config() before anything else, so a bad configuration stops the server before it
 * accepts a request. Other modules call config() when they need a value (not at import time), so
 * models and helpers can be loaded on their own, e.g. by scripts and tests.
 */
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'COOKIE_SECRET', 'CLIENT_URL'];

let cached = null;

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const load = () => {
  const env = process.env;
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = env.NODE_ENV || 'development';
  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(env.PORT) || 5000,
    mongoUri: env.MONGODB_URI,
    // The website's origin: CORS and the CSRF Origin check compare against exactly this
    clientUrl: env.CLIENT_URL,
    clientOrigin: originOf(env.CLIENT_URL),
    jwtSecret: env.JWT_SECRET,
    // Shared with Vercel; see middleware/trustedProxy.js
    proxySecret: env.PROXY_SECRET || null,
    // Enables GET /api/cron/trigger for an external scheduler
    cronSecret: env.CRON_SECRET || null,
    // First boot only: creates the admin account when none exists
    adminSeed: { username: env.ADMIN_USERNAME || null, password: env.ADMIN_PASSWORD || null },
    defaultStudentPassword: env.DEFAULT_STUDENT_PASSWORD || 'college123',
  });
};

const config = () => {
  if (!cached) cached = load();
  return cached;
};

module.exports = { config };
