// Site upgrade, part E (browser) — the super admin's account menu (who is signed in, Profile, Log
// out) on desktop and in the phone menu, and changing the password from the website:
// a wrong current password is shown on its field, a good change lands on the dashboard and the new
// password is the one that logs in.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
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
      await page.goto(APP + '/login');
      await page.fill('#identifier', 'testadmin');
      await page.fill('#password', password);
      await page.click('button[type=submit]');
    };

    console.log('# One login page for everyone');
    await page.goto(APP + '/admin/login?expired=true');
    await page.waitForURL(/\/login\?expired=true$/);
    ok(true, 'the old admin login address moves to /login (query kept)');
    ok((await page.locator('h1').innerText()).trim() === 'Log In', 'title reads "Log In"', await page.locator('h1').innerText());
    ok(await page.getByLabel('Email or username').isVisible(), 'one field for an email or a username');
    ok(await page.getByText('Your session has expired').isVisible(), 'the expired notice still shows');

    console.log('# The account menu');
    await login(PASSWORD);
    await page.waitForURL(/\/admin\/dashboard/);
    const account = page.getByRole('button', { name: 'Admin account' });
    ok(await account.isVisible(), 'Admin account button in the header');
    ok(!(await page.locator('header nav').getByRole('button', { name: 'Log out' }).count()), 'no Log out among the nav links');
    await account.click();
    const menu = page.locator('header [id]').filter({ hasText: 'testadmin' });
    ok(await menu.getByText('testadmin', { exact: true }).isVisible(), 'menu names the account (its sign-in)');
    ok(!(await menu.getByText('CDPC admin').count()), 'no placeholder name');
    ok(await account.getByText('Super admin').isVisible(), 'the badge shows the role');
    ok((await account.getAttribute('aria-expanded')) === 'true', 'button reports expanded');
    await page.keyboard.press('Escape');
    ok(await until(async () => !(await menu.count())), 'Escape closes it');
    ok(await account.evaluate((el) => el === document.activeElement), 'focus back on the button');

    console.log('# Profile from the menu; the change-password page');
    await account.click();
    ok(!(await page.locator('header').getByRole('link', { name: 'Change password' }).count()), 'the super admin changes its password on its profile');
    await page.locator('header').getByRole('link', { name: 'Profile' }).click();
    await page.waitForURL(/\/admin\/profile$/);
    ok(await until(async () => !(await menu.count())), 'menu closed after choosing an item');
    ok(await until(async () => (await page.locator('h1').innerText()).trim() === 'Profile'), 'profile page');
    await page.goto(APP + '/change-password');
    ok(await until(async () => (await page.locator('h1').innerText()).trim() === 'Change Password'), 'change-password page (Title Case)');
    await page.fill('#currentPassword', 'not-the-password');
    await page.fill('#newPassword', NEW_PASSWORD);
    await page.fill('#confirmPassword', NEW_PASSWORD);
    await page.getByRole('button', { name: 'Update password' }).click();
    ok(await until(() => page.getByText('Current password is incorrect').isVisible()), 'wrong current password shown on its field');
    ok(new URL(page.url()).pathname === '/change-password', 'stays on the page');
    await page.fill('#currentPassword', PASSWORD);
    await page.getByRole('button', { name: 'Update password' }).click();
    await page.waitForURL(/\/admin\/dashboard/);
    ok(await until(() => page.getByText('Password updated').isVisible()), 'success toast, back on the dashboard');

    console.log('# Log out from the menu, then the new password logs in');
    await account.click();
    await page.locator('header').getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(/\/login$/);
    ok(!(await account.count()), 'logged out (to the login page)');
    await login(PASSWORD);
    ok(await until(() => page.getByText('Invalid credentials').isVisible()), 'old password refused');
    await login(NEW_PASSWORD);
    await page.waitForURL(/\/admin\/dashboard/);
    ok(true, 'new password logs in');

    console.log('# Phone: the menu holds Profile and Log out');
    await page.setViewportSize({ width: 390, height: 844 });
    await settled(page);
    ok(!(await account.isVisible()), 'no account button on phones');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const phoneMenu = page.locator('#mobile-menu');
    ok(await phoneMenu.getByRole('link', { name: 'Profile' }).isVisible(), 'Profile in the phone menu');
    ok(await phoneMenu.getByRole('button', { name: 'Log out' }).isVisible(), 'Log out in the phone menu');
    await phoneMenu.getByRole('link', { name: 'Profile' }).click();
    ok(await until(() => new URL(page.url()).pathname === '/admin/profile'), 'phone link opens the page');

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
