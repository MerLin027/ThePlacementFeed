// Dates in this app are whole days in India (IST, UTC+05:30). Drive dates and deadlines are stored
// as UTC midnight, which is how <input type="date"> saves them, so "25 Oct" stays open for the whole
// of 25 Oct in India.
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The start of the current IST day, as a UTC-midnight Date
const getStartOfTodayIST = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
};

// The real instants an IST calendar day (YYYY-MM-DD) starts and ends, for "joined/applied between" filters
const istDayStart = (day) => new Date(`${day}T00:00:00+05:30`);
const istDayEnd = (day) => new Date(istDayStart(day).getTime() + DAY_MS);

// Monday 00:00 IST of the week containing `date`, as a real instant
const istWeekStart = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const mondayIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday);
  return new Date(mondayIst - IST_OFFSET_MS);
};

module.exports = { DAY_MS, IST_OFFSET_MS, getStartOfTodayIST, istDayStart, istDayEnd, istWeekStart };
