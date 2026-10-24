// Waiting helpers for the browser suites: poll for the condition being checked instead of sleeping a
// fixed time (fixed sleeps are slow when generous and flaky when tight).
const { settleAnimations } = require('./settle.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Calls fn (sync or async) until it returns something truthy, or until the timeout; returns the last
// value, so it reads naturally inside an assertion: ok(await until(() => page.isVisible(…)), '…').
// Errors thrown by fn (element not there yet, page navigating) count as "not yet".
const until = async (fn, { timeout = 10000, every = 100 } = {}) => {
  const end = Date.now() + timeout;
  let last;
  for (;;) {
    try { last = await fn(); } catch { last = undefined; }
    if (last || Date.now() >= end) return last;
    await sleep(every);
  }
};

// The page has finished loading what it asked for and its entrance animations are done
const settled = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await settleAnimations(page).catch(() => {});
};

module.exports = { sleep, until, settled };
