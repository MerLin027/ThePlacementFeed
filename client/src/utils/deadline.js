import { getStartOfTodayIST } from './dates';

const DAY = 24 * 60 * 60 * 1000;

const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * How close an application deadline is, in whole IST days (deadlines are
 * stored as UTC midnight of the chosen date and stay open through that day).
 * tone: 'urgent' (today/tomorrow), 'soon' (within a week), 'normal', 'closed'.
 */
export const deadlineInfo = (deadline) => {
  if (!deadline) return null;
  const days = Math.round((new Date(deadline).getTime() - getStartOfTodayIST()) / DAY);
  if (days < 0) return { days, tone: 'closed', label: 'Applications closed' };
  if (days === 0) return { days, tone: 'urgent', label: 'Closes today' };
  if (days === 1) return { days, tone: 'urgent', label: 'Closes tomorrow' };
  if (days <= 7) return { days, tone: 'soon', label: `Closes in ${days} days` };
  return { days, tone: 'normal', label: `Closes ${shortDate(deadline)}` };
};

export const DEADLINE_TONE_CLASS = {
  urgent: 'bg-red-50 text-red-800 border-red-200',
  soon: 'bg-amber-50 text-amber-900 border-amber-200',
  normal: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
  closed: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
};

// "28 Oct 2026" for a UTC-midnight date without shifting the day
export const formatDay = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' }) : '—';

// Whether a drive date (UTC midnight) is before today in IST
export const isPastDay = (d) => Boolean(d) && new Date(d).getTime() < getStartOfTodayIST();
