import { getStartOfTodayIST } from './dates';

// Mirror of server/utils/driveStatus.js — used only to preview the automatic
// status in the admin form. The server computes the stored status.
const toTime = (value) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const computeAutoStatus = ({ deadline, driveDate }) => {
  const now = getStartOfTodayIST();
  const dl = toTime(deadline);
  const dd = toTime(driveDate);

  if (dl === null && dd === null) return null;
  if (dd !== null && dd < now) return 'Completed';
  if ((dl !== null && dl < now) || (dd !== null && dd <= now)) return 'Ongoing';
  return 'Upcoming';
};
