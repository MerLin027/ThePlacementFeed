const cron = require('node-cron');
const Placement = require('../models/Placement');
const { getStartOfTodayIST } = require('../utils/dates');
const { computeAutoStatus } = require('../utils/driveStatus');

const MAX_RECENT_CHANGES = 10;

// IST day (UTC-midnight timestamp) of the last successful run
let lastRunDay = null;
let inFlight = null;

/**
 * Brings every automated drive's status in line with its dates — in either
 * direction, so an extended deadline moves a drive back to Upcoming.
 * Skips drives whose status the admin pinned and drives that are postponed.
 * Idempotent: running it twice in a row changes nothing the second time.
 */
async function runStatusTransitionJob() {
  const today = getStartOfTodayIST();
  console.log('[Cron] Starting placement status transition job...');

  const candidates = await Placement.find({
    statusManuallySet: { $ne: true },
    isPostponed: { $ne: true },
    $or: [{ deadline: { $ne: null } }, { driveDate: { $ne: null } }],
  })
    .select('status deadline driveDate company')
    .lean();

  let changed = 0;
  for (const p of candidates) {
    const target = computeAutoStatus(p, today);
    if (!target || target === p.status) continue;

    // Conditional update: skip if an admin changed the drive since we read it
    const result = await Placement.updateOne(
      { _id: p._id, status: p.status, statusManuallySet: { $ne: true }, isPostponed: { $ne: true } },
      {
        $set: { status: target },
        $push: {
          recentChanges: {
            $each: [{ type: 'statusChange', status: target, changedAt: new Date() }],
            $slice: -MAX_RECENT_CHANGES,
          },
        },
      }
    );
    if (result.modifiedCount === 1) {
      changed += 1;
      console.log(`[Cron] ${p._id} (${p.company}): ${p.status} -> ${target}`);
    }
  }

  lastRunDay = today.getTime();
  console.log(`[Cron] Status transition job finished: ${changed} drive(s) updated.`);
  return changed;
}

/**
 * Runs the job once per IST day, on demand. Render's free tier sleeps through
 * midnight, so the scheduled run often never fires; calling this before serving
 * drive data guarantees statuses are current for the first request of the day.
 * Concurrent callers share one run.
 */
function ensureStatusesFresh() {
  if (lastRunDay === getStartOfTodayIST().getTime()) return Promise.resolve();
  if (!inFlight) {
    inFlight = runStatusTransitionJob().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Express middleware: refresh statuses before handling, but never block the request on failure
const freshStatuses = async (req, res, next) => {
  try {
    await ensureStatusesFresh();
  } catch (error) {
    console.error('[Cron] On-demand status refresh failed:', error.message);
  }
  next();
};

// Schedule the job once daily at 00:05 IST, plus a catch-up run at startup.
function initCronJobs() {
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
}

module.exports = { initCronJobs, runStatusTransitionJob, ensureStatusesFresh, freshStatuses };
