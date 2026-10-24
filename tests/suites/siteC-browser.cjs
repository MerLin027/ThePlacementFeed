// Site upgrade, browser side of part A — institute picker on the profile, admin Settings page
// (university, institutes, branches, archive, two-step delete), two-step account delete, the
// dashboard's no-institutes banner, axe. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const Institute = require(path.join(SERVER, 'models/Institute'));
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `SC${Date.now() % 100000}`;

const axeViolations = async (page) => {
  await settled(page);
  await settleAnimations(page);
  await page.addScriptTag({ path: TEST.AXE });
  return page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'serious' || x.impact === 'critical')
    .map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const api = async (method, url, body, headers = H) => {
    const r = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  await api('PUT', '/api/admin/catalog/university', { name: `${TAG} University` });
  const instA = (await api('POST', '/api/admin/catalog/institutes', { name: `${TAG} Alpha Institute` })).json.data;
  const drive = (await api('POST', '/api/placements', { company: `${TAG} Corp`, role: 'Analyst', type: 'Full-Time', ctc: 6, applicationMode: 'in_app', deadline: istDate(5), driveDate: istDate(9) })).json.data;

  const email = `${TAG.toLowerCase()}_s@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S1`, password: 'goodpass123' }) });
  const sCookie = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  const SH = { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie };
  await api('PATCH', '/api/students/me', { firstName: 'Isha', lastName: 'Patel', branch: 'CE', cgpa: 8.4, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/i.pdf' }, SH);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('# Student profile: university and the one-time institute picker');
  await page.goto(APP + '/login');
  await page.fill('#email', email);
  await page.fill('#password', 'goodpass123');
  await page.click('button[type=submit]');
  await page.waitForURL(APP + '/');
  await page.goto(APP + '/profile');
  await page.waitForSelector('#instituteId');
  ok(await hasText(page, `${TAG} University`), 'College / University row shows the admin-set name');
  ok(await hasText(page, 'Still needed: Institute'), 'completion banner asks for the institute');
  ok(await page.locator('button:has-text("Confirm institute")').isDisabled(), 'confirm is disabled until one is picked');
  let violations = await axeViolations(page);
  ok(violations.length === 0, 'profile with the picker: no serious axe violations', violations.join('\n    '));
  await page.selectOption('#instituteId', instA.id);
  await page.click('button:has-text("Confirm institute")');
  await page.waitForSelector('[role=alertdialog]');
  ok(await hasText(page.locator('[role=alertdialog]'), `${TAG} Alpha Institute`), 'confirm dialog names the institute');
  ok(await hasText(page.locator('[role=alertdialog]'), 'only choose once'), 'and says it is a one-time choice');
  await page.click('[role=alertdialog] >> text=Yes, that\'s my institute');
  ok(await until(async () => (await page.locator('#instituteId').count()) === 0), 'picker goes away after confirming');
  ok(await hasText(page, `${TAG} Alpha Institute`), 'institute shown as a locked row');
  ok(String((await Student.findOne({ email }).lean()).instituteId) === instA.id, 'saved on the server');
  await page.reload();
  ok(await until(async () => (await page.locator('#instituteId').count()) === 0) && await hasText(page, `${TAG} Alpha Institute`), 'still locked after a reload');
  ok(!(await hasText(page, 'Still needed', 1500)), 'profile is complete now');
  await api('POST', '/api/applications', { driveId: drive._id, consentGiven: true }, SH);

  console.log('# Admin: Settings page');
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  ok((await page.locator('header nav').first().innerText()).includes('Settings'), 'admin nav links to Settings');
  await page.goto(APP + '/admin/settings');
  await page.waitForSelector('h1:has-text("Settings")');
  ok(await page.inputValue('#universityName') === `${TAG} University`, 'university field shows the current name');
  violations = await axeViolations(page);
  ok(violations.length === 0, 'settings page: no serious axe violations', violations.join('\n    '));

  await page.fill('#universityName', `${TAG} Renamed University`);
  await page.click('form:has(#universityName) button[type=submit]');
  ok(await until(async () => (await api('GET', '/api/catalog', null, {})).json.data.university === `${TAG} Renamed University`), 'save the university');

  await page.fill('#newInstitute', `${TAG} Beta Institute`);
  await page.click('form:has(#newInstitute) button[type=submit]');
  const instList = page.locator('ul[aria-label=Institutes]');
  ok(await hasText(instList, `${TAG} Beta Institute`), 'add an institute');
  await page.fill('#newInstitute', `${TAG} beta institute`);
  await page.click('form:has(#newInstitute) button[type=submit]');
  ok(await hasText(page, 'already exists'), 'duplicate name is reported');
  await page.click(`button[aria-label="Rename ${TAG} Beta Institute"]`);
  await page.fill('input[id^=rename-]', `${TAG} Gamma Institute`);
  await page.keyboard.press('Enter');
  ok(await hasText(instList, `${TAG} Gamma Institute`), 'rename with Enter');
  await page.click(`button[aria-label="Archive ${TAG} Gamma Institute"]`);
  ok(await until(async () => (await instList.locator('li', { hasText: `${TAG} Gamma Institute` }).innerText()).includes('Archived')), 'archive shows the chip');
  await page.click(`button[aria-label="Delete ${TAG} Gamma Institute"]`);
  await page.waitForSelector('[role=alertdialog]');
  ok(await hasText(page.locator('[role=alertdialog]'), 'Nothing uses this institute'), 'unused: one simple confirm');
  await page.click('[role=alertdialog] >> text=Delete institute');
  ok(await until(async () => !(await instList.innerText()).includes(`${TAG} Gamma Institute`)), 'unused institute deleted');

  console.log('# Two-step delete for an institute in use');
  await page.click(`button[aria-label="Delete ${TAG} Alpha Institute"]`);
  const dlg = page.locator('[role=alertdialog]');
  await dlg.waitFor();
  ok(await hasText(dlg, 'used by 1 student') && await hasText(dlg, 'Step 1 of 2'), 'step 1 says what uses it');
  ok(await dlg.locator('button:has-text("Archive instead")').count() === 1, 'offers Archive instead');
  ok(await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Cancel', 'Cancel has focus on step 1');
  await dlg.locator('button:has-text("Delete anyway")').click();
  ok(await hasText(dlg, 'Step 2 of 2') && await hasText(dlg, 'choose their institute again'), 'step 2 spells out the consequences');
  ok(await until(async () => (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Back'), 'Back has focus on step 2');
  await dlg.locator('button:has-text("Back")').click();
  ok(await hasText(dlg, 'Step 1 of 2'), 'Back returns to step 1');
  await dlg.locator('button:has-text("Delete anyway")').click();
  await dlg.locator('button:has-text("Delete institute")').click();
  ok(await until(async () => (await Student.findOne({ email }).lean()).instituteId === undefined), 'forced delete clears the student\'s institute');
  ok(await until(async () => !(await instList.innerText().catch(() => '')).includes(`${TAG} Alpha Institute`)), 'and removes it from the list');

  console.log('# Branches: add, and a delete blocked by an only-branch drive');
  await page.fill('#newBranchCode', `Q${TAG.slice(-4)}`);
  await page.fill('#newBranchName', 'Quantum Systems');
  await page.click('form:has(#newBranchCode) button[type=submit]');
  const brList = page.locator('ul[aria-label=Branches]');
  ok(await hasText(brList, 'Quantum Systems'), 'add a branch');
  const code = `Q${TAG.slice(-4)}`.toUpperCase();
  const onlyDrive = await Placement.create({ company: `${TAG} OnlyQ`, role: 'R', type: 'Full-Time', ctc: 5, eligibility: { branches: [code] } });
  await page.reload();
  await brList.waitFor();
  await page.click('button[aria-label="Delete Quantum Systems"]');
  await dlg.waitFor();
  await dlg.locator('button:has-text("Delete anyway")').click();
  ok(await hasText(dlg, `${TAG} OnlyQ`) && await hasText(dlg, "Can't delete yet"), 'step 2 lists the drive that blocks it');
  ok(await dlg.locator('button:has-text("Delete branch")').isDisabled(), 'and the delete button is disabled');
  await dlg.locator('button:has-text("Back")').click();
  await dlg.locator('button:has-text("Archive instead")').click();
  ok(await until(async () => (await brList.locator('li', { hasText: 'Quantum Systems' }).innerText()).includes('Archived')), 'Archive instead archives it');

  console.log('# Students: two-step account delete');
  await page.goto(APP + '/admin/students');
  await page.fill('input[aria-label="Search students"]', `${TAG}S1`);
  const row = page.locator('tr', { hasText: `${TAG}S1` });
  await row.waitFor();
  ok(await hasText(row, 'Not chosen yet'), 'institute column shows the cleared choice');
  await row.locator('button[aria-label="Delete account"]').click();
  await dlg.waitFor();
  await dlg.locator('button:has-text("Delete account")').click();
  ok(await hasText(dlg, 'What about their applications?') && await hasText(dlg, 'their 1 application'), 'step 2 asks about the 1 application');
  await dlg.locator('button:has-text("Keep the records")').click();
  ok(await until(async () => !(await Student.exists({ email }))), 'account deleted');
  const kept = await Application.findOne({ driveId: drive._id }).lean();
  ok(kept && kept.studentDeleted === true, 'its application was kept and flagged');

  console.log('# Dashboard banner while there are no institutes');
  const actives = await Institute.find({ active: true }).select('_id').lean();
  await Institute.updateMany({}, { $set: { active: false } });
  await api('PATCH', `/api/admin/catalog/institutes/${actives[0]._id}`, { active: false }); // reload the API cache
  await page.goto(APP + '/admin/dashboard');
  ok(await hasText(page, "Students can't apply in-app yet"), 'banner shown with no active institutes');
  await Institute.updateMany({ _id: { $in: actives.map((i) => i._id) } }, { $set: { active: true } });
  await api('PATCH', `/api/admin/catalog/institutes/${actives[0]._id}`, { active: true });
  await page.reload();
  await settled(page);
  ok(!(await hasText(page, "Students can't apply in-app yet", 1500)), 'banner gone once an institute exists');

  ok(errors.length === 0, 'no page errors', errors.join('\n    '));

  // cleanup
  await browser.close();
  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteMany({ _id: { $in: [drive._id, onlyDrive._id] } });
  const brId = (await api('GET', '/api/admin/catalog')).json.data.branches.find((b) => b.code === code)?.id;
  if (brId) await api('DELETE', `/api/admin/catalog/branches/${brId}?force=true`);
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
