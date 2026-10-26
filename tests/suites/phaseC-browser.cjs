// Phase C verification — frontend completeness. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { logout } = require('../lib/logout.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { until, settled } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PC${Date.now() % 100000}`;

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const mk = async (name) => (await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} ${name}`, role: 'Analyst', type: 'Full-Time', ctc: 5, applicationMode: 'in_app', deadline: istDate(4), driveDate: istDate(8) }) })).json()).data;
  const d1 = await mk('Alpha');
  const d2 = await mk('Beta');

  const email = `${TAG.toLowerCase()}_s@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S1`, password: 'goodpass123' }) });
  const sCookie = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  const SH = { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie };
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: SH, body: JSON.stringify({ firstName: 'Neel', lastName: 'Joshi', branch: 'IT', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/n.pdf' }) });
  await chooseInstitute(sCookie);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const loginStudent = async (pw = 'goodpass123') => {
    await page.goto(APP + '/login');
    await page.fill('#email', email);
    await page.fill('#password', pw);
    await page.click('button[type=submit]');
  };

  console.log('# My applications');
  await loginStudent();
  await page.waitForURL(APP + '/');
  ok((await page.locator('header nav').first().innerText()).includes('My Applications'), 'student nav has "My Applications"');
  await page.click('header nav >> text=My Applications');
  await page.waitForURL(/\/applications$/);
  ok(await hasText(page, 'No applications yet') && await hasText(page, 'Browse drives'), 'empty state with a way forward');
  await fetch(API + '/api/applications', { method: 'POST', headers: SH, body: JSON.stringify({ driveId: d1._id, consentGiven: true }) });
  const ap2 = await (await fetch(API + '/api/applications', { method: 'POST', headers: SH, body: JSON.stringify({ driveId: d2._id, consentGiven: true }) })).json();
  await fetch(`${API}/api/placements/${d2._id}/applicants/${ap2.data.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'Shortlisted' }) });
  await page.reload();
  ok(await hasText(page, `${TAG} Alpha`) && await hasText(page, `${TAG} Beta`), 'lists both applications');
  ok(await hasText(page.locator('li', { hasText: `${TAG} Beta` }), 'Shortlisted'), 'shows current status');
  await page.locator('li', { hasText: `${TAG} Alpha` }).getByRole('link').click();
  await page.waitForURL(new RegExp(`/placement/${d1._id}`));
  ok(await hasText(page, "You've applied"), 'links to the drive');

  console.log('# Deleted / bad drive links');
  await page.goto(`${APP}/placement/507f1f77bcf86cd799439011`);
  ok(await hasText(page, 'This drive is no longer available'), 'deleted drive: friendly message');
  ok(!(await page.getByText('Oops').count()), 'no "Oops!"');
  await page.goto(`${APP}/placement/not-an-id`);
  ok(await hasText(page, 'This drive is no longer available'), 'malformed id: same friendly message');
  await page.getByRole('button', { name: 'Browse drives' }).click();
  ok(await page.waitForURL(APP + '/').then(() => true, () => false), 'Browse drives goes home');

  console.log('# Forced reset wording');
  await logout(page);
  await page.waitForURL(APP + '/');
  await Student.updateOne({ email }, { passwordHash: await bcrypt.hash('college123', 12), mustChangePassword: true, tempPasswordExpiresAt: new Date(Date.now() + 72 * 3600e3), $inc: { tokenVersion: 1 } });
  await page.goto(APP + '/login');
  await page.getByText('Trouble logging in?').click(); // the reset hints sit in a disclosure
  ok(await hasText(page, 'Log in with the temporary password the admin gave you'), 'login page hint for reset students');
  await loginStudent('college123');
  await page.waitForURL(/\/change-password/);
  ok(await hasText(page, 'Set a new password to continue') && await hasText(page, 'Required before you can use your account'), 'title says it is required');
  ok(await hasText(page, "You won't need the temporary password again"), 'explains the temporary password is not asked for again');

  console.log('# Route matrix');
  const routes = ['/', '/timeline', '/login', '/signup', '/profile', '/applications', '/change-password', '/admin/login', '/admin/dashboard', '/admin/students', `/admin/drives/${d1._id}/applicants`, `/placement/${d1._id}`, '/nope'];
  // Where a route ends up after the session check and any redirect: waits (up to 5 s) for the expected
  // path, and returns wherever the page actually is, so a wrong redirect still fails the assertion
  const landing = async (route, expected) => {
    await page.goto(APP + route);
    await settled(page);
    if (expected) await until(() => new URL(page.url()).pathname === expected, { timeout: 5000 });
    return new URL(page.url()).pathname;
  };
  // Restricted (reset pending) student: every student page funnels to /change-password
  for (const r of ['/profile', '/applications']) ok((await landing(r, '/change-password')) === '/change-password', `restricted student ${r} -> /change-password`);
  await page.fill('#newPassword', 'brandnew789');
  await page.fill('#confirmPassword', 'brandnew789');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/profile$/);
  // Student
  const studentExpect = { '/profile': '/profile', '/applications': '/applications', '/change-password': '/change-password', '/admin/dashboard': '/admin/login', '/admin/students': '/admin/login', [`/admin/drives/${d1._id}/applicants`]: '/admin/login', '/login': '/', '/signup': '/profile' };
  for (const [r, exp] of Object.entries(studentExpect)) ok((await landing(r, exp)) === exp, `student ${r} -> ${exp}`);
  // Guest
  await page.goto(APP + '/');
  await logout(page);
  await until(async () => (await page.locator('header nav').first().innerText()).includes('Login'));
  const guestExpect = { '/profile': '/login', '/applications': '/login', '/change-password': '/login', '/admin/dashboard': '/admin/login', '/admin/students': '/admin/login', '/timeline': '/timeline', '/nope': '/nope' };
  for (const [r, exp] of Object.entries(guestExpect)) ok((await landing(r, exp)) === exp, `guest ${r} -> ${exp}`);
  ok(await hasText(page, 'Page not found') || await hasText(page, '404'), '404 page renders');
  // Admin
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/);
  for (const r of ['/admin/dashboard', '/admin/students', `/admin/drives/${d1._id}/applicants`]) ok((await landing(r, r)) === r, `admin ${r} reachable`);
  await landing('/admin/dashboard');
  ok((await page.locator('main').getByRole('button', { name: 'Log out' }).count()) === 0, 'no duplicate Log out inside the dashboard');
  ok((await page.locator('header nav').getByRole('button', { name: 'Log out' }).count()) === 0, 'no Log out in the admin nav links');
  await page.getByRole('button', { name: 'Admin account' }).click();
  ok(await page.locator('header').getByRole('button', { name: 'Log out' }).isVisible(), 'Log out is in the admin account menu');
  ok(await page.locator('header').getByRole('link', { name: 'Change password' }).isVisible(), 'Change password is in the admin account menu');
  await page.keyboard.press('Escape');

  console.log('# Every nav link resolves (no 404)');
  for (const role of ['admin']) {
    const links = await page.locator('header nav').first().locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const href of links) {
      await page.goto(APP + href);
      await settled(page);
      ok(!(await page.getByText('Page not found').count()), `${role} nav ${href} resolves`);
    }
  }

  // cleanup
  await Application.deleteMany({ driveId: { $in: [d1._id, d2._id] } });
  await Placement.deleteMany({ company: { $regex: `^${TAG}` } });
  await Student.deleteMany({ email });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
