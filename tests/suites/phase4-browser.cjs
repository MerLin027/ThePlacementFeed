// Phase 4 browser verification — admin Students page + full branch names. Local stack only.
const TEST = require('../lib/env.cjs');
const { logout } = require('../lib/logout.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));

const APP = TEST.APP;
const API = TEST.API;
const SHOTS = path.join(TEST.OUT, 'shots');
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const call = async (method, url, { body, cookie } = {}) => {
  const headers = { 'Content-Type': 'application/json', Origin: APP };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null), setCookie: res.headers.getSetCookie() };
};
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const noHorizontalScroll = (page) => page.evaluate(() => {
  const main = document.getElementById('main-content');
  return document.documentElement.scrollWidth <= window.innerWidth && main.scrollWidth <= main.clientWidth;
});

const TAG = `P4B${Date.now() % 100000}`;

(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  await mongoose.connect(TEST.MONGODB_URI);

  const mk = async (n, profile) => {
    const email = `${TAG.toLowerCase()}_${n}@example.com`;
    const r = await call('POST', '/api/auth/signup', { body: { email, rollNumber: `${TAG}${n}`, password: 'origpass123' } });
    const cookie = r.setCookie.find((c) => c.startsWith('tpf_session=')).split(';')[0];
    if (profile) await call('PATCH', '/api/student/profile', { cookie, body: profile });
    if (profile) await chooseInstitute(cookie);
    return { email, roll: `${TAG}${n}`.toUpperCase() };
  };
  const s1 = await mk('1', { firstName: 'Kavya', lastName: 'Joshi', branch: 'IT', graduationYear: 2026 });
  const s2 = await mk('2', { firstName: 'Nikhil', lastName: 'Desai', branch: 'EC', graduationYear: 2027 });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  console.log('# Student cannot reach the page');
  await page.goto(APP + '/login');
  await page.fill('#email', s1.email);
  await page.fill('#password', 'origpass123');
  await page.click('button[type=submit]');
  await page.waitForURL(APP + '/');
  ok(!(await page.locator('header nav').first().innerText()).includes('Students'), 'student nav has no Students link');
  await page.goto(APP + '/admin/students');
  ok(await page.waitForURL(/\/admin\/login/).then(() => true, () => false), 'student at /admin/students -> /admin/login');

  console.log('# Full branch names (student side)');
  await page.goto(APP + '/profile');
  await page.waitForSelector('#branch');
  const options = await page.locator('#branch option').allInnerTexts();
  ok(options.includes('Information Technology') && options.includes('Computer Engineering') && options.includes('Computer Science & Engineering') && !options.includes('IT'), 'profile branch select shows full names');
  ok((await page.locator('#branch').inputValue()) === 'IT', 'stored value is still the code');
  await page.goto(APP + '/');
  await page.click('button:has-text("Filters")').catch(() => {});
  const filterOptions = await page.locator('select:has(option:text("All Branches")) option').allInnerTexts().catch(() => []);
  ok(filterOptions.includes('Mechanical Engineering'), 'home branch filter shows full names', filterOptions.join('|'));
  await logout(page);

  console.log('# Admin Students page');
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  await page.click('header nav >> text=Students');
  await page.waitForURL(/\/admin\/students$/);
  await page.getByLabel('Search students').fill(TAG);
  const rowCount = () => page.locator('tbody tr').count();
  ok(await until(async () => (await rowCount()) === 2), 'search narrows to the 2 test students');
  ok(await hasText(page.locator('tbody'), 'Information Technology') && await hasText(page.locator('tbody'), 'Electronics & Communication Engineering'), 'table shows full branch names');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByLabel('Branch', { exact: true }).selectOption('EC');
  ok(await until(async () => (await rowCount()) === 1) && await hasText(page.locator('tbody'), 'Nikhil Desai'), 'branch filter');
  ok(new URL(page.url()).searchParams.get('branch') === 'EC', 'filter is kept in the URL');
  await page.getByLabel('Branch', { exact: true }).selectOption('');
  await until(async () => (await rowCount()) === 2);

  console.log('# Reset password dialog');
  const kavyaRow = page.locator('tbody tr', { hasText: 'Kavya Joshi' });
  await kavyaRow.getByRole('button', { name: 'Reset password' }).click();
  ok(await hasText(page, 'Reset password?'), 'reset dialog opens');
  ok((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Cancel', 'Cancel has initial focus');
  await page.keyboard.press('Escape');
  ok(!(await page.getByRole('alertdialog').count()), 'Escape closes dialog');
  await kavyaRow.getByRole('button', { name: 'Reset password' }).click();
  await page.screenshot({ path: path.join(SHOTS, 'admin-reset-dialog.png') });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset password' }).click();
  ok(await hasText(page, "Kavya Joshi's password was reset to the default"), 'success toast');
  ok(await hasText(kavyaRow, 'Password reset pending'), 'pending badge on row');
  ok((await Student.findOne({ email: s1.email }).lean()).mustChangePassword === true, 'DB flag set');

  console.log('# Delete dialog');
  const nikhilRow = page.locator('tbody tr', { hasText: 'Nikhil Desai' });
  await nikhilRow.getByRole('button', { name: 'Delete account' }).click();
  ok(await hasText(page, 'They can sign up again afterwards'), 'delete dialog explains consequences');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete account' }).click();
  ok(await hasText(page, "Nikhil Desai's account was deleted."), 'delete toast');
  ok(await until(async () => !(await page.locator('tbody tr', { hasText: 'Nikhil Desai' }).count())), 'row removed');
  ok(!(await Student.findOne({ email: s2.email })), 'student removed in DB');

  console.log('# Mobile layout');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // re-layout done
  ok(await noHorizontalScroll(page), 'no page-level horizontal scroll at 375px');
  const btn = await kavyaRow.getByRole('button', { name: 'Reset password' }).boundingBox();
  ok(btn && btn.width >= 39 && btn.height >= 39, `action button touch size ${btn && Math.round(btn.width)}x${btn && Math.round(btn.height)} (90% root font)`);
  await page.screenshot({ path: path.join(SHOTS, 'admin-students-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOTS, 'admin-students-desktop.png') });

  console.log('# Full branch names (admin drive form + detail)');
  await page.click('header nav >> text=Dashboard');
  await page.click('button:has-text("Add placement")');
  ok(await hasText(page, 'Biomedical Engineering') && await hasText(page, 'Artificial Intelligence & Machine Learning'), 'drive form branch picker shows full names');
  await page.getByText('Information Technology', { exact: true }).click();
  await page.getByText('Computer Engineering', { exact: true }).click();
  await page.getByPlaceholder('e.g. Google').fill(`${TAG} BranchCo`);
  await page.getByPlaceholder('e.g. SDE Intern').fill('Analyst');
  await page.getByPlaceholder('e.g. 12').fill('6');
  await page.screenshot({ path: path.join(SHOTS, 'admin-branch-picker.png'), fullPage: true });
  await page.click('button[type=submit]:has-text("Add placement")');
  const made = await until(() => Placement.findOne({ company: `${TAG} BranchCo` }).lean());
  ok(made && made.eligibility.branches.sort().join(',') === 'CE,IT', 'drive stores branch codes', JSON.stringify(made?.eligibility));
  await page.goto(`${APP}/placement/${made._id}`);
  ok(await hasText(page, 'Information Technology, Computer Engineering') || await hasText(page, 'Computer Engineering, Information Technology'), 'detail page lists full names');

  ok(consoleErrors.filter((e) => !/40[0-9]/.test(e)).length === 0, 'no unexpected console errors', consoleErrors.join('\n'));

  await Placement.deleteMany({ company: { $regex: `^${TAG}` } });
  await Student.deleteMany({ email: { $regex: `^${TAG.toLowerCase()}` } });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
