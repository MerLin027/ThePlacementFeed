// Phase B verification — notification system. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium, devices } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PB${Date.now() % 100000}`;

let admin;
const call = async (method, url, body) => {
  const res = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: admin }, body: body ? JSON.stringify(body) : undefined });
  return res.json().catch(() => null);
};
const mkDrive = async (name, extra = {}) => (await call('POST', '/api/placements', { company: `${TAG} ${name}`, role: 'Analyst', type: 'Full-Time', ctc: 5, deadline: istDate(4), driveDate: istDate(8), ...extra })).data;
// Waiting on the poll itself instead of a fixed sleep: run `action` and wait for the request it
// triggers (drive changes, and/or the student's application summary). The short pause after the
// response is deliberate: it lets the toast render, and the "no toast" checks rely on it.
const isChanges = (r) => r.url().includes('/api/placements/changes');
const isSummary = (r) => r.url().includes('/api/applications/my/summary');
const RENDER_MS = 300;
const afterPoll = async (page, action, { changes = true, summary = false } = {}) => {
  const responses = [];
  if (changes) responses.push(page.waitForResponse(isChanges, { timeout: 15000 }));
  if (summary) responses.push(page.waitForResponse(isSummary, { timeout: 15000 }));
  await Promise.all([...responses, action()]);
  await wait(RENDER_MS);
};
// Force an immediate poll (the app polls on tab focus)
const focusTab = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const poll = (page, opts) => afterPoll(page, () => focusTab(page), opts);
const toastCount = (page, text) => page.locator('[role=status]', { hasText: text }).count();
const bellItems = async (page) => {
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await page.locator('[role=region][aria-label=Notifications]').waitFor();
  const items = await page.locator('[role=region][aria-label=Notifications] li').allInnerTexts();
  await page.keyboard.press('Escape');
  return items;
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  admin = login.headers.getSetCookie()[0].split(';')[0];
  await mkDrive('Existing');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Simulate leftovers from the old implementation + corrupt JSON
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('placement_notifications', '[{"id":"old"}]');
      localStorage.setItem('lastPollTime', '2020-01-01');
      localStorage.setItem('dismissedNotifIds', '{corrupt');
      localStorage.setItem('tpf:seenNotificationIds', '{corrupt');
    }
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'log') logs.push(m.text()); });

  console.log('# First visit is silent');
  await afterPoll(page, () => page.goto(APP + '/'));
  ok((await page.locator('[role=status]').filter({ hasText: /Welcome|New drive/ }).count()) === 0, 'no welcome / fake "new drive" toast');
  ok((await bellItems(page)).length === 0, 'bell empty on first visit');
  const legacy = await page.evaluate(() => ['placement_notifications', 'lastPollTime', 'dismissedNotifIds'].map((k) => localStorage.getItem(k)));
  ok(legacy.every((v) => v === null), 'legacy storage keys removed');
  ok(await page.evaluate(() => Boolean(localStorage.getItem('tpf:notificationCursor'))), 'cursor stored (server time)');

  console.log('# New drive -> exactly one notification, even with overlapping polls');
  const d1 = await mkDrive('Fresh');
  await afterPoll(page, () => page.evaluate(() => { for (let i = 0; i < 6; i++) document.dispatchEvent(new Event('visibilitychange')); }));
  ok((await toastCount(page, `New drive: ${TAG} Fresh`)) === 1, 'one toast despite 6 concurrent poll triggers');
  let items = await bellItems(page);
  ok(items.filter((t) => t.includes(`New drive: ${TAG} Fresh`)).length === 1, 'one bell item');
  ok(items[0].includes('just now') || items[0].includes('min ago'), 'time-ago label');
  ok(await page.getByRole('button', { name: /^Notifications/ }).getAttribute('aria-label') === 'Notifications', 'badge cleared after opening');

  console.log('# Status / postpone wording');
  await call('PUT', `/api/placements/${d1._id}`, { company: d1.company, role: d1.role, type: d1.type, ctc: d1.ctc, deadline: istDate(-1), driveDate: istDate(8), status: 'auto' });
  await poll(page);
  ok((await toastCount(page, `${TAG} Fresh is now Ongoing`)) === 1, 'status change says the new status');
  await call('PATCH', `/api/placements/${d1._id}/postpone`, { isPostponed: true });
  await poll(page);
  ok((await toastCount(page, `${TAG} Fresh has been postponed`)) === 1, 'postponed wording');
  const warnIcon = await page.locator('[role=status]', { hasText: 'has been postponed' }).locator('xpath=..').locator('.material-symbols-outlined').first().innerText();
  ok(warnIcon === 'pause_circle', 'Material icon instead of emoji');
  await call('PATCH', `/api/placements/${d1._id}/postpone`, { isPostponed: false });
  await poll(page);
  ok((await toastCount(page, `${TAG} Fresh is back on schedule`)) === 1, 'un-postponed wording');
  await call('PATCH', `/api/placements/${d1._id}/reset-status-automation`, { statusManuallySet: false });
  await poll(page);
  items = await bellItems(page);
  ok(!items.some((t) => /automation/i.test(t)), 'no admin-only "automation reset" noise');

  console.log('# Persistence, no repeat after reload');
  const before = (await bellItems(page)).length;
  await afterPoll(page, () => page.reload());
  ok((await page.locator('[role=status]').filter({ hasText: TAG }).count()) === 0, 'no toasts repeat after reload');
  ok((await bellItems(page)).length === before, `list persisted (${before})`);

  console.log('# Keyboard + ARIA');
  const bell = page.getByRole('button', { name: /^Notifications/ });
  await bell.click();
  ok((await bell.getAttribute('aria-expanded')) === 'true', 'aria-expanded true when open');
  await page.keyboard.press('Escape');
  ok((await bell.getAttribute('aria-expanded')) === 'false', 'Escape closes');
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Notifications')), 'focus returns to bell');

  console.log('# Second tab does not repeat toasts');
  const page2 = await ctx.newPage();
  await afterPoll(page2, () => page2.goto(APP + '/'));
  await mkDrive('TwoTabs');
  await poll(page);
  await poll(page2);
  const t1 = await toastCount(page, `New drive: ${TAG} TwoTabs`);
  const t2 = await toastCount(page2, `New drive: ${TAG} TwoTabs`);
  ok(t1 + t2 === 1, `toast shown in one tab only (${t1}+${t2})`);
  ok((await bellItems(page2)).some((t) => t.includes(`${TAG} TwoTabs`)), 'other tab still lists it');
  await page2.close();

  console.log('# Clear all sticks');
  await bell.click();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.keyboard.press('Escape');
  await afterPoll(page, () => page.reload());
  await poll(page);
  ok((await bellItems(page)).length === 0, 'cleared notifications never come back');

  console.log('# Touch device dismiss');
  const mctx = await browser.newContext({ ...devices['Pixel 7'] });
  const mpage = await mctx.newPage();
  await afterPoll(mpage, () => mpage.goto(APP + '/'));
  await mkDrive('Touch');
  await poll(mpage);
  await mpage.getByRole('button', { name: /^Notifications/ }).tap();
  const dismiss = mpage.getByRole('button', { name: `Dismiss: New drive: ${TAG} Touch` });
  const box = await dismiss.boundingBox();
  ok(box && box.width >= 40 && (await dismiss.isVisible()), `dismiss visible on touch (${box && Math.round(box.width)}px)`);
  await dismiss.tap();
  ok(await until(async () => !(await mpage.locator('[role=region][aria-label=Notifications]').getByText(`New drive: ${TAG} Touch`).count())), 'dismissed on tap');
  await afterPoll(mpage, () => mpage.reload());
  await poll(mpage);
  await mpage.getByRole('button', { name: /^Notifications/ }).tap();
  ok(!(await mpage.locator('[role=region][aria-label=Notifications]').getByText(`New drive: ${TAG} Touch`).count()), 'stays dismissed after reload');
  await mctx.close();

  console.log('# Student application status notifications');
  const inApp = await mkDrive('InApp', { applicationMode: 'in_app' });
  const email = `${TAG.toLowerCase()}_s@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S1`, password: 'goodpass123' }) });
  const sCookie = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie }, body: JSON.stringify({ firstName: 'Ira', lastName: 'Sen', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/i.pdf' }) });
  await chooseInstitute(sCookie);
  const ap = await (await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie }, body: JSON.stringify({ driveId: inApp._id, consentGiven: true }) })).json();
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp = await sctx.newPage();
  await sp.goto(APP + '/login');
  await sp.fill('#email', email);
  await sp.fill('#password', 'goodpass123');
  // Logging in is a client-side navigation: only the student's summary is fetched, not drive changes
  await afterPoll(sp, () => sp.click('button[type=submit]'), { changes: false, summary: true });
  await sp.waitForURL(APP + '/');
  ok((await sp.locator('[role=status]').filter({ hasText: 'Your application' }).count()) === 0, 'no notification for existing statuses on first load');
  await call('PATCH', `/api/placements/${inApp._id}/applicants/${ap.data.id}`, { adminNote: 'note only' });
  await poll(sp, { changes: false, summary: true });
  ok((await sp.locator('[role=status]').filter({ hasText: 'Your application' }).count()) === 0, 'admin note change is not announced');
  await call('PATCH', `/api/placements/${inApp._id}/applicants/${ap.data.id}`, { status: 'Shortlisted' });
  await poll(sp, { changes: false, summary: true });
  ok((await toastCount(sp, `Your application to ${TAG} InApp: Shortlisted`)) === 1, 'student told about Shortlisted');
  const sItems = await bellItems(sp);
  ok(sItems.some((t) => t.includes(`Your application to ${TAG} InApp: Shortlisted`)), 'in the bell too');
  await afterPoll(sp, () => sp.reload(), { summary: true });
  ok((await sp.locator('[role=status]').filter({ hasText: 'Your application' }).count()) === 0, 'not repeated after reload');
  await sctx.close();

  ok(logs.filter((l) => /NotifPoll|DIAG/.test(l)).length === 0, 'no diagnostic console.log output', logs.slice(0, 3).join(' | '));

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
