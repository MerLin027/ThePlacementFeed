// Installs the Chromium build that matches the pinned Playwright version into tests/.playwright-browsers
// (gitignored), instead of the machine-wide cache. run.mjs points the suites at the same folder.
const { execFileSync } = require('child_process');
const path = require('path');
const browsers = path.join(__dirname, '..', '.playwright-browsers');
execFileSync(process.execPath, [path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'), 'install', 'chromium'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers },
});
