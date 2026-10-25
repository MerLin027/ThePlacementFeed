// Phase A browser checks — admin status control, closed external drives, branch copy. Local stack only.
const TEST = require('../lib/env.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PAB${Date.now() % 100000}`;

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const cookie = login.headers.getSetCookie()[0].split(';')[0];
  const mk = async (name, extra) => (await (await fetch(API + '/api/placements', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: cookie }, body: JSON.stringify({ company: `${TAG} ${name}`, role: 'SDE', type: 'Full-Time', ctc: 5, ...extra }) })).json()).data;
  const closedExt = await mk('ClosedExt', { formUrl: 'https://forms.gle/x', deadline: istDate(-1), driveDate: istDate(3) });
  const postponedExt = await mk('PostponedExt', { formUrl: 'https://forms.gle/y', deadline: istDate(4), driveDate: istDate(6), isPostponed: true });
  const openExt = await mk('OpenExt', { formUrl: 'https://forms.gle/z', deadline: istDate(4), driveDate: istDate(6) });
  const closedBoth = await mk('ClosedBoth', { formUrl: 'https://forms.gle/w', applicationMode: 'both', deadline: istDate(-1), driveDate: istDate(3) });

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  console.log('# Student-facing apply visibility');
  await page.goto(APP + '/');
  const card = (n) => page.locator('article', { hasText: `${TAG} ${n}` }).first();
  // Narrow to this test's drives (closing-soon order would push Ongoing ones past page 1 in a shared DB)
  await page.getByLabel('Search drives by company or role').fill(TAG);
  await card('OpenExt').waitFor();
  await until(async () => (await card('ClosedExt').count()) > 0 && (await card('PostponedExt').count()) > 0);
  ok((await card('ClosedExt').innerText()).includes('Deadline passed') && !(await card('ClosedExt').innerText()).includes('Apply now'), 'external drive past deadline: no Apply now (S7)');
  ok((await card('PostponedExt').innerText()).includes('Drive postponed'), 'postponed external drive: no Apply now');
  ok((await card('OpenExt').innerText()).includes('Apply now'), 'open external drive still shows Apply now');
  ok((await card('ClosedExt').innerText()).includes('All branches'), 'unrestricted drive says "All branches" (S8)');
  await page.goto(`${APP}/placement/${closedBoth._id}`);
  ok(await hasText(page, 'The application deadline for this drive has passed.'), "'both' drive past deadline explains why");
  ok(!(await page.getByText('Or apply through the external form').count()), 'no external alternative link once closed');

  console.log('# Admin status control');
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/);
  await page.click('button:has-text("Add placement")');
  ok((await page.locator('#placement-status').inputValue()) === 'auto', 'new drive defaults to Automatic');
  const dateInputs = page.locator('input[type=date]');
  await dateInputs.nth(0).fill(istDate(5));
  await dateInputs.nth(1).fill(istDate(-1));
  ok((await page.locator('#placement-status option[value=auto]').innerText()).includes('Ongoing'), 'Automatic option previews "Ongoing" for a past deadline');
  await page.getByPlaceholder('e.g. Google').fill(`${TAG} FormMade`);
  await page.getByPlaceholder('e.g. SDE Intern').fill('Analyst');
  await page.getByPlaceholder('e.g. 12').fill('4');
  await page.click('button[type=submit]:has-text("Add placement")');
  let made = await until(() => Placement.findOne({ company: `${TAG} FormMade` }).lean());
  ok(made && made.status === 'Ongoing' && made.statusManuallySet === false, 'saved as automatic Ongoing');
  const row = page.locator('tr', { hasText: `${TAG} FormMade` });
  await row.getByRole('button', { name: /^Edit / }).click();
  await page.selectOption('#placement-status', 'Upcoming');
  ok(await hasText(page, "Fixed — dates won't change it"), 'manual choice explains itself');
  await page.click('button[type=submit]:has-text("Update placement")');
  const findMade = () => Placement.findOne({ company: `${TAG} FormMade` }).lean();
  made = await until(async () => { const d = await findMade(); return d.statusManuallySet === true ? d : null; }) || await findMade();
  ok(made.status === 'Upcoming' && made.statusManuallySet === true, 'saved as fixed Upcoming');
  await row.getByRole('button', { name: /Use automatic status/ }).click();
  made = await until(async () => { const d = await findMade(); return d.statusManuallySet === false ? d : null; }) || await findMade();
  ok(made.status === 'Ongoing' && made.statusManuallySet === false, '"Use automatic status" restores and recomputes');
  // The row re-renders with the new status before the edit button is used again
  await row.getByRole('button', { name: /Use automatic status/ }).waitFor({ state: 'detached' }).catch(() => {});
  await row.getByRole('button', { name: /^Edit / }).click();
  ok((await page.locator('#placement-status').inputValue()) === 'auto', 'edit form reopens on Automatic');
  await page.click('button:has-text("Cancel")');

  await Placement.deleteMany({ company: { $regex: `^${TAG}` } });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
