const cron = require('node-cron');
const { runStatusTransitionJob, ensureStatusesFresh } = require('../drives/freshness');

// The daily status job at 00:05 IST, plus a catch-up run at startup. Render's free tier sleeps
// through midnight, so drive reads also refresh on demand (drives/freshness.js) and an external
// scheduler can call GET /api/cron/trigger.
const initCronJobs = () => {
  console.log('[Cron] Initializing cron jobs...');
  cron.schedule('5 0 * * *', () => {
    runStatusTransitionJob().catch((err) => console.error('[Cron] Scheduled job failed:', err));
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  console.log('[Cron] Running startup catch-up job...');
  ensureStatusesFresh()
    .then(() => console.log('[Cron] Startup catch-up job finished.'))
    .catch((err) => console.error('[Cron] Startup catch-up job failed:', err));
};

module.exports = { initCronJobs };
