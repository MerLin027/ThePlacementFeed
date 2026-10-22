// Get the start of the current day in IST, represented as a UTC midnight Date.
// This aligns with how <input type="date"> saves dates into MongoDB (as UTC midnight),
// so a deadline of "25 Oct" stays open for the whole of 25 Oct in India.
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const date = istTime.getUTCDate();

  return new Date(Date.UTC(year, month, date));
}

module.exports = { getStartOfTodayIST };
