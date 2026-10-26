/**
 * The only module that reads process.env. The values are parsed and checked once, on first use;
 * index.js calls config() before anything else, so a bad configuration stops the server before it
 * accepts a request. Other modules call config() when they need a value (not at import time), so
 * models and helpers can be loaded on their own, e.g. by scripts and tests.
 *
 * Fatal: a required value missing, or CLIENT_URL not a usable origin (https in production).
 * Warned about at startup: a secret shorter than 32 characters (it still works, but should be
 * replaced; refusing to start would take the site down over a fixable setting).
 */
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
const MIN_SECRET_LENGTH = 32;

let cached = null;

const parseOrigin = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
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
  const isProduction = nodeEnv === 'production';

  const client = parseOrigin(env.CLIENT_URL);
  if (!client) throw new Error('CLIENT_URL must be the website address, e.g. https://example.vercel.app');
  if (isProduction && client.protocol !== 'https:') throw new Error('CLIENT_URL must use https:// in production');

  const warnings = ['JWT_SECRET', 'PROXY_SECRET', 'CRON_SECRET']
    .filter((key) => env[key] && env[key].length < MIN_SECRET_LENGTH)
    .map((key) => `${key} is shorter than ${MIN_SECRET_LENGTH} characters; replace it with a longer random value.`);

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: Number(env.PORT) || 5000,
    mongoUri: env.MONGODB_URI,
    // The website's origin: CORS and the CSRF Origin check compare against exactly this
    clientUrl: env.CLIENT_URL,
    clientOrigin: client.origin,
    jwtSecret: env.JWT_SECRET,
    // Shared with Vercel; see middleware/trustedProxy.js
    proxySecret: env.PROXY_SECRET || null,
    // Enables GET /api/cron/trigger for an external scheduler
    cronSecret: env.CRON_SECRET || null,
    // First boot only: creates the admin account when none exists
    adminSeed: { username: env.ADMIN_USERNAME || null, password: env.ADMIN_PASSWORD || null },
    defaultStudentPassword: env.DEFAULT_STUDENT_PASSWORD || 'college123',
    warnings: Object.freeze(warnings),
  });
};

const config = () => {
  if (!cached) cached = load();
  return cached;
};

module.exports = { config };
