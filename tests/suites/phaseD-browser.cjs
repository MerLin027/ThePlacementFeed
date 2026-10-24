// Phase D verification — UI foundation: a11y scan, focus, titles, targets, motion, loading states.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const { until, settled } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const AXE = TEST.AXE;
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PD${Date.now() % 100000}`;
const ONLY = process.env.AXE_REPORT === '1';

const axeScan = async (page, label) => {
  await settleAnimations(page);

  await page.addScriptTag({ path: AXE });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const serious = result.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const detail = serious.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.join(' | ')}`).join('\n      ');
  ok(serious.length === 0, `axe: no serious/critical issues on ${label}`, detail);
  if (ONLY && result.length) console.log(`    [${label}] minor:`, result.filter((v) => !serious.includes(v)).map((v) => v.id).join(', '));
};

// Buttons, inputs and selects that are visible must be at least 44x44 (CSS px)
const smallTargets = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]), select, textarea')];
  return els
    .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5))
    .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}[${(el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
});

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const drive = (await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} Corp`, role: 'Engineer', type: 'Full-Time', ctc: 7, applicationMode: 'in_app', deadline: istDate(5), driveDate: istDate(9), jdDescription: '## Role\n- Build things', selectionRounds: [{ roundName: 'Test' }], customPrompts: [{ question: 'Relocate?', required: true }] }) })).json()).data;
  const email = `${TAG.toLowerCase()}@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S`, password: 'goodpass123' }) });
  const sCookie = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie }, body: JSON.stringify({ firstName: 'Tara', lastName: 'Rao', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/t.pdf' }) });
  await chooseInstitute(sCookie);
  const ap = await (await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sCookie }, body: JSON.stringify({ driveId: drive._id, consentGiven: true, customAnswers: [{ promptId: drive.customPrompts[0]._id, answer: 'Yes' }] }) })).json();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('tpf:notificationCursor', JSON.stringify(new Date().toISOString())); } catch {} });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  console.log('# Skip link + focus management');
  await page.goto(APP + '/');
  await settled(page);
  await page.keyboard.press('Tab');
  ok((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Skip to main content', 'first Tab reaches the skip link');
  ok(await page.getByText('Skip to main content').isVisible(), 'skip link becomes visible when focused');
  await page.keyboard.press('Enter');
  ok(await until(() => page.evaluate(() => document.activeElement?.id === 'main-content')), 'skip link moves focus to main');
  await page.evaluate(() => { document.getElementById('main-content').scrollTop = 400; });
  await page.locator('a', { hasText: `${TAG} Corp` }).first().click();
  await page.waitForURL(/\/placement\//);
  ok(await until(() => page.evaluate(() => document.getElementById('main-content').scrollTop === 0)), 'new page starts at the top');
  ok(await until(() => page.evaluate(() => document.activeElement?.id === 'main-content')), 'focus moves to main on navigation');
  await until(async () => (await page.title()).startsWith(TAG));
  ok((await page.title()) === `${TAG} Corp — Engineer · The Placement Feed`, `drive page title (${await page.title()})`);
  await page.goto(APP + '/login');
  await settled(page);
  ok(await until(() => page.evaluate(() => document.activeElement?.id === 'email')), 'autofocused field keeps focus (not stolen by main)');
  for (const [route, title] of [['/', 'Drives'], ['/timeline', 'Timeline'], ['/signup', 'Sign up'], ['/admin/login', 'Admin login'], ['/nope', 'Page not found']]) {
    await page.goto(APP + route);
    ok(await until(async () => (await page.title()) === `${title} · The Placement Feed`), `title for ${route}`);
  }

  console.log('# Forms');
  await page.goto(APP + '/signup');
  await page.fill('#password', 'secret123');
  const toggle = page.getByRole('button', { name: 'Show password' }).first();
  await toggle.click();
  ok((await page.getAttribute('#password', 'type')) === 'text' && (await page.getByRole('button', { name: 'Hide password' }).first().getAttribute('aria-pressed')) === 'true', 'password can be revealed');
  await page.getByRole('button', { name: 'Hide password' }).first().click();
  ok((await page.getAttribute('#password', 'type')) === 'password', 'and hidden again');
  await page.fill('#password', '');
  await page.click('button[type=submit]');
  ok(await until(() => page.evaluate(() => document.activeElement?.id === 'email')), 'failed submit focuses the first invalid field');
  await page.fill('#email', 'a@b.co');
  await page.fill('#rollNumber', 'ABCD1234');
  await page.click('button[type=submit]');
  ok(await until(() => page.evaluate(() => document.activeElement?.id === 'password')), '...and the next one after fixing it');

  console.log('# Loading states (slow network)');
  await page.route('**/api/placements?*', async (route) => { await wait(4500); await route.continue().catch(() => {}); });
  await page.goto(APP + '/');
  ok(await until(async () => (await page.locator('.skeleton').count()) > 10, { timeout: 3000 }), 'card skeletons while loading');
  // The explanation is designed to appear 3 s into a slow load (this request is held for 4.5 s)
  ok(await until(() => page.getByText('Waking up the server').isVisible(), { timeout: 4400 }), 'cold-start explanation after 3 s');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`**/api/placements/${drive._id}`, async (route) => { await wait(2500); await route.continue().catch(() => {}); });
  await page.goto(`${APP}/placement/${drive._id}`);
  ok(await until(() => page.getByRole('status', { name: 'Loading drive details' }).isVisible(), { timeout: 2400 }), 'detail skeleton while loading');
  await until(async () => !(await page.getByRole('status', { name: 'Loading drive details' }).isVisible()), { timeout: 8000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  console.log('# Reduced motion');
  const rm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const rp = await rm.newPage();
  await rp.goto(APP + '/login');
  const dur = await rp.evaluate(() => getComputedStyle(document.querySelector('.btn-primary')).transitionDuration);
  ok(parseFloat(dur) < 0.001, `transitions effectively off with reduced motion (${dur})`);
  await rm.close();

  console.log('# Touch targets (>= 44px) and accessibility scan');
  const studentPages = async (p) => {
    await p.goto(APP + '/login');
    await p.fill('#email', email);
    await p.fill('#password', 'goodpass123');
    await p.click('button[type=submit]');
    await p.waitForURL(APP + '/');
  };
  const pages = [
    ['home (guest)', '/'],
    ['timeline', '/timeline'],
    ['drive detail', `/placement/${drive._id}`],
    ['login', '/login'],
    ['signup', '/signup'],
    ['404', '/nope'],
    ['admin login', '/admin/login'],
  ];
  for (const [label, route] of pages) {
    await page.goto(APP + route);
    await settled(page);
    const small = await smallTargets(page);
    ok(small.length === 0, `targets >= 44px on ${label}`, small.join(', '));
    await axeScan(page, label);
  }
  // Student pages
  await studentPages(page);
  for (const [label, route] of [['home (student)', '/'], ['profile', '/profile'], ['my applications', '/applications'], ['change password', '/change-password'], ['drive detail (applied)', `/placement/${drive._id}`]]) {
    await page.goto(APP + route);
    await settled(page);
    const small = await smallTargets(page);
    ok(small.length === 0, `targets >= 44px on ${label}`, small.join(', '));
    await axeScan(page, label);
  }
  // Admin pages
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/);
  for (const [label, route] of [['admin dashboard', '/admin/dashboard'], ['admin students', '/admin/students'], ['admin applicants', `/admin/drives/${drive._id}/applicants`]]) {
    await page.goto(APP + route);
    await settled(page);
    await axeScan(page, label);
  }

  ok(consoleErrors.filter((e) => !/40[0-9]|ERR_ABORTED/.test(e)).length === 0, 'no unexpected console errors', consoleErrors.slice(0, 3).join('\n'));

  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
