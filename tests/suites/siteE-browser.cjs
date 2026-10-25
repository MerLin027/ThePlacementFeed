// Site upgrade, part E (browser) — the admin's account menu (who is signed in, Change password,
// Log out) on desktop and in the phone menu, and changing the admin password from the website:
// a wrong current password is shown on its field, a good change lands on the dashboard and the new
// password is the one that logs in.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Admin = require(path.join(SERVER, 'models/Admin'));
const APP = TEST.APP;
const PASSWORD = 'testadminpass';
const NEW_PASSWORD = 'browser-admin-pass-2';
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const login = async (password) => {
      await page.goto(APP + '/admin/login');
      await page.fill('#username', 'testadmin');
      await page.fill('#password', password);
      await page.click('button[type=submit]');
    };

    console.log('# Admin login page');
    await page.goto(APP + '/admin/login');
    ok((await page.locator('h1').innerText()).trim() === 'Admin Login', 'title reads "Admin Login"', await page.locator('h1').innerText());
    ok(!(await page.locator('main').getByText('CDPC', { exact: true }).count()), 'no CDPC kicker above it');

    console.log('# The account menu');
    await login(PASSWORD);
    await page.waitForURL(/\/admin\/dashboard/);
    const account = page.getByRole('button', { name: 'Admin account' });
    ok(await account.isVisible(), 'Admin account button in the header');
    ok(!(await page.locator('header nav').getByRole('button', { name: 'Log out' }).count()), 'no Log out among the nav links');
    await account.click();
    const menu = page.locator('header [id]').filter({ hasText: 'CDPC admin' });
    ok(await menu.getByText('Signed in as testadmin').isVisible(), 'menu names the account');
    ok((await account.getAttribute('aria-expanded')) === 'true', 'button reports expanded');
    await page.keyboard.press('Escape');
    ok(await until(async () => !(await page.getByText('Signed in as testadmin').count())), 'Escape closes it');
    ok(await account.evaluate((el) => el === document.activeElement), 'focus back on the button');

    console.log('# Change password from the menu');
    await account.click();
    await page.locator('header').getByRole('link', { name: 'Change password' }).click();
    await page.waitForURL(/\/admin\/change-password$/);
    ok(await until(async () => !(await page.getByText('Signed in as testadmin').count())), 'menu closed after choosing an item');
    ok((await page.locator('h1').innerText()).trim() === 'Change password', 'change-password page');
    await page.fill('#currentPassword', 'not-the-password');
    await page.fill('#newPassword', NEW_PASSWORD);
    await page.fill('#confirmPassword', NEW_PASSWORD);
    await page.getByRole('button', { name: 'Update password' }).click();
    ok(await until(() => page.getByText('Current password is incorrect').isVisible()), 'wrong current password shown on its field');
    ok(new URL(page.url()).pathname === '/admin/change-password', 'stays on the page');
    await page.fill('#currentPassword', PASSWORD);
    await page.getByRole('button', { name: 'Update password' }).click();
    await page.waitForURL(/\/admin\/dashboard/);
    ok(await until(() => page.getByText('Password updated').isVisible()), 'success toast, back on the dashboard');

    console.log('# Log out from the menu, then the new password logs in');
    await account.click();
    await page.locator('header').getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(/\/admin\/login/);
    ok(!(await account.count()), 'logged out');
    await login(PASSWORD);
    ok(await until(() => page.getByText('Invalid credentials').isVisible()), 'old password refused');
    await login(NEW_PASSWORD);
    await page.waitForURL(/\/admin\/dashboard/);
    ok(true, 'new password logs in');

    console.log('# Phone: the menu holds Change password and Log out');
    await page.setViewportSize({ width: 390, height: 844 });
    await settled(page);
    ok(!(await account.isVisible()), 'no account button on phones');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const phoneMenu = page.locator('#mobile-menu');
    ok(await phoneMenu.getByRole('link', { name: 'Change password' }).isVisible(), 'Change password in the phone menu');
    ok(await phoneMenu.getByRole('button', { name: 'Log out' }).isVisible(), 'Log out in the phone menu');
    await phoneMenu.getByRole('link', { name: 'Change password' }).click();
    ok(await until(() => new URL(page.url()).pathname === '/admin/change-password'), 'phone link opens the page');

    ok(errors.length === 0, 'no page errors', errors.join('\n    '));
  } finally {
    await browser.close();
    // Leave the shared admin with its usual password and a clean token version
    await Admin.updateOne({ username: 'testadmin' }, { $set: { passwordHash: await bcrypt.hash(PASSWORD, 12) } });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
