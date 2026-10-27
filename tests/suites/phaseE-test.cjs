// Phase E verification — student-facing pages. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { settleAnimations } = require('../lib/settle.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium, devices } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const AXE = TEST.AXE;
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `PE${Date.now() % 100000}`;

const axeScan = async (page, label) => {
  await settleAnimations(page);

  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations
    .filter((x) => x.impact === 'serious' || x.impact === 'critical')
    .map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  ok(v.length === 0, `axe clean: ${label}`, v.join('\n      '));
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const mk = async (name, extra = {}) => {
    const r = await fetch(API + '/api/admin/drives', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} ${name}`, role: 'Analyst', type: 'Full-Time', ctc: 6, ...extra }) });
    const j = await r.json();
    if (r.status !== 201) throw new Error(name + ' ' + JSON.stringify(j));
    return j.data;
  };
  const A = await mk('Apex', { deadline: istDate(5), driveDate: istDate(9), formUrl: 'https://forms.gle/apex', eligibility: { branches: ['CE', 'IT'] } });
  const B = await mk('Bolt', { deadline: istDate(1), driveDate: istDate(6), applicationMode: 'in_app', selectionRounds: [{ roundName: 'Aptitude' }], jdDescription: '## Role\nGood role' });
  const C = await mk('Cyan', { driveDate: istDate(3) });
  const D = await mk('Dune', {});
  const E = await mk('Echo', { deadline: istDate(-1), driveDate: istDate(4) });
  const F = await mk('Flux', { deadline: istDate(2), driveDate: istDate(7), isPostponed: true });
  const G = await mk('Gale', { deadline: istDate(-9), driveDate: istDate(-3) });

  console.log('# API: multi-status + closing soon');
  const q = async (qs) => (await fetch(`${API}/api/drives?search=${TAG}&${qs}`)).json();
  let r = await q('status=Upcoming,Ongoing&sort=closing_soon&limit=50');
  const names = r.data.map((p) => p.company.replace(`${TAG} `, ''));
  ok(names.join(',') === 'Bolt,Cyan,Apex,Dune,Echo,Flux', `closing-soon order (${names.join(',')})`);
  ok(!names.includes('Gale') && r.pagination.total === 6, 'Completed excluded by multi-status filter');
  r = await q('status=Upcoming,Ongoing&sort=closing_soon&limit=2&page=2');
  ok(r.data.map((p) => p.company.replace(`${TAG} `, '')).join(',') === 'Apex,Dune' && r.pagination.totalPages === 3, 'pagination over the aggregate');
  ok(r.data.every((p) => p._rank === undefined && p._closesAt === undefined), 'helper fields not leaked');
  let res = await fetch(`${API}/api/drives?status=Upcoming,Hired`);
  ok(res.status === 400, 'invalid status in list -> 400');
  res = await fetch(`${API}/api/drives?sort=random`);
  ok(res.status === 400, 'unknown sort -> 400');
  res = await fetch(`${API}/api/drives?status[$ne]=x`);
  ok(res.status === 400, 'operator object as status -> 400');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('tpf:notificationCursor', JSON.stringify(new Date().toISOString())); } catch {} });
  const page = await ctx.newPage();
  const popups = [];
  ctx.on('page', (p) => popups.push(p));

  console.log('# Home');
  await page.goto(APP + '/');
  await page.getByLabel('Search drives by company or role').fill(TAG);
  const headings = () => page.locator('main article h3').allInnerTexts();
  await until(async () => (await headings()).length === 6 && (await headings()).every((t) => t.startsWith(TAG)));
  const cards = await headings();
  ok(cards.map((t) => t.replace(`${TAG} `, '')).join(',') === 'Bolt,Cyan,Apex,Dune,Echo,Flux', `open drives first, closing soonest first (${cards.join(',')})`);
  const card = (n) => page.locator('article', { hasText: `${TAG} ${n}` }).first();
  ok((await card('Bolt').innerText()).includes('Closes tomorrow'), 'urgency chip: Closes tomorrow');
  ok((await card('Apex').innerText()).includes('Closes in 5 days'), 'urgency chip: Closes in 5 days');
  ok((await card('Flux').innerText()).includes('New dates to be announced'), 'postponed card explains dates');
  ok((await card('Apex').innerText()).includes('Computer Engineering, Information Technology'), 'branches row');
  ok((await card('Apex').locator('[aria-hidden=true]').first().innerText()) === 'PA', 'company monogram (initials of first two words)');
  ok((await card('Echo').innerText()).includes('Drive on'), 'ongoing card shows drive date');
  ok(await page.getByText('Showing 6 of 6 open drives').isVisible(), 'live result count');
  const pastBtn = page.getByRole('button', { name: /Past drives/ });
  ok((await pastBtn.innerText()).includes('(1)') && (await pastBtn.getAttribute('aria-expanded')) === 'false', 'past drives collapsed with count');
  ok(!(await card('Gale').count()), 'completed drive not in main grid');
  await pastBtn.click();
  ok(await card('Gale').isVisible() && (await pastBtn.getAttribute('aria-expanded')) === 'true', 'expands to show completed drive');
  ok((await card('Gale').innerText()).includes('Drive held'), 'past card says "Drive held"');
  await page.screenshot({ path: path.join(TEST.OUT, 'shots', 'E-home-desktop.png'), fullPage: false });

  // Stretched link: clicking the card body opens the drive; the apply button does its own thing
  await card('Apex').getByRole('button', { name: 'Apply now' }).click();
  await until(() => popups.some((p) => p.url().includes('forms.gle/apex')), { timeout: 5000 });
  ok(page.url() === APP + '/' && popups.some((p) => p.url().includes('forms.gle/apex')), 'apply button opens the form, not the card link');
  for (const p of popups) await p.close().catch(() => {});
  await card('Apex').getByText('₹6 LPA').click({ force: true }); // lands on the stretched link overlay
  ok(await page.waitForURL(new RegExp(`/placement/${A._id}`)).then(() => true, () => false), 'clicking the card body opens the drive');

  console.log('# Status filter');
  await page.goto(APP + '/');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('Completed');
  await page.getByLabel('Search drives by company or role').fill(TAG);
  ok(await hasText(page, 'Past Drives') && await until(async () => (await page.locator('main h1').innerText()) === 'Past Drives'), 'heading follows the status filter');
  ok(await until(async () => (await page.locator('main article h3').allInnerTexts()).join(',') === `${TAG} Gale`), 'only completed drives');
  ok(!(await page.getByRole('button', { name: /^Past drives/ }).count()), 'no separate past section when filtering by status');
  ok(await page.getByLabel('Sort by').isVisible() && await page.getByLabel('Branch', { exact: true }).isVisible(), 'filter controls are labelled');
  await axeScan(page, 'home with filters open');

  console.log('# Drive detail');
  await page.goto(`${APP}/placement/${A._id}`);
  ok(await hasText(page, 'Closes in 5 days'), 'detail shows countdown');
  const box = async (sel) => (await page.locator(sel).first().boundingBox());
  const elig = await box('section:has(h2:text("Eligibility Criteria"))');
  const dates = await box('section:has(h2:text("Important Dates"))');
  ok(dates.x < elig.x, 'desktop: dates in the left column, eligibility on the right');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/placement/${B._id}`);
  const headingTops = () => page.evaluate(() => ['Eligibility Criteria', 'Important Dates', 'Selection Process', 'Job Description'].map((t) => {
    const h = [...document.querySelectorAll('main h2')].find((x) => x.textContent.trim() === t);
    return h ? Math.round(h.getBoundingClientRect().top) : null;
  }));
  // All four sections rendered (the job description loads lazily) and entrance animations finished
  await until(async () => (await headingTops()).every((v) => v !== null));
  await settleAnimations(page);
  const order = await headingTops();
  const apply = await box('main h1');
  ok(order.every((v) => v !== null) && apply.y < order[0] && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], `mobile order: drive → eligibility → dates → process → description (${order.join(',')})`);
  await page.screenshot({ path: path.join(TEST.OUT, 'shots', 'E-detail-mobile.png'), fullPage: true });
  await axeScan(page, 'detail (mobile)');
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('# Timeline (more than 50 drives)');
  // Inserted directly: the admin API is rate-limited to 50 changes per 15 minutes
  await Placement.insertMany(Array.from({ length: 52 }, (_, i) => ({ company: `${TAG} Bulk${String(i).padStart(2, '0')}`, role: 'Analyst', type: 'Full-Time', ctc: 5, status: 'Upcoming', driveDate: new Date(istDate(20 + (i % 10))) })));
  await page.goto(APP + '/timeline');
  const timelineLinks = page.locator('main li a', { hasText: TAG });
  await until(async () => (await timelineLinks.count()) >= 59, { timeout: 15000 }); // every page of drives fetched
  const tlCount = await timelineLinks.count();
  ok(tlCount === 59, `timeline lists every drive past the 50-per-page cap (${tlCount}/59)`);
  ok(await hasText(page, 'Today ·'), '"Today" divider');
  ok(await hasText(page, 'This month'), 'current month marked');
  await axeScan(page, 'timeline');

  console.log('# Dialog focus (apply modal) + mobile menu');
  const email = `${TAG.toLowerCase()}@example.com`;
  const s = await fetch(API + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S`, password: 'goodpass123' }) });
  const sc = s.headers.getSetCookie().find((c) => c.startsWith('tpf_session=')).split(';')[0];
  await fetch(API + '/api/student/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ firstName: 'Ved', lastName: 'Shah', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/v.pdf' }) });
  await chooseInstitute(sc);
  await page.goto(APP + '/login');
  await page.fill('#identifier', email);
  await page.fill('#password', 'goodpass123');
  await page.click('button[type=submit]');
  await page.waitForURL(APP + '/');
  await page.goto(`${APP}/placement/${B._id}`);
  const applyBtn = page.getByRole('button', { name: 'Apply now' });
  await applyBtn.click();
  const dialog = page.getByRole('dialog', { name: `Apply to ${TAG} Bolt` });
  ok(await dialog.isVisible(), 'apply form is a labelled dialog');
  ok(await page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]'))), 'focus moved into the dialog');
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]'))), 'Tab stays inside the dialog');
  await page.keyboard.press('Escape');
  ok(await until(async () => !(await dialog.count())), 'Escape closes it');
  ok(await until(() => page.evaluate(() => document.activeElement?.textContent?.trim() === 'Apply now')), 'focus returns to the Apply button');

  const mctx = await browser.newContext({ ...devices['Pixel 7'] });
  const mp = await mctx.newPage();
  await mp.goto(APP + '/');
  await mp.getByRole('button', { name: 'Open menu' }).tap();
  ok(await mp.locator('#mobile-menu').isVisible(), 'mobile menu opens');
  await mp.keyboard.press('Escape');
  ok(!(await mp.locator('#mobile-menu').count()) && await mp.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Open menu'), 'Escape closes menu and returns focus');
  await mp.getByRole('button', { name: 'Open menu' }).tap();
  await mp.locator('#mobile-menu').getByText('Timeline').tap();
  await mp.waitForURL(/timeline/);
  ok(!(await mp.locator('#mobile-menu').count()), 'menu closes after navigating');
  await mctx.close();

  console.log('# 404');
  await page.goto(APP + '/no-such-page');
  ok(await hasText(page, 'Page not found') && await page.getByRole('link', { name: 'Browse drives' }).isVisible(), '404 offers a way back');
  await axeScan(page, '404');

  // cleanup
  const ids = (await Placement.find({ company: { $regex: `^${TAG}` } }).select('_id').lean()).map((d) => d._id);
  await Application.deleteMany({ driveId: { $in: ids } });
  await Placement.deleteMany({ _id: { $in: ids } });
  await Student.deleteMany({ email });
  await browser.close();
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
