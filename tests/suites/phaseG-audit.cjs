// Phase G final audit — every page, guest/student/admin, desktop (1280) and phone (390):
// axe (serious/critical), >=44px targets, no horizontal scroll, no console errors. Saves "after" screenshots.
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
const OUT = path.join(TEST.OUT, 'shots', process.env.SHOTS || 'after');
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = process.env.TAG || `PG${Date.now() % 100000}`;

const audit = async (page, label, consoleErrors) => {
  await settled(page);
  await settleAnimations(page);

  await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'serious' || x.impact === 'critical')
    .map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  const small = await page.evaluate(() => [...document.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]), select')]
    .filter((el) => el.offsetParent !== null && !el.closest('.sr-only') && !el.closest('.input-field'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5))
    .map(({ el, r }) => `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}] ${Math.round(r.width)}x${Math.round(r.height)}`));
  const hscroll = await page.evaluate(() => {
    const m = document.getElementById('main-content');
    return document.documentElement.scrollWidth > window.innerWidth + 1 || (m && m.scrollWidth > m.clientWidth + 1);
  });
  ok(violations.length === 0 && small.length === 0 && !hscroll, label,
    [violations.join(' ; '), small.join(', '), hscroll ? 'horizontal scroll' : ''].filter(Boolean).join(' || '));
  await page.evaluate(() => {
    const m = document.getElementById('main-content');
    if (m) { document.documentElement.style.overflow = 'visible'; document.body.style.overflow = 'visible'; m.parentElement.style.height = 'auto'; m.parentElement.style.overflow = 'visible'; m.style.overflow = 'visible'; }
  });
  await page.screenshot({ path: path.join(OUT, `${label.replace(/[^a-z0-9]+/gi, '-')}.png`), fullPage: true });
  const errs = consoleErrors.splice(0).filter((e) => !/40[0-9]|ERR_ABORTED/.test(e));
  if (errs.length) ok(false, `${label}: console errors`, errs.join(' | '));
};

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const drive = (await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} Corp`, role: 'Engineer', type: 'Full-Time', ctc: 7.5, applicationMode: 'both', formUrl: 'https://forms.gle/pg', deadline: istDate(4), driveDate: istDate(9), eligibility: { branches: ['CE', 'IT'], cgpa: 6.5 }, jdDescription: '## Role\n- Build things\n\n| A | B |\n|---|---|\n| 1 | 2 |', selectionRounds: [{ roundName: 'Test', roundDescription: 'Aptitude' }], customPrompts: [{ question: 'Relocate?', required: true }], tags: ['Pune'] }) })).json()).data;
  const email = `${TAG.toLowerCase()}@example.com`;
  const s = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S`, password: 'goodpass123' }) });
  const sc = s.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ firstName: 'Mira', lastName: 'Shah', branch: 'CE', cgpa: 8.1, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/m.pdf' }) });
  await chooseInstitute(sc);
  await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ driveId: drive._id, consentGiven: true, customAnswers: [{ promptId: drive.customPrompts[0]._id, answer: 'Yes' }] }) });

  const browser = await chromium.launch();
  for (const [vp, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
    console.log(`# ${vp}`);
    const ctx = await browser.newContext({ viewport: { width, height } });
    await ctx.addInitScript(() => { try { localStorage.setItem('tpf:notificationCursor', JSON.stringify(new Date().toISOString())); } catch {} });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    for (const [name, route] of [['home', '/'], ['timeline', '/timeline'], ['drive', `/placement/${drive._id}`], ['login', '/login'], ['signup', '/signup'], ['admin-login', '/admin/login'], ['404', '/nope']]) {
      await page.goto(APP + route);
      await audit(page, `${vp} guest ${name}`, consoleErrors);
    }
    await page.goto(APP + '/login');
    await page.fill('#email', email);
    await page.fill('#password', 'goodpass123');
    await page.click('button[type=submit]');
    await page.waitForURL(APP + '/');
    for (const [name, route] of [['home', '/'], ['drive (applied)', `/placement/${drive._id}`], ['my applications', '/applications'], ['profile', '/profile'], ['change password', '/change-password']]) {
      await page.goto(APP + route);
      await audit(page, `${vp} student ${name}`, consoleErrors);
    }
    // Student logs out, admin logs in
    await page.goto(APP + '/');
    if (vp === 'phone') await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await until(async () => !(await page.getByRole('button', { name: 'Logout' }).count()));
    await page.goto(APP + '/admin/login');
    await page.fill('#username', 'testadmin');
    await page.fill('#password', 'testadminpass');
    await page.click('button[type=submit]');
    await page.waitForURL(/dashboard/);
    for (const [name, route] of [['dashboard', '/admin/dashboard'], ['students', '/admin/students'], ['applicants', `/admin/drives/${drive._id}/applicants`]]) {
      await page.goto(APP + route);
      await audit(page, `${vp} admin ${name}`, consoleErrors);
    }
    await page.goto(APP + '/admin/dashboard');
    await page.getByRole('button', { name: 'Add placement' }).click();
    await audit(page, `${vp} admin drive form`, consoleErrors);
    await ctx.close();
  }

  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
