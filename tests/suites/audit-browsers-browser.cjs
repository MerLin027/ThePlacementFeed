// Audit 2026-10-28, Phase 2: the site in the three browser engines (Chromium, Firefox, WebKit) at
// desktop and phone width: public pages load without script errors or sideways scrolling, the
// login help swap works, a student signs in and opens the apply dialog, staff reach the dashboard
// and the Team page. Skips an engine that isn't installed (tests/lib/install-browser.cjs installs
// Chromium; `playwright install firefox webkit` adds the others).
const TEST = require('../lib/env.cjs');
const { settled } = require('../lib/wait.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const path = require('path');
const fs = require('fs');
const playwright = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const APP = TEST.APP;
const API = TEST.API;
const TAG = `xb${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const J = (c) => ({ 'Content-Type': 'application/json', Origin: APP, ...(c ? { Cookie: c } : {}) });
const cookieOf = (res) => (res.headers.getSetCookie().find((c) => c.startsWith('tpf_session=') && !c.startsWith('tpf_session=;')) || '').split(';')[0];
const installed = (engine) => {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  return !dir || fs.readdirSync(dir).some((d) => d.startsWith(engine === 'chromium' ? 'chromium' : engine));
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  let driveId;
  try {
    const admin = cookieOf(await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) }));
    driveId = (await (await fetch(API + '/api/admin/drives', { method: 'POST', headers: J(admin), body: JSON.stringify({ company: `${TAG} Corp`, role: 'Engineer', type: 'Full-Time', ctc: 7, applicationMode: 'in_app', deadline: istDate(4), driveDate: istDate(9), jdDescription: '## About\n- One\n- Two' }) })).json()).data._id;
    const s = cookieOf(await fetch(API + '/api/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email: `${TAG}s@example.com`, rollNumber: `${TAG}S1`.toUpperCase(), password: 'browsers-student-1' }) }));
    await chooseInstitute(s);
    await fetch(API + '/api/student/profile', { method: 'PATCH', headers: J(s), body: JSON.stringify({ firstName: 'Ira', lastName: 'Sen', branch: 'CE', cgpa: 8, activeBacklogs: 0, graduationYear: 2027, phone: '9876543210', resumeUrl: 'https://example.com/cv.pdf' }) });

    for (const engine of ['chromium', 'firefox', 'webkit']) {
      if (!installed(engine)) {
        console.log(`# ${engine}: not installed, skipped`);
        continue;
      }
      const browser = await playwright[engine].launch();
      for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const name = `${engine} ${label}`;
        console.log(`# ${name}`);
        const ctx = await browser.newContext({ viewport });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));

        const routes = [['home', '/'], ['timeline', '/timeline'], ['drive', `/placement/${driveId}`], ['login', '/login'], ['signup', '/signup'], ['404', '/nope']];
        const wide = [];
        for (const [what, route] of routes) {
          await page.goto(APP + route);
          await settled(page);
          await page.locator('h1').first().waitFor({ timeout: 10000 }).catch(() => {});
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (overflow > 0) wide.push(`${what} +${overflow}px`);
          if (!(await page.locator('h1').first().isVisible())) wide.push(`${what}: no heading`);
        }
        ok(wide.length === 0, `${name}: public pages load, each with its heading, none wider than the screen`, wide.join(', '));

        await page.goto(APP + '/login');
        await page.getByRole('button', { name: 'Trouble logging in?' }).click();
        ok(await page.getByRole('heading', { name: 'Trouble Logging In?' }).isVisible(), `${name}: the login help opens`);
        await page.getByRole('button', { name: 'Back to log in' }).click();

        await page.fill('#identifier', `${TAG}s@example.com`);
        await page.fill('#password', 'browsers-student-1');
        await page.click('button[type=submit]');
        const signedIn = await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).then(() => true, () => false);
        ok(signedIn, `${name}: a student signs in (session cookie works)`);
        await page.goto(`${APP}/placement/${driveId}`);
        await page.getByRole('button', { name: /^Apply/ }).first().click();
        ok(await page.getByRole('dialog').isVisible(), `${name}: the apply dialog opens`);
        await page.keyboard.press('Escape');
        await ctx.clearCookies();

        await page.goto(APP + '/login');
        await page.fill('#identifier', 'testadmin');
        await page.fill('#password', 'testadminpass');
        await page.click('button[type=submit]');
        ok(await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 }).then(() => true, () => false), `${name}: staff sign in to the dashboard`);
        await page.goto(APP + '/admin/team');
        ok(await page.getByRole('heading', { name: 'Team', exact: true }).isVisible({ timeout: 10000 }).catch(() => false) || await page.getByRole('heading', { name: 'Team', exact: true }).waitFor({ timeout: 10000 }).then(() => true, () => false), `${name}: the Team page renders`);
        const teamOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        ok(teamOverflow <= 0, `${name}: the Team page fits the screen`, `+${teamOverflow}px`);
        ok(errors.length === 0, `${name}: no script errors`, errors.join(' | '));
        await ctx.close();
      }
      await browser.close();
    }
  } finally {
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: studs.map((x) => x._id) } });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    if (driveId) await Placement.deleteOne({ _id: driveId });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
