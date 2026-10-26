// Phase 2 browser + API verification against local throwaway server (5099) and Vite (5173).
const TEST = require('../lib/env.cjs');
const { logout } = require('../lib/logout.cjs');
const { until } = require('../lib/wait.cjs');
const { pickInstituteInUi } = require('../lib/institute.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Student = require(path.join(SERVER, 'src/models/Student'));

const APP = TEST.APP;
const API = TEST.API;
const SHOTS = path.join(TEST.OUT, 'shots');
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

const hasText = (page, t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
const navTexts = async (page) => (await page.locator('header nav').first().innerText()).replace(/\s+/g, ' ').trim();
const noHorizontalScroll = (page) => page.evaluate(() => {
  const main = document.getElementById('main-content');
  return document.documentElement.scrollWidth <= window.innerWidth && main.scrollWidth <= main.clientWidth;
});

(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  await mongoose.connect(TEST.MONGODB_URI);
  const email = `p2_${Date.now()}@example.com`;
  const roll = 'P2' + String(Date.now()).slice(-8);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  console.log('# Logged out');
  await page.goto(APP + '/');
  await page.waitForSelector('header nav');
  let nav = await navTexts(page);
  ok(nav.includes('Login') && nav.includes('Sign up') && !nav.includes('Dashboard') && !nav.includes('Profile'), 'nav shows Login/Sign up only', nav);
  await page.goto(APP + '/profile');
  ok(await page.waitForURL(/\/login\?returnTo=%2Fprofile/).then(() => true, () => false), '/profile logged out -> /login?returnTo=/profile');

  console.log('# Signup');
  await page.click('text=Create an account');
  await page.waitForURL(/\/signup\?returnTo=%2Fprofile/);
  await hasText(page, 'A quick heads-up');
  const body = await page.locator('main').innerText();
  ok(body.includes('A quick heads-up') && body.includes("can't be changed later"), 'mellow notice shown');
  ok(body.includes('This becomes your login') && body.includes('One account per roll number'), 'field helpers shown');
  const noticeClass = await page.locator('p', { hasText: 'A quick heads-up' }).first().getAttribute('class');
  ok(!/error|amber|red/.test(noticeClass), 'notice uses neutral (non-warning) styling', noticeClass);
  await page.fill('#email', email);
  await page.fill('#rollNumber', roll);
  await page.fill('#password', 'goodpass123');
  await page.fill('#confirmPassword', 'different1');
  await page.click('button[type=submit]');
  ok(await page.locator('#confirmPassword-error').isVisible(), 'mismatch error shown inline');
  ok((await page.getAttribute('#confirmPassword', 'aria-invalid')) === 'true', 'aria-invalid set');
  await page.screenshot({ path: path.join(SHOTS, 'signup-desktop.png'), fullPage: true });
  await page.fill('#confirmPassword', 'goodpass123');
  await page.click('button[type=submit]');
  ok(await page.waitForURL(/\/profile$/).then(() => true, () => false), 'signup -> /profile');
  nav = await navTexts(page);
  ok(nav.includes('My Applications') && !nav.includes('Profile') && !nav.includes('Log out') && !nav.includes('Sign up'), 'student nav (profile and log out are in the avatar menu)', nav);
  ok(await page.getByRole('button', { name: 'Your account' }).isVisible(), 'student avatar menu shown');
  // The avatar menu closes for good once you leave the page, even when you come back to it
  await page.goto(APP + '/');
  await page.getByRole('button', { name: 'Your account' }).click();
  const accountPanel = page.locator('header').getByRole('link', { name: 'Change password' });
  ok(await until(() => accountPanel.isVisible()), 'avatar menu opens');
  await page.locator('header').getByRole('link', { name: 'Profile' }).click();
  await page.waitForURL(/\/profile$/);
  await page.locator('header nav').getByRole('link', { name: 'Home' }).click();
  await page.waitForURL(APP + '/');
  await new Promise((r) => setTimeout(r, 400));
  ok(!(await accountPanel.isVisible()), 'avatar menu stays closed after Profile, then Home');
  await page.goto(APP + '/profile');

  console.log('# Profile');
  await page.waitForSelector('text=Finish your profile');
  ok(await page.locator('text=Still needed: First name, Last name, Institute, Branch, CGPA').isVisible(), 'completion banner lists missing fields');
  await pickInstituteInUi(page);
  ok(await hasText(page, roll), 'roll number shown (locked)');
  await page.fill('#firstName', 'Asha');
  await page.fill('#lastName', "D'Souza");
  await page.selectOption('#branch', 'CE');
  await page.fill('#graduationYear', '2026');
  await page.fill('#cgpa', '8.45');
  await page.fill('#phone', '98765 43210');
  await page.fill('#resumeUrl', 'http://insecure.example.com/cv.pdf');
  await page.click('button:has-text("Save profile")');
  await page.waitForSelector('#resumeUrl-error');
  ok((await page.locator('#resumeUrl-error').innerText()).includes('https'), 'server field error shown for http resume link');
  await page.fill('#resumeUrl', 'https://drive.google.com/file/d/abc/view');
  await page.click('button:has-text("Save profile")');
  await page.waitForSelector('text=Profile saved');
  ok(!(await page.locator('text=Finish your profile').count()), 'banner gone after complete profile');
  const dbStu = await Student.findOne({ email }).lean();
  ok(dbStu.phone === '9876543210' && dbStu.cgpa === 8.45 && dbStu.branch === 'CE', 'profile persisted & phone normalized');
  await page.setViewportSize({ width: 375, height: 800 });
  ok(await noHorizontalScroll(page), 'profile: no horizontal scroll at 375px');
  await page.screenshot({ path: path.join(SHOTS, 'profile-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Mass assignment via API with student cookie');
  const cookies = await ctx.cookies(API);
  const stuCookie = cookies.find((c) => c.name === 'tpf_session');
  const cookieHeader = `tpf_session=${stuCookie.value}`;
  let r = await fetch(API + '/api/student/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: cookieHeader },
    body: JSON.stringify({ email: 'hacker@x.com', rollNumber: 'HACK1', mustChangePassword: true, tokenVersion: 5, passwordHash: 'x', firstName: 'Asha' }),
  });
  const after = await Student.findOne({ email }).select('+passwordHash').lean();
  ok(r.status === 200 && after.email === email && after.rollNumber === roll && !after.mustChangePassword && after.tokenVersion === undefined && after.passwordHash.startsWith('$2'), 'protected fields untouched by PATCH');
  r = await fetch(API + '/api/student/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: cookieHeader },
    body: JSON.stringify({ cgpa: 11, branch: 'XYZ', firstName: '<script>' }),
  });
  const bad = await r.json();
  ok(r.status === 400 && bad.errors.length === 3, 'invalid cgpa/branch/name rejected');
  r = await fetch(API + '/api/student/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: `${TEST.APP}.evil.com`, Cookie: cookieHeader },
    body: JSON.stringify({ firstName: 'X' }),
  });
  ok(r.status === 403, 'profile PATCH from lookalike origin -> 403');

  console.log('# A student on staff pages');
  await page.goto(APP + '/admin/dashboard');
  ok(await page.waitForURL(APP + '/').then(() => true, () => false), 'a signed-in student at /admin/dashboard is sent home');
  nav = await navTexts(page);
  ok(nav.includes('My Applications') && !nav.includes('Dashboard'), 'still the student navigation', nav);
  r = await fetch(API + '/api/admin/drives', { headers: { Cookie: cookieHeader, Origin: APP } });
  ok(r.status === 403, 'the API refuses staff data to a student session (403)');

  console.log('# Password change revokes old cookie');
  await page.goto(APP + '/profile');
  await page.click('text=Change password');
  await page.waitForURL(/\/change-password/);
  await page.fill('#currentPassword', 'wrongpass1');
  await page.fill('#newPassword', 'newpass1234');
  await page.fill('#confirmPassword', 'newpass1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#currentPassword-error');
  ok((await page.locator('#currentPassword-error').innerText()).includes('incorrect'), 'wrong current password shown inline');
  await page.fill('#currentPassword', 'goodpass123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/profile$/);
  r = await (await fetch(API + '/api/auth/session', { headers: { Cookie: cookieHeader } })).json();
  ok(r.authenticated === false, 'old student cookie revoked after password change');
  r = await page.evaluate(async (api) => (await (await fetch(api + '/api/auth/session', { credentials: 'include' })).json()).authenticated, API);
  ok(r === true, 'current browser session reissued and valid');

  console.log('# Logout + open-redirect guard');
  await logout(page); // from /profile, a student-only page
  await page.waitForURL(APP + '/');
  await new Promise((r) => setTimeout(r, 600)); // the page guard must not bounce to the login page afterwards
  ok(page.url() === APP + '/', 'logging out on a student page lands on home, not the login page', page.url());
  await page.goto(APP + '/login?returnTo=//evil.com');
  await page.fill('#identifier', email);
  await page.fill('#password', 'newpass1234');
  await page.click('button[type=submit]');
  ok(await page.waitForURL((u) => u.origin === APP && u.pathname === '/').then(() => true, () => false), 'returnTo=//evil.com ignored -> /');
  await logout(page);
  await page.waitForURL(APP + '/');
  await page.goto(APP + '/login?returnTo=%2Fprofile');
  await page.fill('#identifier', email);
  await page.fill('#password', 'nottheone1');
  await page.click('button[type=submit]');
  await page.waitForSelector('[role=alert]');
  ok((await page.locator('[role=alert]').innerText()).includes('Invalid credentials'), 'login failure message');
  ok(await hasText(page, 'ask the CDPC admin to reset it'), 'forgot-password hint shown');

  console.log('# Admin-reset flow (simulated in DB)');
  await Student.updateOne({ email }, {
    passwordHash: await bcrypt.hash('college123', 12),
    mustChangePassword: true,
    tempPasswordExpiresAt: new Date(Date.now() + 72 * 3600e3),
  });
  await page.fill('#password', 'college123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/change-password/);
  ok(await hasText(page, 'reset by the CDPC admin'), 'reset login -> /change-password with explanation');
  await page.goto(APP + '/profile');
  ok(await page.waitForURL(/\/change-password/).then(() => true, () => false), 'restricted student bounced from /profile');
  r = await page.evaluate(async ({ api, origin }) => (await fetch(api + '/api/student/profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'X' }) })).status, { api: API, origin: APP });
  ok(r === 403, 'restricted session PATCH /me -> 403 server-side');
  ok(await page.locator('#currentPassword').count() === 0, 'reset form does not ask for the temporary password again');
  await page.fill('#newPassword', 'college123');
  await page.fill('#confirmPassword', 'college123');
  await page.click('button[type=submit]');
  ok(await page.waitForSelector('#newPassword-error').then(() => true, () => false), 'cannot keep the default password');
  await page.fill('#newPassword', 'mynewpass99');
  await page.fill('#confirmPassword', 'mynewpass99');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/profile$/);
  const unlocked = await Student.findOne({ email }).lean();
  ok(!unlocked.mustChangePassword && !unlocked.tempPasswordExpiresAt, 'flags cleared after change');

  console.log('# 401 interceptor redirect');
  await page.waitForSelector('button:has-text("Save profile")');
  // Revoke every session of the account (what a reset or a password change elsewhere does)
  const me = await Student.findOne({ email }).select('_id').lean();
  await mongoose.connection.collection('sessions').deleteMany({ accountId: me._id });
  await page.click('button:has-text("Save profile")');
  await page.waitForURL(/\/login\?expired=true/);
  ok(await hasText(page, 'session has expired'), 'expired student session -> /login?expired=true');
  await page.waitForTimeout(500); // deliberate: proves no further redirect follows
  ok(/\/login\?expired=true&returnTo=%2Fprofile$/.test(page.url()), 'URL stays on expired login with returnTo', page.url());
  ok(await hasText(page, 'session has expired'), 'expired message still visible after settle');

  console.log('# Admin 401 interceptor redirect');
  {
    const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
    const adminCookie = login.headers.getSetCookie()[0].split(';')[0];
    const created = await fetch(API + '/api/admin/drives', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: adminCookie }, body: JSON.stringify({ company: 'ExpiryCo', role: 'SDE', type: 'Full-Time', ctc: 5 }) });
    const placementId = (await created.json()).data._id;
    await page.goto(APP + '/login');
    await page.fill('#identifier', 'testadmin');
    await page.fill('#password', 'testadminpass');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/admin\/dashboard/);
    await page.waitForSelector('button[title="Mark as postponed"]');
    // Replace the admin cookie with a forged one so the next mutation is rejected
    await ctx.addCookies([{ name: 'tpf_session', value: 'forged.token.value', url: API }]);
    await page.locator('button[title="Mark as postponed"]').first().click();
    await page.waitForURL(/\/login\?expired=true/);
    await page.waitForTimeout(500); // deliberate: proves no further redirect follows
    ok(/\/login\?expired=true&returnTo=%2Fadmin%2Fdashboard$/.test(page.url()), 'staff URL stays on the expired login, coming back to the dashboard', page.url());
    ok(await hasText(page, 'session has expired'), 'staff expired message shown');
    await fetch(API + '/api/admin/drives/' + placementId, { method: 'DELETE', headers: { Origin: APP, Cookie: adminCookie } });
  }

  console.log('# Mobile signup page');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(APP + '/signup');
  ok(await noHorizontalScroll(page), 'signup: no horizontal scroll at 375px');
  const btn = await page.locator('button[type=submit]').boundingBox();
  ok(btn.height >= 44 * 0.9, `submit button touch height ${btn.height.toFixed(0)}px (html font-size 90%)`);
  await page.screenshot({ path: path.join(SHOTS, 'signup-mobile.png'), fullPage: true });
  await page.click('button[aria-label="Open menu"]');
  const mobileNav = await page.locator('header nav').last().innerText();
  ok(mobileNav.includes('Login') && mobileNav.includes('Sign up'), 'mobile menu mirrors links');

  ok(consoleErrors.filter((e) => !e.includes('401') && !e.includes('403') && !e.includes('400')).length === 0, 'no unexpected console errors', consoleErrors.join('\n'));

  await Student.deleteMany({ email: { $regex: /^p2_/ } });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); process.exit(2); });
