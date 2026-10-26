// Site upgrade, part D — motion: the cursor-reactive backdrop (live with a mouse, idle when settled,
// still under reduced motion / on touch), a dialog leaving after its exit, and the My applications
// redesign (tabs, counts, status details). Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const { until, settled, sleep } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const mongoose = require(path.join(TEST.SERVER, 'node_modules/mongoose'));
const Student = require(path.join(TEST.SERVER, 'src/models/Student'));
const Application = require(path.join(TEST.SERVER, 'src/models/Application'));
const Placement = require(path.join(TEST.SERVER, 'src/models/Placement'));
const APP = TEST.APP;
const API = TEST.API;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const hasText = (scope, t, timeout = 8000) => scope.getByText(t, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false);
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `SD${Date.now() % 100000}`;
const J = (cookie) => ({ 'Content-Type': 'application/json', Origin: APP, ...(cookie ? { Cookie: cookie } : {}) });

const frames = (page) => page.evaluate(() => window.__tpfBackdropFrames || 0);
// Sum of the canvas alpha in a box around a point (the dots there change when pushed)
const inkAround = (page, x, y) => page.evaluate(([px, py]) => {
  const c = document.querySelector('[data-backdrop] canvas');
  if (!c) return -1;
  const dpr = c.width / c.clientWidth;
  const d = c.getContext('2d').getImageData((px - 60) * dpr, (py - 60) * dpr, 120 * dpr, 120 * dpr).data;
  let sum = 0;
  for (let i = 3; i < d.length; i += 4) sum += d[i];
  return sum;
}, [x, y]);

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const mk = async (name, type) => (await (await fetch(API + '/api/admin/drives', { method: 'POST', headers: J(admin), body: JSON.stringify({ company: `${TAG} ${name}`, role: 'Analyst', type, ctc: 7, applicationMode: 'in_app', deadline: istDate(4), driveDate: istDate(8) }) })).json()).data;
  const d1 = await mk('Alpha', 'Full-Time');
  const d2 = await mk('Beta', 'Internship');
  const email = `${TAG.toLowerCase()}_s@example.com`;
  const s = await fetch(API + '/api/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email, rollNumber: `${TAG}S1`, password: 'goodpass123' }) });
  const sc = s.headers.getSetCookie().find((c) => c.startsWith('tpf_session=')).split(';')[0];
  await fetch(API + '/api/student/profile', { method: 'PATCH', headers: J(sc), body: JSON.stringify({ firstName: 'Kavya', lastName: 'Rao', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/k.pdf' }) });
  await chooseInstitute(sc);
  for (const d of [d1, d2]) await fetch(API + '/api/student/applications', { method: 'POST', headers: J(sc), body: JSON.stringify({ driveId: d._id, consentGiven: true }) });
  await Application.updateOne({ driveId: d2._id }, { $set: { status: 'Offered' } });

  const browser = await chromium.launch();
  const errors = [];

  console.log('# Backdrop with a mouse');
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP + '/');
  await settled(page);
  const bd = page.locator('[data-backdrop]');
  ok(await bd.getAttribute('data-backdrop') === 'live' && await bd.getAttribute('data-intensity') === 'hero', 'home: live canvas at hero intensity');
  ok(await page.locator('[data-backdrop] canvas').count() === 1, 'one canvas');
  ok(await bd.evaluate((el) => !el.closest('main') && getComputedStyle(el).position === 'fixed' && getComputedStyle(el).pointerEvents === 'none'), 'fixed, outside <main>, ignores the pointer');
  await page.mouse.move(40, 760);
  await sleep(600);
  const before = await inkAround(page, 640, 420);
  const f0 = await frames(page);
  for (let i = 0; i <= 12; i++) await page.mouse.move(560 + i * 12, 420);
  await sleep(80);
  const during = await inkAround(page, 640, 420);
  ok(await frames(page) > f0, 'moving the mouse runs the animation');
  ok(during !== before, 'dots near the pointer change', `${before} -> ${during}`);
  await sleep(1500);
  const f1 = await frames(page);
  await sleep(700);
  ok(await frames(page) === f1, 'loop stops once the dots settle (pointer resting)');
  await page.mouse.move(40, 760);
  await sleep(1500);
  const f2 = await frames(page);
  await sleep(700);
  const after = await inkAround(page, 640, 420);
  ok(await frames(page) === f2 && Math.abs(after - before) <= before * 0.02, 'dots spring back and the loop stops again', `${before} vs ${after}`);
  for (const route of ['/timeline', '/login', '/signup']) {
    await page.goto(APP + route);
    await settled(page);
    ok(await bd.getAttribute('data-intensity') === 'hero' && await bd.getAttribute('data-backdrop') === 'live', `${route}: the same live background as the home page`);
  }
  await ctx.close();

  console.log('# Reduced motion and touch: the still grid');
  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  await page.goto(APP + '/');
  await settled(page);
  ok(await page.locator('[data-backdrop]').getAttribute('data-backdrop') === 'static' && await page.locator('[data-backdrop] canvas').count() === 0, 'reduced motion: no canvas');
  await page.mouse.move(600, 400);
  await sleep(300);
  ok(await frames(page) === 0, 'reduced motion: no animation frames');
  await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  page = await ctx.newPage();
  await page.goto(APP + '/');
  await settled(page);
  ok(await page.locator('[data-backdrop]').getAttribute('data-backdrop') === 'static' && await page.locator('[data-backdrop] canvas').count() === 0, 'touch screen: no canvas');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.backdrop-dots')).opacity) !== '0', 'touch screen: dot grid visible');
  await ctx.close();

  console.log('# My applications');
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP + '/login');
  await page.fill('#email', email);
  await page.fill('#password', 'goodpass123');
  await page.click('button[type=submit]');
  await page.waitForURL(APP + '/');
  ok(await until(async () => (await page.locator('header nav a[aria-current=page]').count()) >= 1), 'nav marks the current page');
  await page.goto(APP + '/applications');
  await page.locator('[role=tab]').first().waitFor();
  ok(await until(async () => (await page.locator('[role=tab]', { hasText: 'All' }).innerText()).includes('2')), 'All tab counts 2');
  const beta = page.locator('li', { hasText: `${TAG} Beta` });
  ok(await hasText(beta, 'Selected') && await hasText(beta, 'Internship'), 'card shows status "Selected" and the drive type');
  ok(await hasText(page.locator('li', { hasText: `${TAG} Alpha` }), '₹7 LPA'), 'card shows the CTC');
  await page.click('[role=tab]:has-text("Selected")');
  ok(await until(async () => new URL(page.url()).searchParams.get('tab') === 'selected'), 'tab kept in the URL');
  ok(await until(async () => (await page.locator('ul[aria-label="Your applications"] > li').count()) === 1) && await hasText(page, `${TAG} Beta`), 'Selected tab lists only the selection');
  ok((await page.locator('[role=tab][aria-selected=true]').innerText()).startsWith('Selected'), 'selected tab is marked');
  await page.click('[role=tab]:has-text("Closed")');
  ok(await hasText(page, 'Nothing closed'), 'empty tab explains itself');
  await page.reload();
  ok(await until(async () => (await page.locator('[role=tab][aria-selected=true]').innerText()).startsWith('Closed')), 'tab survives a reload');
  let r = await fetch(API + '/api/student/applications?group=bogus', { headers: J(sc) });
  ok(r.status === 400, 'API: unknown group -> 400');
  r = await (await fetch(API + '/api/student/applications?group=active', { headers: J(sc) })).json();
  ok(r.data.length === 1 && r.counts.all === 2 && r.counts.selected === 1 && r.data[0].type === 'Full-Time', 'API: group filter, counts and drive details');
  await ctx.close();

  console.log('# A dialog leaves after its exit animation');
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  await page.goto(APP + '/admin/login');
  await page.fill('#username', 'testadmin');
  await page.fill('#password', 'testadminpass');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  await page.getByLabel('Search drives').fill(TAG);
  // The search reloads the table (rows become skeletons) after its debounce: wait for the results
  await until(async () => (await page.locator('tbody tr').count()) === 2 && (await page.locator('tbody tr', { hasText: `${TAG} Alpha` }).count()) === 1);
  await settled(page);
  const del = page.getByRole('button', { name: `Delete ${TAG} Alpha` }).first();
  await del.click();
  const dlg = page.locator('[role=alertdialog]');
  await dlg.waitFor();
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  ok(await until(async () => (await page.locator('[role=alertdialog]').count()) === 0, { timeout: 2000 }), 'confirm dialog unmounts after closing');
  ok(await until(async () => (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '')).startsWith('Delete')), 'focus returns to the Delete button', await page.evaluate(() => { const a = document.activeElement; return `${a?.tagName} ${a?.getAttribute('aria-label') || ''} ${(a?.textContent || '').trim().slice(0, 30)} inMain=${!!a?.closest('main')}`; }));
  await ctx.close();

  ok(errors.length === 0, 'no page errors', errors.join('\n    '));

  await browser.close();
  await Application.deleteMany({ driveId: { $in: [d1._id, d2._id] } });
  await Placement.deleteMany({ _id: { $in: [d1._id, d2._id] } });
  await Student.deleteOne({ email });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
