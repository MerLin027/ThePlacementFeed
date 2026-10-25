// Phase 3 browser verification — apply flow, button states, admin config. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute, pickInstituteInUi } = require('../lib/institute.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json, setCookie: res.headers.getSetCookie() };
};
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

const TAG = `P3B${Date.now() % 100000}`;
const COMPLETE = { firstName: 'Ravi', lastName: 'Patel', branch: 'CE', cgpa: 8, activeBacklogs: 0, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/ravi.pdf' };

const card = (page, company) => page.locator('article', { hasText: company }).first();
const noHorizontalScroll = (page) => page.evaluate(() => {
  const main = document.getElementById('main-content');
  return document.documentElement.scrollWidth <= window.innerWidth && main.scrollWidth <= main.clientWidth;
});

const login = async (page, email, password = 'goodpass123') => {
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
};

(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  await mongoose.connect(TEST.MONGODB_URI);

  // --- Seed drives and students via the API ---
  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const admin = r.setCookie[0].split(';')[0];
  const mk = async (name, overrides) => {
    const res = await call('POST', '/api/placements', {
      cookie: admin,
      body: { company: `${TAG} ${name}`, role: 'SDE', type: 'Full-Time', ctc: 10, driveDate: istDate(10), deadline: istDate(5), ...overrides },
    });
    if (res.status !== 201) throw new Error('drive ' + name + ' ' + JSON.stringify(res.json));
    return res.json.data;
  };
  const meOnly = await mk('MeOnly', { applicationMode: 'in_app', eligibility: { branches: ['ME'] } });
  const both = await mk('Both', { applicationMode: 'both', formUrl: 'https://forms.gle/both' });
  const ext = await mk('External', { formUrl: 'https://forms.gle/ext' });
  const inApp = await mk('InApp', {
    applicationMode: 'in_app',
    eligibility: { branches: ['CE', 'IT'], cgpa: 7, backlog: 0 },
    customPrompts: [{ question: 'Willing to relocate?', required: true }],
  });

  const signup = async (n, profile) => {
    const email = `${TAG.toLowerCase()}_${n}@example.com`;
    const s = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber: `${TAG}${n}`, password: 'goodpass123' } });
    const cookie = s.setCookie.find((c) => c.startsWith('student_token=')).split(';')[0];
    if (profile) await call('PATCH', '/api/students/me', { cookie, body: profile });
    if (profile) await chooseInstitute(cookie);
    return email;
  };
  const emailA = await signup('A', COMPLETE);
  const emailB = await signup('B');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const popups = [];
  ctx.on('page', (p) => popups.push(p));

  console.log('# Logged-out card states');
  await page.goto(APP + '/');
  await card(page, `${TAG} InApp`).waitFor();
  ok((await card(page, `${TAG} InApp`).innerText()).includes('Log in to apply'), 'in-app card: Log in to apply');
  ok((await card(page, `${TAG} External`).innerText()).includes('Apply now'), 'external card: Apply now');
  await card(page, `${TAG} External`).getByRole('button', { name: 'Apply now' }).click();
  await until(() => popups.some((p) => p.url().includes('forms.gle/ext')), { timeout: 5000 });
  ok(page.url() === APP + '/' && popups.some((p) => p.url().includes('forms.gle/ext')), 'external Apply opens form in new tab, page stays');
  for (const p of popups) await p.close().catch(() => {});

  console.log('# Login from card -> detail with form open');
  await card(page, `${TAG} InApp`).getByRole('button', { name: 'Log in to apply' }).click();
  await page.waitForURL(/\/login\?returnTo=/);
  ok(decodeURIComponent(page.url()).includes(`/placement/${inApp._id}?apply=1`), 'returnTo points at drive with apply=1');
  await login(page, emailA);
  await page.waitForURL(new RegExp(`/placement/${inApp._id}$`));
  ok(await hasText(page, `Apply to ${TAG} InApp`), 'apply form opened automatically after login');
  ok(await hasText(page, 'Shared from your profile') && await hasText(page.locator('form'), 'Ravi Patel'), 'profile summary shown');

  console.log('# Form validation + submit');
  await page.click('button:has-text("Submit application")');
  ok(await hasText(page, 'Please confirm to continue') && await hasText(page, 'This question needs an answer'), 'consent + required answer errors inline');
  await page.screenshot({ path: path.join(SHOTS, 'apply-modal-errors.png') });
  await page.getByLabel('Willing to relocate? *').fill('Yes, anywhere in Gujarat');
  await page.check('#apply-consent');
  await page.click('button:has-text("Submit application")');
  ok(await hasText(page, `Application sent to ${TAG} InApp`), 'success toast');
  ok(await hasText(page, "You've applied"), 'detail panel switches to applied state');
  ok(!(await page.getByText(`Apply to ${TAG} InApp`).count()), 'modal closed');
  const stuA = await Student.findOne({ email: emailA }).lean();
  const appA = await Application.findOne({ driveId: inApp._id, studentId: stuA._id }).lean();
  ok(appA && appA.customAnswers[0].answer === 'Yes, anywhere in Gujarat', 'application stored with answer');

  console.log('# Card states for an eligible CE student');
  await page.goto(APP + '/');
  await card(page, `${TAG} InApp`).waitFor();
  // The card's apply state settles once the student's applications have loaded
  ok(await until(async () => (await card(page, `${TAG} InApp`).innerText()).includes('Applied')), 'applied card shows Applied');
  ok((await card(page, `${TAG} MeOnly`).innerText()).includes('Not eligible'), 'ME-only card shows Not eligible');
  ok((await card(page, `${TAG} Both`).innerText()).includes('Apply now'), "'both' card shows Apply now");

  console.log('# Detail states');
  await page.goto(`${APP}/placement/${meOnly._id}`);
  ok(await hasText(page, 'This drive is open to Mechanical Engineering. Your branch is Computer Engineering.'), 'ineligible reason shown as text');
  ok(await page.getByRole('button', { name: 'Not eligible' }).isDisabled(), 'Not eligible button disabled');
  await page.goto(`${APP}/placement/${both._id}`);
  ok(await hasText(page, 'Or apply through the external form'), "'both' detail offers external alternative");
  const altHref = await page.getByText('Or apply through the external form').getAttribute('href');
  const altRel = await page.getByText('Or apply through the external form').getAttribute('rel');
  ok(altHref === 'https://forms.gle/both' && altRel.includes('noopener'), 'external alt link is safe');

  console.log('# Mobile apply modal');
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByRole('button', { name: 'Apply now' }).click();
  await hasText(page, `Apply to ${TAG} Both`);
  const modalBox = await page.locator('form:has(#apply-consent)').boundingBox();
  ok(modalBox.width <= 375, `modal fits 375px (${Math.round(modalBox.width)}px)`);
  ok(await noHorizontalScroll(page), 'no horizontal scroll with modal open');
  await page.screenshot({ path: path.join(SHOTS, 'apply-modal-mobile.png') });
  await page.keyboard.press('Escape');
  ok(!(await page.getByText(`Apply to ${TAG} Both`).count()), 'Escape closes modal');
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Incomplete profile -> complete -> form opens');
  await page.click('header nav >> text=Logout');
  await page.waitForURL(APP + '/');
  await page.goto(APP + '/login');
  await login(page, emailB);
  await page.waitForURL(APP + '/');
  await card(page, `${TAG} InApp`).waitFor();
  ok(await until(async () => (await card(page, `${TAG} InApp`).innerText()).includes('Complete profile to apply')), 'incomplete student card: Complete profile');
  await card(page, `${TAG} InApp`).getByRole('button', { name: 'Complete profile to apply' }).click();
  await page.waitForURL(/\/profile\?returnTo=/);
  await pickInstituteInUi(page);
  await page.fill('#firstName', 'Mira');
  await page.fill('#lastName', 'Shah');
  await page.selectOption('#branch', 'IT');
  await page.fill('#graduationYear', '2027');
  await page.fill('#cgpa', '7.5');
  await page.fill('#phone', '9123456780');
  await page.fill('#resumeUrl', 'https://example.com/mira.pdf');
  await page.click('button:has-text("Save profile")');
  await page.waitForURL(new RegExp(`/placement/${inApp._id}$`));
  ok(await hasText(page, `Apply to ${TAG} InApp`), 'after completing profile, form opens on the drive');
  await page.keyboard.press('Escape');

  console.log('# Admin: application settings + delete warning');
  await page.click('header nav >> text=Logout');
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  await page.click('button:has-text("Add placement")');
  await page.getByPlaceholder('e.g. Google').fill(`${TAG} AdminMade`);
  await page.getByPlaceholder('e.g. SDE Intern').fill('Analyst');
  await page.getByPlaceholder('e.g. 12').fill('6');
  await page.check('input[name=applicationMode][value=both]');
  await page.click('button[type=submit]:has-text("Add placement")');
  ok(await hasText(page, 'Add an Application Form URL, or choose "In-app only"'), "'both' without URL blocked in form");
  await page.check('input[name=applicationMode][value=in_app]');
  await page.click('button:has-text("Add question")');
  await page.getByLabel('Question 1', { exact: true }).fill('Preferred location?');
  await page.locator('label:has-text("Required") input').first().check();
  await page.screenshot({ path: path.join(SHOTS, 'admin-form-apply-settings.png'), fullPage: true });
  await page.click('button[type=submit]:has-text("Add placement")');
  const made = await until(() => Placement.findOne({ company: `${TAG} AdminMade` }).lean());
  ok(made && made.applicationMode === 'in_app' && made.customPrompts[0].question === 'Preferred location?' && made.customPrompts[0].required === true, 'admin-created drive saved with mode + required question');

  // Edit keeps settings
  const row = page.locator('tr', { hasText: `${TAG} AdminMade` });
  await row.getByRole('button', { name: /^Edit / }).click();
  ok(await page.locator('input[name=applicationMode][value=in_app]').isChecked(), 'edit form restores application mode');
  ok((await page.getByLabel('Question 1', { exact: true }).inputValue()) === 'Preferred location?', 'edit form restores questions');
  await page.click('button:has-text("Cancel")');

  const inAppRow = page.locator('tr', { hasText: `${TAG} InApp` });
  await inAppRow.getByRole('button', { name: /^Delete / }).click();
  ok(await hasText(page, 'Its 1 student application will be deleted too.'), 'delete dialog warns about 1 application');
  await page.click('button:has-text("Cancel")');

  ok(consoleErrors.filter((e) => !/40[0-9]/.test(e)).length === 0, 'no unexpected console errors', consoleErrors.join('\n'));

  // cleanup
  const ids = (await Placement.find({ company: { $regex: `^${TAG}` } }).select('_id').lean()).map((d) => d._id);
  await Application.deleteMany({ driveId: { $in: ids } });
  await Placement.deleteMany({ _id: { $in: ids } });
  await Student.deleteMany({ email: { $regex: `^${TAG.toLowerCase()}` } });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
