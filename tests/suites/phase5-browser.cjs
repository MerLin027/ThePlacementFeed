// Phase 5 browser verification — admin applicants page. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
// Reads the exports back; a test-only dependency (the server writes them with write-excel-file)
const ExcelJS = require('exceljs');
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const Placement = require(path.join(SERVER, 'models/Placement'));

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
const TAG = `P5B${Date.now() % 100000}`;

(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  await mongoose.connect(TEST.MONGODB_URI);

  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const adminApi = r.setCookie[0].split(';')[0];
  r = await call('POST', '/api/placements', { cookie: adminApi, body: { company: `${TAG} Acme`, role: 'Analyst', type: 'Full-Time', ctc: 9, applicationMode: 'in_app', driveDate: istDate(10), deadline: istDate(5), customPrompts: [{ question: 'Hometown?', required: true }] } });
  const drive = r.json.data;
  const people = [
    { n: 'a', firstName: 'Asha', lastName: 'Iyer', branch: 'CE', cgpa: 9.1 },
    { n: 'b', firstName: 'Bharat', lastName: 'Shah', branch: 'IT', cgpa: 7.4 },
    { n: 'c', firstName: 'Chirag', lastName: 'Modi', branch: 'IT', cgpa: 8.3 },
  ];
  const students = {};
  for (const p of people) {
    const email = `${TAG.toLowerCase()}_${p.n}@example.com`;
    const s = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber: `${TAG}${p.n}`, password: 'goodpass123' } });
    const cookie = s.setCookie.find((c) => c.startsWith('student_token=')).split(';')[0];
    await call('PATCH', '/api/students/me', { cookie, body: { firstName: p.firstName, lastName: p.lastName, branch: p.branch, cgpa: p.cgpa, activeBacklogs: 0, graduationYear: 2026, phone: '9000000002', resumeUrl: `https://example.com/${p.n}.pdf` } });
    await chooseInstitute(cookie);
    await call('POST', '/api/applications', { cookie, body: { driveId: drive._id, consentGiven: true, coverNote: p.n === 'a' ? '=HYPERLINK("http://evil.example","x") <script>alert(1)</script>' : 'Hi', customAnswers: [{ promptId: drive.customPrompts[0]._id, answer: 'Anand' }] } });
    students[p.n] = { email };
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  let dialogs = 0;
  page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });

  console.log('# Navigate from dashboard');
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  await page.locator('tr', { hasText: `${TAG} Acme` }).getByRole('link', { name: `Applicants for ${TAG} Acme` }).click();
  await page.waitForURL(new RegExp(`/admin/drives/${drive._id}/applicants$`));
  ok(await hasText(page, `${TAG} Acme · Analyst · 3 total`), 'header with drive + total');
  ok(await page.locator('tbody tr').count() === 3, '3 rows');
  ok(await hasText(page.locator('tbody'), 'Computer Engineering'), 'branch full name in table');

  console.log('# Inline status + stats');
  await page.getByLabel('Status for Asha Iyer').selectOption('Shortlisted');
  ok(await hasText(page, 'Asha marked as Shortlisted'), 'inline status toast');
  const rowCount = () => page.locator('tbody tr').count();
  ok(await until(async () => (await page.getByRole('button', { name: /^Shortlisted/ }).innerText()).includes('1')), 'Shortlisted chip count = 1');
  await page.getByRole('button', { name: /^Shortlisted/ }).click();
  ok(await until(async () => (await rowCount()) === 1 && (await page.getByRole('button', { name: /^Shortlisted/ }).getAttribute('aria-pressed')) === 'true'), 'chip filters list');
  await page.getByRole('button', { name: /^Shortlisted/ }).click();
  await until(async () => (await rowCount()) === 3);

  console.log('# Filters');
  await page.getByLabel('Filter by branch').selectOption('IT');
  ok(await until(async () => (await rowCount()) === 2), 'branch filter');
  await page.getByLabel('Minimum CGPA').fill('8');
  ok(await until(async () => (await rowCount()) === 1) && await hasText(page.locator('tbody'), 'Chirag Modi'), 'CGPA filter');
  await page.getByLabel('Minimum CGPA').fill('');
  await page.getByLabel('Filter by branch').selectOption('');
  await page.getByLabel('Search applicants').fill(`${TAG}b`);
  ok(await until(async () => (await rowCount()) === 1) && await hasText(page.locator('tbody'), 'Bharat Shah'), 'search');
  await page.getByLabel('Search applicants').fill('');
  await until(async () => (await rowCount()) === 3);

  console.log('# Bulk update');
  await page.getByLabel('Select Bharat Shah').check();
  await page.getByLabel('Select Chirag Modi').check();
  ok(await hasText(page, '2 selected'), 'bulk bar shows count');
  await page.selectOption('#bulk-status', 'Interviewing');
  await page.getByRole('region', { name: 'Bulk actions' }).getByRole('button', { name: 'Apply' }).click();
  ok(await hasText(page, '2 applicants set to Interviewing'), 'bulk toast');
  ok(await until(async () => (await Application.countDocuments({ driveId: drive._id, status: 'Interviewing' })) === 2), 'DB: 2 interviewing');
  ok(await until(async () => !(await page.getByText('selected', { exact: false }).count())), 'selection cleared after update');

  console.log('# Details modal');
  await page.getByLabel('View application from Asha Iyer').click();
  ok(await hasText(page, 'Answers') && await hasText(page, 'Hometown?'), 'answers shown');
  ok(await hasText(page, '=HYPERLINK("http://evil.example","x") <script>alert(1)</script>'), 'student note rendered as literal text');
  ok(dialogs === 0, 'no script executed');
  const resume = page.getByRole('link', { name: 'Open resume' });
  ok((await resume.getAttribute('rel')).includes('noopener') && (await resume.getAttribute('href')) === 'https://example.com/a.pdf', 'resume link safe');
  await page.fill('#applicant-note', 'Call for round 2');
  await page.selectOption('#applicant-status', 'Offered');
  await page.screenshot({ path: path.join(SHOTS, 'applicant-details.png') });
  await page.click('button:has-text("Save changes")');
  ok(await hasText(page, 'Changes saved'), 'details saved toast');
  const asha = await Application.findOne({ driveId: drive._id, 'snapshot.firstName': 'Asha' }).lean();
  ok(asha.status === 'Offered' && asha.adminNote === 'Call for round 2', 'DB: status + note');

  console.log('# Export download');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export to Excel")'),
  ]);
  const file = path.join(SHOTS, 'export.xlsx');
  await download.saveAs(file);
  ok(/^applicants-P5B\d+-Acme-\d{4}-\d{2}-\d{2}\.xlsx$/.test(download.suggestedFilename()), `download filename ${download.suggestedFilename()}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  ok(wb.getWorksheet('Applicants').rowCount === 4, 'downloaded workbook has 3 applicants');

  console.log('# Student sees the update');
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const spage = await sctx.newPage();
  await spage.goto(APP + '/login');
  await spage.fill('#email', students.a.email);
  await spage.fill('#password', 'goodpass123');
  await spage.click('button[type=submit]');
  await spage.waitForURL(APP + '/');
  await spage.goto(`${APP}/placement/${drive._id}`);
  ok(await hasText(spage, "You've applied") && await hasText(spage, 'Offered'), 'student detail shows Offered');
  ok(!(await spage.getByText('Call for round 2').count()), 'admin note not shown to student');
  await sctx.close();

  console.log('# Mobile + access');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // re-layout done
  ok(await noHorizontalScroll(page), 'no page-level horizontal scroll at 375px');
  await page.screenshot({ path: path.join(SHOTS, 'applicants-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(SHOTS, 'applicants-desktop.png') });
  await page.goto(`${APP}/admin/drives/507f1f77bcf86cd799439011/applicants`);
  ok(await hasText(page, "This drive doesn't exist or was deleted."), 'unknown drive message');

  ok(consoleErrors.filter((e) => !/40[0-9]/.test(e)).length === 0, 'no unexpected console errors', consoleErrors.join('\n'));

  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $regex: `^${TAG.toLowerCase()}` } });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
