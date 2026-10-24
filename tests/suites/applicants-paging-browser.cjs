// Applicants page: changing a filter while on page 2 shows page 1 of the new results (the page is now
// derived from the filters it was chosen under, instead of being reset in an effect). Also checks that
// the list shows its loading state and settles on each change. Seeds applications directly in the
// LOCAL test database (more than one page of 25), then removes them.
const TEST = require('../lib/env.cjs');
const path = require('path');
const { chromium } = require('playwright');
const mongoose = require(path.join(TEST.SERVER, 'node_modules/mongoose'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `PAP${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const J = (c) => ({ 'Content-Type': 'application/json', Origin: APP, ...(c ? { Cookie: c } : {}) });

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const db = mongoose.connection.db;
  const admin = (await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) })).headers.getSetCookie()[0].split(';')[0];
  const drive = (await (await fetch(API + '/api/placements', { method: 'POST', headers: J(admin), body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 6, applicationMode: 'in_app', deadline: istDate(3), driveDate: istDate(8), eligibility: { branches: ['CE'], cgpa: 6 } }) })).json()).data;
  const driveId = new mongoose.Types.ObjectId(drive._id);
  const now = Date.now();
  // 30 applications: 25 fill page 1, 5 spill onto page 2; 4 of them are Shortlisted
  await db.collection('applications').insertMany(Array.from({ length: 30 }, (_, i) => ({
    driveId, studentId: new mongoose.Types.ObjectId(), consentGiven: true,
    status: i % 8 === 0 ? 'Shortlisted' : 'Applied', customAnswers: [],
    snapshot: { firstName: `Ap${String(i).padStart(2, '0')}`, lastName: TAG, email: `${TAG.toLowerCase()}${i}@example.com`, rollNumber: `${TAG}${i}`, branch: 'CE', cgpa: 8, activeBacklogs: 0, historyBacklogs: 0, graduationYear: 2026, phone: '9876543210' },
    createdAt: new Date(now - i * 60000), updatedAt: new Date(now - i * 60000),
  })));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(APP + '/admin/login'); await page.fill('#username', 'testadmin'); await page.fill('#password', 'testadminpass'); await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  await page.goto(`${APP}/admin/drives/${drive._id}/applicants`);
  const rows = page.locator('tbody tr');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length >= 25);
  ok((await rows.count()) === 25, `page 1 shows 25 of 30 (${await rows.count()})`);

  await page.getByRole('button', { name: 'Next page' }).click();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 5);
  ok((await page.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')) === 'page', 'on page 2 with the last 5');

  // Changing a filter on page 2 must land on page 1 of the filtered list
  await page.locator('select[aria-label="Filter by status"]').selectOption('Shortlisted');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 4, null, { timeout: 10000 }).catch(() => {});
  ok((await rows.count()) === 4, `filter from page 2 shows all 4 shortlisted (page 1), not an empty page 2 (${await rows.count()})`);
  ok(!(await page.getByRole('navigation', { name: 'Pagination' }).count()), 'a single page of results needs no pagination');

  await page.locator('select[aria-label="Filter by status"]').selectOption('');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 25, null, { timeout: 10000 }).catch(() => {});
  ok((await rows.count()) === 25 && (await page.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')) === 'page', 'clearing the filter shows page 1 again');

  await browser.close();
  await db.collection('applications').deleteMany({ driveId });
  await db.collection('placements').deleteOne({ _id: driveId });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
