// Start of today in IST as a UTC-midnight timestamp — the same convention the
// server uses for drive dates (saved from <input type="date"> as UTC midnight).
export const getStartOfTodayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
};

// Deadlines are whole days: open through the deadline date itself
export const isDeadlinePassed = (deadline) =>
  Boolean(deadline) && new Date(deadline).getTime() < getStartOfTodayIST();
