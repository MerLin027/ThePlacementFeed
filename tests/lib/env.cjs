// Shared paths and settings for the regression suites. Every suite talks to a LOCAL stack only:
// a throwaway MongoDB, the API started by run.mjs, and the Vite dev server. Never production.
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tests', 'output');

const MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/tpf_test';

// Refuse anything that is not a local database (the real server/.env points at Atlas)
const assertLocalDb = (uri = MONGODB_URI) => {
  const host = (uri.match(/^mongodb:\/\/(?:[^@/]*@)?([^:/?]+)/) || [])[1];
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host) || /\+srv/.test(uri)) {
    throw new Error(`Refusing to run against a non-local database: ${uri.replace(/\/\/[^@]*@/, '//***@')}`);
  }
  return uri;
};
assertLocalDb();

module.exports = {
  ROOT,
  SERVER: path.join(ROOT, 'server'),
  CLIENT: path.join(ROOT, 'client'),
  OUT,
  API: process.env.TEST_API_URL || 'http://localhost:5099',
  APP: process.env.TEST_APP_URL || 'http://localhost:5173',
  MONGODB_URI,
  assertLocalDb,
  // Same local server, another database name (for suites that need a scratch DB)
  dbUri: (name) => assertLocalDb(MONGODB_URI.replace(/\/[^/?]*(?=\?|$)/, `/${name}`)),
  // run.mjs writes the API server's output here; suites that check the log read it
  SERVER_LOG: process.env.TEST_SERVER_LOG || path.join(OUT, 'server.log'),
  AXE: require.resolve('axe-core/axe.min.js'),
  CRON_SECRET: process.env.CRON_SECRET_TEST || 'cron-test-secret',
};
