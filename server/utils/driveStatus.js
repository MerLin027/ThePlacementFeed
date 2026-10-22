const { getStartOfTodayIST } = require('./dates');

const toTime = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * The status a drive should have purely from its dates, in whole IST days
 * (dates are stored as UTC midnight, matching <input type="date">):
 *
 *   Completed — the drive date has passed
 *   Ongoing   — applications have closed (deadline passed) or it's drive day
 *   Upcoming  — otherwise
 *
 * Returns null when the drive has no dates at all (nothing to go on).
 */
const computeAutoStatus = ({ deadline, driveDate }, today = getStartOfTodayIST()) => {
  const now = today.getTime();
  const dl = toTime(deadline);
  const dd = toTime(driveDate);

  if (dl === null && dd === null) return null;
  if (dd !== null && dd < now) return 'Completed';
  if ((dl !== null && dl < now) || (dd !== null && dd <= now)) return 'Ongoing';
  return 'Upcoming';
};

// Automation only applies when the admin hasn't pinned a status and the drive isn't postponed
const isAutomated = (drive) => !drive.statusManuallySet && !drive.isPostponed;

/**
 * Sets drive.status from its dates when automation applies.
 * Returns true if the status changed. Works on Mongoose docs and plain objects.
 */
const applyAutoStatus = (drive, today = getStartOfTodayIST()) => {
  if (!isAutomated(drive)) return false;
  const target = computeAutoStatus(drive, today);
  if (!target || target === drive.status) return false;
  drive.status = target;
  return true;
};

module.exports = { computeAutoStatus, isAutomated, applyAutoStatus };
