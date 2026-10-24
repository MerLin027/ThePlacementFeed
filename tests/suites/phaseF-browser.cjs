// Phase F verification — admin pages. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const AXE = TEST.AXE;
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PF${Date.now() % 100000}`;

const axeScan = async (page, label) => {
  await settleAnimations(page);

  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'serious' || x.impact === 'critical')
    .map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  ok(v.length === 0, `axe clean: ${label}`, v.join('\n      '));
};
// Visible buttons/links-as-buttons/inputs/selects must be >= 44px (checkbox/radio excluded: they sit in 44px labels)
const smallTargets = (page, scope = 'main') => page.evaluate((sel) => {
  const root = document.querySelector(sel) || document;
  return [...root.querySelectorAll('button, a[title], input:not([type=checkbox]):not([type=radio]), select')]
    .filter((el) => el.offsetParent !== null && !el.closest('.sr-only') && !el.closest('.input-field'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5))
    .map(({ el, r }) => `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
}, scope);

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const pinned = (await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} Pinned`, role: 'Analyst', type: 'Full-Time', ctc: 5, deadline: istDate(3), driveDate: istDate(6), status: 'Ongoing', applicationMode: 'in_app' }) })).json()).data;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('tpf:notificationCursor', JSON.stringify(new Date().toISOString())); } catch {} });
  const page = await ctx.newPage();
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/);
  await page.getByLabel('Search drives').fill(TAG);
  await wait(1200);

  console.log('# Dashboard');
  const row = page.locator('tr', { hasText: `${TAG} Pinned` });
  ok(await hasText(row, 'Fixed status'), 'pinned drive shows "Fixed status"');
  let small = await smallTargets(page);
  ok(small.length === 0, 'dashboard targets >= 44px', small.join(', '));
  await axeScan(page, 'dashboard (desktop)');
  const postpone = row.getByRole('button', { name: `Postpone ${TAG} Pinned` });
  await postpone.focus();
  await page.keyboard.press('Enter');
  await wait(1200);
  ok(await page.evaluate(() => document.activeElement?.getAttribute('title') === 'Un-postpone'), 'keyboard focus stays on the toggle after postponing');
  ok((await Placement.findById(pinned._id).lean()).isPostponed === true, 'postponed in DB');
  await page.keyboard.press('Enter');
  await wait(1200);

  console.log('# Drive form');
  await page.getByRole('button', { name: 'Add placement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add placement' });
  await dialog.waitFor();
  for (const legend of ['Basics', 'Schedule', 'Eligibility', 'How students apply', 'Description', 'Selection process', 'Tags']) {
    ok(await dialog.locator('fieldset > legend', { hasText: legend }).count() === 1, `section "${legend}"`);
  }
  ok(await dialog.getByLabel('Company').isVisible() && await dialog.getByLabel('Role').isVisible() && await dialog.getByLabel('CTC (LPA)').isVisible(), 'fields are labelled');
  ok(await dialog.getByLabel('Drive date').isVisible() && await dialog.getByLabel('Application deadline').isVisible() && await dialog.getByLabel('Minimum CGPA').isVisible(), 'dates and eligibility labelled');
  await dialog.getByRole('button', { name: 'Add placement' }).click();
  await wait(300);
  ok(await hasText(dialog, 'Please fix the 3 highlighted fields below.'), 'error summary counts the problems');
  ok(await hasText(dialog, 'Enter the company name') && await hasText(dialog, 'Enter the role') && await hasText(dialog, 'Enter the CTC'), 'errors shown under each field');
  ok(await page.evaluate(() => document.activeElement?.id === 'pf-company'), 'focus moves to the first invalid field');
  await dialog.getByLabel('Company').fill(`${TAG} FormCo`);
  ok(!(await dialog.getByText('Enter the company name').count()), 'fixing a field clears its error');
  await dialog.getByLabel('Role').fill('Engineer');
  await dialog.getByLabel('CTC (LPA)').fill('8');
  await dialog.getByLabel('Drive date').fill(istDate(5));
  await dialog.getByLabel('Application deadline').fill(istDate(9));
  await dialog.getByLabel('Minimum CGPA').fill('11');
  await dialog.getByRole('button', { name: 'Add placement' }).click();
  await wait(300);
  ok(await hasText(dialog, 'The deadline must be on or before the drive date') && await hasText(dialog, 'CGPA must be between 0 and 10'), 'date order and CGPA range checked before sending');
  ok(await page.evaluate(() => document.activeElement?.id === 'pf-deadline'), 'focus on the first of those');
  await dialog.getByLabel('Application deadline').fill(istDate(2));
  await dialog.getByLabel('Minimum CGPA').fill('7');

  // Tags grow instead of overflowing
  const tagInput = dialog.getByLabel('Tags');
  for (const t of ['Pune', 'Bengaluru', 'Hybrid', 'Mass recruiter', 'Product', 'Service based', 'Night shift']) {
    await tagInput.fill(t);
    await tagInput.press('Enter');
  }
  const overflow = await dialog.locator('input#pf-tags').evaluate((el) => {
    const box = el.parentElement;
    return box.scrollHeight - box.clientHeight;
  });
  ok(overflow <= 1, `tag box grows with its tags (overflow ${overflow}px)`);
  await dialog.getByRole('button', { name: 'Remove tag Night shift' }).click();
  ok(!(await dialog.getByText('Night shift').count()), 'tags removable by labelled button');

  // A server-side field error lands under the right field
  await dialog.locator('input[name=applicationMode][value=in_app]').check();
  await dialog.getByRole('button', { name: 'Add question' }).click();
  await dialog.getByLabel('Question 1', { exact: true }).fill('Fine with Pune?');
  await page.route('**/api/placements', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Validation failed', errors: [{ field: 'customPrompts[0].question', message: 'Questions cannot exceed 500 characters' }] }) });
  });
  await dialog.getByRole('button', { name: 'Add placement' }).click();
  await wait(600);
  ok(await hasText(dialog, 'Questions cannot exceed 500 characters'), 'server error mapped to the question field');
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Question 1'), 'focus moved to that field');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  small = await smallTargets(page, '[role=dialog]');
  ok(small.length === 0, 'form targets >= 44px', small.join(', '));
  await axeScan(page, 'drive form');
  await dialog.getByRole('button', { name: 'Add placement' }).click();
  await wait(1500);
  const made = await Placement.findOne({ company: `${TAG} FormCo` }).lean();
  ok(made && made.tags.length === 6 && made.eligibility.cgpa === 7 && made.customPrompts[0].question === 'Fine with Pune?', 'drive saved with tags, eligibility and question');
  ok(!(await page.getByRole('dialog').count()), 'dialog closes on success');

  console.log('# Phone layout');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(600);
  ok(!(await page.locator('table').isVisible()), 'table hidden on phones');
  const card = page.locator('main ul[aria-label=Drives] li', { hasText: `${TAG} Pinned` });
  ok(await card.isVisible(), 'drive shown as a card');
  small = await smallTargets(page);
  ok(small.length === 0, 'phone dashboard targets >= 44px', small.join(', '));
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.getElementById('main-content').scrollWidth <= document.getElementById('main-content').clientWidth), 'no horizontal scroll');
  await page.screenshot({ path: path.join(TEST.OUT, 'shots', 'F-dashboard-mobile.png'), fullPage: true });
  await card.getByRole('button', { name: `Postpone ${TAG} Pinned` }).click();
  await wait(1200);
  ok((await Placement.findById(pinned._id).lean()).isPostponed === true, 'postpone works from the card');
  await axeScan(page, 'dashboard (phone)');
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Applicants and students pages');
  const email = `${TAG.toLowerCase()}@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S`, password: 'goodpass123' }) });
  const sc = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ firstName: 'Ira', lastName: 'Das', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/i.pdf' }) });
  await fetch(`${API}/api/placements/${pinned._id}/postpone`, { method: 'PATCH', headers: H, body: JSON.stringify({ isPostponed: false }) });
  await Placement.updateOne({ _id: pinned._id }, { status: 'Upcoming', statusManuallySet: false });
  const ap = await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ driveId: pinned._id, consentGiven: true }) });
  ok(ap.status === 201, 'seeded an application');
  await page.goto(`${APP}/admin/drives/${pinned._id}/applicants`);
  await wait(1500);
  small = await smallTargets(page);
  ok(small.length === 0, 'applicants page targets >= 44px', small.join(', '));
  const cb = await page.getByLabel('Select Ira Das').locator('xpath=..').boundingBox();
  ok(cb.width >= 43.5 && cb.height >= 43.5, `checkbox tap area ${Math.round(cb.width)}x${Math.round(cb.height)}`);
  await axeScan(page, 'applicants');
  await page.goto(`${APP}/admin/students`);
  await page.getByLabel('Search students').fill(TAG);
  await wait(1200);
  small = await smallTargets(page);
  ok(small.length === 0, 'students page targets >= 44px', small.join(', '));
  await axeScan(page, 'students');

  // cleanup
  const ids = (await Placement.find({ company: { $regex: `^${TAG}` } }).select('_id').lean()).map((d) => d._id);
  await Application.deleteMany({ driveId: { $in: ids } });
  await Placement.deleteMany({ _id: { $in: ids } });
  await Student.deleteMany({ email });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
