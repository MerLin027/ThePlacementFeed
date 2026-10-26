// Site upgrade, part F (browser) — the super admin's Team page and what each role sees:
// - Team: add an admin, the one-time password shown once (copyable), the new row;
// - the new admin's first sign-in on the one login page, the forced password change, and a
//   navigation without Setup and Team (those addresses send them back to the dashboard);
// - disabling the account signs the admin out mid-session;
// - a student reset on the Students page shows its one-time password the same way;
// - axe: Team page, the add form and the one-time password dialog.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const APP = TEST.APP;
const API = TEST.API;
const TAG = `sfb${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

const axeViolations = async (page) => {
  await settled(page);
  await settleAnimations(page);
  await page.addScriptTag({ path: TEST.AXE });
  return page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'serious' || x.impact === 'critical')
    .map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
};
const navTexts = (page) => page.locator('header nav').first().innerText();
const signIn = async (page, identifier, password) => {
  await page.goto(APP + '/login');
  await page.fill('#identifier', identifier);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const browser = await chromium.launch();
  const errors = [];
  try {
    const superCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await superCtx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));

    console.log('# The super admin: Team page');
    await signIn(page, 'testadmin', 'testadminpass');
    await page.waitForURL(/\/admin\/dashboard/);
    let nav = await navTexts(page);
    ok(nav.includes('Setup') && nav.includes('Team'), 'the super admin sees Setup and Team', nav);
    await page.locator('header nav').getByRole('link', { name: 'Team' }).click();
    await page.waitForURL(/\/admin\/team$/);
    await settled(page);
    ok((await page.locator('h1').innerText()).trim() === 'Team', 'Team page');
    ok(await page.getByText('You', { exact: true }).isVisible(), 'their own row is marked You');
    let axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: Team page clean', axe.join('\n    '));

    console.log('# Add an admin');
    await page.getByRole('button', { name: 'Add admin' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add admin' });
    await dialog.waitFor();
    axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: add form clean', axe.join('\n    '));
    await dialog.getByRole('button', { name: 'Create account' }).click();
    const emptyErrors = await until(() => dialog.getByText('Enter their name').isVisible());
    if (!emptyErrors) await page.screenshot({ path: path.join(TEST.OUT, 'siteF-empty-form.png') });
    ok(emptyErrors, 'empty form: field errors');
    await page.fill('#staff-name', 'Riya Shah');
    await page.fill('#staff-username', `${TAG}riya`);
    await page.fill('#staff-email', `${TAG}riya@example.com`);
    ok((await dialog.getByRole('radio', { name: /^Admin/ }).isChecked()), 'Admin is the default role');
    await dialog.getByRole('button', { name: 'Create account' }).click();

    const otp = page.getByRole('alertdialog', { name: 'Account created' });
    await otp.waitFor();
    const password = (await otp.locator('code').innerText()).trim();
    ok(/^[A-HJ-NP-Za-km-np-z2-9]{4}(-[A-HJ-NP-Za-km-np-z2-9]{4}){2}$/.test(password), 'the one-time password is shown', password);
    ok(await otp.getByText("It won't be shown again.").isVisible(), 'and says it is shown only once');
    axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: one-time password dialog clean', axe.join('\n    '));
    await otp.getByRole('button', { name: 'Copy' }).click();
    ok(await until(() => otp.getByRole('button', { name: 'Copied' }).isVisible()), 'Copy confirms');
    ok((await page.evaluate(() => navigator.clipboard.readText())) === password, 'the clipboard holds the password');
    await page.keyboard.press('Escape');
    ok(await until(async () => !(await otp.isVisible())), 'Escape closes it');
    const row = page.locator('tr', { hasText: 'Riya Shah' });
    ok(await until(() => row.getByText('First sign-in pending').isVisible()), 'the new row shows the pending first sign-in');

    console.log('# The new admin signs in for the first time');
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const apage = await adminCtx.newPage();
    apage.on('pageerror', (e) => errors.push(e.message));
    await signIn(apage, `${TAG}riya`, password);
    await apage.waitForURL(/\/change-password$/);
    ok(await until(() => apage.getByText('You signed in with a one-time password.').isVisible()), 'sent to set a password, with the reason');
    ok(!(await apage.locator('#currentPassword').count()), 'the one-time password is not asked again');
    await apage.goto(APP + '/admin/students');
    ok(await apage.waitForURL(/\/change-password$/).then(() => true, () => false), 'other pages wait until it is changed');
    await apage.fill('#newPassword', 'short-one');
    await apage.fill('#confirmPassword', 'short-one');
    await apage.getByRole('button', { name: 'Update password' }).click();
    ok(await until(() => apage.getByText('Password must be at least 12 characters').isVisible()), 'staff need 12+ characters');
    await apage.fill('#newPassword', 'riya-strong-pass-26');
    await apage.fill('#confirmPassword', 'riya-strong-pass-26');
    await apage.getByRole('button', { name: 'Update password' }).click();
    await apage.waitForURL(/\/admin\/dashboard$/);
    nav = await navTexts(apage);
    ok(nav.includes('Dashboard') && nav.includes('Students') && !nav.includes('Setup') && !nav.includes('Team'), 'an admin sees no Setup or Team', nav);
    ok(await apage.getByRole('button', { name: 'Admin account' }).getByText(/^Admin/).isVisible(), 'the badge says Admin');
    for (const p of ['/admin/settings', '/admin/team']) {
      await apage.goto(APP + p);
      ok(await apage.waitForURL(/\/admin\/dashboard$/).then(() => true, () => false), `${p} sends an admin back to the dashboard`);
    }

    console.log('# Disabling signs them out mid-session');
    await page.reload();
    await row.getByRole('button', { name: 'Disable Riya Shah' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Disable' }).click();
    ok(await until(() => row.getByText('Disabled').isVisible()), 'the row shows Disabled');
    await apage.goto(APP + '/admin/students');
    ok(await apage.waitForURL(/\/login\?/).then(() => true, () => false), 'the admin is sent to log in on their next page', apage.url());
    await signIn(apage, `${TAG}riya`, 'riya-strong-pass-26');
    ok(await until(() => apage.getByText('Invalid credentials').isVisible()), 'and cannot sign in again');
    await adminCtx.close();

    console.log('# Student reset shows its one-time password');
    const email = `${TAG}stu@example.com`;
    await fetch(`${API}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}R1`.toUpperCase(), password: 'goodpass123' }) });
    await page.goto(`${APP}/admin/students?search=${encodeURIComponent(email)}`);
    const srow = page.locator('tr', { hasText: email });
    await srow.waitFor();
    await srow.getByRole('button', { name: 'Reset password' }).click();
    const confirm = page.getByRole('alertdialog');
    ok(await confirm.getByText('one-time password').isVisible(), 'the confirmation explains the one-time password');
    await confirm.getByRole('button', { name: 'Reset password' }).click();
    const sotp = page.getByRole('alertdialog', { name: 'Password reset' });
    await sotp.waitFor();
    const studentTemp = (await sotp.locator('code').innerText()).trim();
    ok(/^[A-HJ-NP-Za-km-np-z2-9]{4}(-[A-HJ-NP-Za-km-np-z2-9]{4}){2}$/.test(studentTemp), 'the reset dialog shows the one-time password');
    await sotp.getByRole('button', { name: 'Done' }).click();
    const stuCtx = await browser.newContext();
    const spage = await stuCtx.newPage();
    await signIn(spage, email, studentTemp);
    await spage.waitForURL(/\/change-password$/);
    ok(await until(() => spage.getByText('Your password was reset by the CDPC admin.').isVisible()), 'the student signs in with it and is asked to set a password');
    await stuCtx.close();

    ok(errors.length === 0, 'no page errors', errors.join('\n    '));
  } finally {
    await browser.close();
    const staff = await Admin.find({ username: new RegExp(`^${TAG}`) }).select('_id').lean();
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: [...staff, ...studs].map((x) => x._id) } });
    await Admin.deleteMany({ username: new RegExp(`^${TAG}`) });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
