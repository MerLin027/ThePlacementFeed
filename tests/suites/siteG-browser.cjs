// Site upgrade, part G (browser) — the login redesign, the super admin's profile and the Team form:
// - login: "Log In" with no kicker; "Trouble logging in?" swaps the form for its help in the same
//   place (the card keeps its height, focus moves, the hidden view is inert, typed values stay);
//   a failed attempt offers the help; nothing overflows a phone screen; axe on both views;
// - the drives panel: tickets linking to drives; a short list ends in a "That's everything" slot;
// - the profile: name saved without a password and shown in the account menu; changing the email
//   asks for the password; the password rules tick off as a new password is typed; axe;
// - the Team page: editing an admin's details; actions under the name on phones.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const APP = TEST.APP;
const API = TEST.API;
const TAG = `sgb${Date.now() % 100000}`;
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
const signIn = async (page, identifier, password) => {
  await page.goto(APP + '/login');
  await page.fill('#identifier', identifier);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
};
const boxOf = (locator) => locator.boundingBox();

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const before = await Admin.findOne({ username: 'testadmin' }).lean();
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));

    console.log('# Login: heading and the help swap');
    await page.goto(APP + '/login');
    await settled(page);
    ok((await page.locator('h1').innerText()).trim() === 'Log In', 'the title is "Log In"');
    ok(!(await page.getByText('Students and staff').count()), 'no "Students and staff" above it');
    ok(await page.getByRole('heading', { name: 'Upcoming Drives', exact: true }).isVisible(), 'the drives panel heading is Title Case');
    const card = page.locator('#identifier').locator('xpath=ancestor::div[contains(@class,"rounded-[1.75rem]")]');
    const cardBefore = await boxOf(card);
    const notice = page.locator('section[aria-labelledby="notice-heading"]');
    const noticeBefore = await boxOf(notice);
    let axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: login clean', axe.join('\n    '));

    await page.fill('#identifier', 'someone@example.com');
    const trouble = page.getByRole('button', { name: 'Trouble logging in?' });
    await trouble.click();
    const helpHeading = page.getByRole('heading', { name: 'Trouble Logging In?', exact: true });
    ok(await until(() => helpHeading.isVisible()), 'the help replaces the form');
    ok(await until(() => helpHeading.evaluate((el) => el === document.activeElement)), 'focus moves to the help heading');
    ok(await page.locator('form').evaluate((el) => el.closest('[inert]') !== null), 'the hidden form is inert (not focusable or read)');
    await settleAnimations(page);
    await page.waitForTimeout(350);
    const cardOpen = await boxOf(card);
    const noticeOpen = await boxOf(notice);
    ok(Math.abs(cardOpen.height - cardBefore.height) < 1, 'the card keeps its height', `${cardBefore.height} -> ${cardOpen.height}`);
    ok(Math.abs(noticeOpen.height - noticeBefore.height) < 1, 'the drives panel does not grow', `${noticeBefore.height} -> ${noticeOpen.height}`);
    ok(await page.getByText('Forgot your password?').isVisible() && await page.getByText(/at least 8 characters for students, 12 for staff/).isVisible(), 'the help names who to ask and the password lengths');
    axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: help view clean', axe.join('\n    '));
    await page.getByRole('button', { name: 'Back to log in' }).click();
    ok(await until(() => trouble.evaluate((el) => el === document.activeElement)), 'back: focus returns to "Trouble logging in?"');
    ok((await page.inputValue('#identifier')) === 'someone@example.com', 'what was typed is still there');
    ok(await page.locator('#login-help').evaluate((el) => el.hasAttribute('inert')), 'the help is inert again');

    console.log('# A failed attempt offers the help');
    await page.fill('#password', 'not-the-password');
    await page.click('button[type=submit]');
    const alert = page.getByRole('alert');
    ok(await until(() => alert.getByText('Invalid credentials').isVisible()), 'the error shows');
    await alert.getByRole('button', { name: "Here's what to do" }).click();
    ok(await until(() => helpHeading.isVisible()), 'its link opens the help');
    await page.getByRole('button', { name: 'Back to log in' }).click();

    console.log('# Drives panel');
    const tickets = notice.locator('li');
    const count = await tickets.count();
    ok(count >= 1 && count <= 4, `at most four drive tickets (${count})`);
    if (count > 0) {
      const href = await tickets.first().getByRole('link').getAttribute('href');
      ok(/^\/placement\/[a-f0-9]{24}$/.test(href || ''), 'each ticket links to its drive', href);
    }
    if (count < 4) ok(await notice.getByText("That's everything for now").isVisible(), 'a short list ends in a "That\'s everything" slot instead of blank space');

    console.log('# Phone: nothing wider than the screen');
    const phone = await browser.newContext({ viewport: { width: 360, height: 760 } });
    const ppage = await phone.newPage();
    ppage.on('pageerror', (e) => errors.push(e.message));
    await ppage.goto(APP + '/login');
    await settled(ppage);
    const overflow = await ppage.evaluate(() => {
      const card = document.querySelector('#identifier').closest('[class*="rounded-[1.75rem]"]');
      return { page: document.documentElement.scrollWidth - window.innerWidth, card: card.scrollWidth - card.clientWidth, right: card.getBoundingClientRect().right - window.innerWidth };
    });
    ok(overflow.page <= 0 && overflow.card <= 0 && overflow.right <= 0, 'the login card fits a 360px screen', JSON.stringify(overflow));
    await phone.close();

    console.log('# Profile');
    await signIn(page, 'testadmin', 'testadminpass');
    await page.waitForURL(/\/admin\/dashboard/);
    await page.goto(APP + '/admin/profile');
    await page.locator('#profile-username').waitFor();
    ok((await page.locator('h1').innerText()).trim() === 'Profile', 'the profile page');
    ok(await page.getByText('College / University').isVisible(), 'shows the College/University');
    ok((await page.inputValue('#profile-username')) === 'testadmin', 'the username is filled in');
    axe = await axeViolations(page);
    ok(axe.length === 0, 'axe: profile clean', axe.join('\n    '));

    ok(await page.locator('#profile-current-password').evaluate((el) => el.closest('[inert]') !== null), 'no password box until the sign-in changes');
    await page.fill('#profile-name', 'Placement Head');
    await page.getByRole('button', { name: 'Save changes' }).click();
    ok(await until(() => page.getByText('Profile updated').isVisible()), 'a new name saves without a password');
    const account = page.getByRole('button', { name: 'Super admin account' });
    await account.click();
    ok(await until(() => page.locator('header').getByText('Placement Head').isVisible()), 'the account menu shows the new name');
    await page.keyboard.press('Escape');

    await page.fill('#profile-email', `${TAG}@example.com`);
    ok(await until(() => page.locator('#profile-current-password').evaluate((el) => el.closest('[inert]') === null)), 'changing the email shows the password box');
    await page.getByRole('button', { name: 'Save changes' }).click();
    ok(await until(() => page.getByText('Enter your current password to change how you sign in').isVisible()), 'and asks for it');
    await page.fill('#profile-current-password', 'not-the-password');
    await page.getByRole('button', { name: 'Save changes' }).click();
    ok(await until(() => page.getByText('Current password is incorrect').isVisible()), 'a wrong password is shown on its field');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    ok((await page.inputValue('#profile-email')) === '', 'Discard puts the saved values back');

    await page.fill('#newPassword', 'testadmin');
    const rules = page.locator('#newPassword-helper');
    ok(await rules.getByText('12–72 characters').isVisible(), 'the password rules are listed under the field');
    ok(await rules.locator('li', { hasText: 'Doesn' }).getByText('(not yet)').count() === 1, 'a password with the username is marked not yet');
    await page.fill('#newPassword', 'a-long-and-unusual-phrase');
    ok(await until(async () => (await rules.locator('li', { hasText: '12–72 characters' }).getByText('(done)').count()) === 1), 'a long one ticks the length rule');

    console.log('# Team: edit an admin, phone actions');
    const created = await fetch(`${API}/api/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ') },
      body: JSON.stringify({ name: 'Edit Me', email: `${TAG}admin@example.com` }),
    });
    ok(created.status === 201, 'an admin to edit');
    await page.goto(APP + '/admin/team');
    const row = page.locator('tr', { hasText: 'Edit Me' });
    await row.waitFor();
    await row.getByRole('button', { name: "Edit Edit Me's details" }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Admin', exact: true });
    await dialog.waitFor();
    await settleAnimations(page);
    const dbox = await dialog.boundingBox();
    const middle = dbox.y + dbox.height / 2;
    ok(Math.abs(middle - 450) < 4 && Math.abs(dbox.x + dbox.width / 2 - 720) < 4, 'the dialog is centred on the screen', JSON.stringify(dbox));
    await page.fill('#staff-name', 'Edited Admin');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    ok(await until(() => page.locator('tr', { hasText: 'Edited Admin' }).isVisible()), 'the new name shows in the table');
    await page.setViewportSize({ width: 390, height: 844 });
    await settled(page);
    const prow = page.locator('tr', { hasText: 'Edited Admin' });
    ok(await prow.getByRole('button', { name: 'Reset Edited Admin\'s password' }).isVisible(), 'on phones the actions sit under the name');
    const tableOverflow = await page.evaluate(() => {
      const scroller = document.querySelector('table').parentElement;
      return scroller.scrollWidth - scroller.clientWidth;
    });
    ok(tableOverflow <= 0, 'and the table needs no sideways scrolling', String(tableOverflow));

    console.log('# The two halves of the login card line up');
    await page.setViewportSize({ width: 1440, height: 900 });
    // Signed out, or /login moves straight on to the dashboard
    await ctx.clearCookies();
    await page.goto(APP + '/login');
    await page.locator('#identifier').waitFor();
    await settled(page);
    const lines = await page.evaluate(() => {
      const top = (el) => Math.round(el.getBoundingClientRect().top);
      const rules = [...document.querySelectorAll('[class*="min-h-[3.75rem]"]')].map(top);
      return { titles: [top(document.querySelector('#notice-heading')), top(document.querySelector('h1'))], rules };
    });
    ok(lines.titles[0] === lines.titles[1], 'the two titles share a line', JSON.stringify(lines));
    ok(lines.rules.length === 2 && lines.rules[0] === lines.rules[1], 'the two footer rules share a line', JSON.stringify(lines));

    ok(errors.length === 0, 'no page errors', errors.join('\n    '));
  } finally {
    await browser.close();
    const staff = await Admin.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: staff.map((x) => x._id) } });
    await Admin.deleteMany({ email: new RegExp(`^${TAG}`) });
    await Admin.updateOne({ _id: before._id }, before.name ? { $set: { name: before.name }, $unset: { email: '' } } : { $unset: { name: '', email: '' } });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
