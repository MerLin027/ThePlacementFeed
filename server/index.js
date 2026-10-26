// Reads .env from the working directory on purpose (npm start / Render run in server/). The test
// runner starts the API from tests/output/, where no .env exists, so the real server/.env is never
// read during tests; an absolute path here would undo that.
require('dotenv').config({ quiet: true });

const { config } = require('./src/config/env');

// Fail fast: a bad configuration stops the server before it accepts a request
let settings;
try {
  settings = config();
} catch (error) {
  console.error(`FATAL: ${error.message}`);
  console.error('Please check your .env file or environment configuration.');
  process.exit(1);
}
settings.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

const { connectDB, disconnectDB } = require('./src/config/db');
const seedAdmin = require('./src/features/auth/seed');
const catalog = require('./src/features/catalog/cache');
const { initCronJobs } = require('./src/features/cron/schedule');
const { createApp } = require('./src/app');

const start = async () => {
  try {
    await connectDB(settings.mongoUri);
    await seedAdmin();
    // Branches, institutes and the university name, cached for validation and labels
    await catalog.init();
    initCronJobs();
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }

  // Express 5 passes listen errors (e.g. EADDRINUSE) to this callback instead of throwing
  const server = createApp().listen(settings.port, (error) => {
    if (error) {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
    console.log(`Server running in ${settings.nodeEnv} mode on port ${settings.port}`);
  });

  // Render sends SIGTERM before replacing the instance: stop taking connections, let in-flight
  // requests finish (up to 10 s), then close the database connection
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

start();
