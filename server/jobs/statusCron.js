const cron = require('node-cron');
const Placement = require('../models/Placement');

// Get the start of the current day in IST, represented as a UTC midnight Date
// This aligns with how <input type="date"> saves dates into MongoDB (as UTC midnight)
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const date = istTime.getUTCDate();

  return new Date(Date.UTC(year, month, date));
}

async function runStatusTransitionJob() {
  console.log('[Cron] Starting placement status transition job...');
  try {
    const today = getStartOfTodayIST();
    
    // 1. Log warnings for anomalous data (deadline > driveDate)
    const anomalousPlacements = await Placement.find({
      deadline: { $exists: true, $ne: null },
      driveDate: { $exists: true, $ne: null },
      $expr: { $gt: ['$deadline', '$driveDate'] },
    });

    for (const p of anomalousPlacements) {
      console.warn(`[Cron] WARNING: Placement ID ${p._id} (${p.company}) has deadline (${p.deadline.toISOString()}) after driveDate (${p.driveDate.toISOString()}). Data entry error, skipping automation.`);
    }

    const anomalousIds = anomalousPlacements.map(p => p._id);

    // 2. Upcoming -> Ongoing
    // Triggered when deadline passes, OR if deadline missing, when driveDate passes.
    const upcomingToOngoing = await Placement.find({
      status: 'Upcoming',
      statusManuallySet: { $ne: true },
      _id: { $nin: anomalousIds },
      $or: [
        { deadline: { $lt: today, $ne: null } },
        { 
          $and: [
            { deadline: null },
            { driveDate: { $lt: today, $ne: null } }
          ]
        },
        { 
          $and: [
            { deadline: { $exists: false } },
            { driveDate: { $lt: today, $ne: null } }
          ]
        }
      ]
    });

    for (const p of upcomingToOngoing) {
      const oldStatus = p.status;
      p.status = 'Ongoing';
      await p.save();
      console.log(`[Cron] Transitioned Placement ID ${p._id} from ${oldStatus} to Ongoing at ${new Date().toISOString()}`);
    }

    // 3. Ongoing -> Completed
    // Triggered when driveDate passes. (If missing, it doesn't auto-trigger).
    const ongoingToCompleted = await Placement.find({
      status: 'Ongoing',
      statusManuallySet: { $ne: true },
      _id: { $nin: anomalousIds },
      driveDate: { $lt: today, $ne: null }
    });

    for (const p of ongoingToCompleted) {
      const oldStatus = p.status;
      p.status = 'Completed';
      await p.save();
      console.log(`[Cron] Transitioned Placement ID ${p._id} from ${oldStatus} to Completed at ${new Date().toISOString()}`);
    }

    console.log('[Cron] Placement status transition job completed successfully.');
  } catch (error) {
    console.error('[Cron] Error running status transition job:', error);
  }
}

// Schedule the job to run once daily at 00:05 IST
// node-cron supports timezone option.
function initCronJobs() {
  console.log('[Cron] Initializing cron jobs...');
  // Runs every day at 00:05 in Asia/Kolkata
  cron.schedule('5 0 * * *', runStatusTransitionJob, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  // Optionally run once on startup to catch up immediately if missed
  runStatusTransitionJob();
}

module.exports = { initCronJobs, runStatusTransitionJob };
