// Session probes (audit L-3): without a session cookie, GET /api/auth/check and /api/students/auth/check
// answer 200 { authenticated: false }, so pages no longer log a 401 for every visitor. A guest, a student
// (no admin cookie) and the admin (no student cookie) browse a few pages; no probe may answer 401.
// A cookie that is present but invalid must still get 401 (covered in phase1-test and upgrade3-test).
const TEST = require('../lib/env.cjs');
const { logout } = require('../lib/logout.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const { chromium } = require('playwright');
const mongoose = require(path.join(TEST.SERVER, 'node_modules/mongoose'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `PS${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const J = { 'Content-Type': 'application/json', Origin: APP };
const PROBES = /\/api\/(students\/)?auth\/check$/;

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const email = `${TAG.toLowerCase()}@example.com`;
  const su = await fetch(`${API}/api/students/auth/signup`, { method: 'POST', headers: J, body: JSON.stringify({ email, rollNumber: `${TAG}R`, password: 'goodpass123' }) });
  ok(su.status === 201, 'test student created');
  const drive = (await (await fetch(`${API}/api/placements?limit=1`)).json()).data[0];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const probes = [];
  page.on('response', (r) => { const u = new URL(r.url()); if (PROBES.test(u.pathname)) probes.push({ path: u.pathname, status: r.status() }); });
  const browse = async (routes) => {
    probes.length = 0;
    for (const r of routes) { await page.goto(APP + r); await page.waitForLoadState('networkidle').catch(() => {}); }
    return probes.slice();
  };
  const routes = ['/', '/timeline', ...(drive ? [`/placement/${drive._id}`] : []), '/login'];

  console.log('# guest');
  let seen = await browse(routes);
  ok(seen.length >= routes.length * 2, `both probes asked on every page (${seen.length} responses)`);
  ok(seen.every((p) => p.status === 200), 'guest: no probe answers 401', JSON.stringify(seen.filter((p) => p.status !== 200)));

  console.log('# student');
  await page.goto(APP + '/login'); await page.fill('#email', email); await page.fill('#password', 'goodpass123'); await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  seen = await browse(['/', '/applications', '/profile']);
  ok(seen.some((p) => p.path === '/api/students/auth/check' && p.status === 200), 'student session recognised');
  ok(seen.every((p) => p.status === 200), 'student: the admin probe does not answer 401', JSON.stringify(seen.filter((p) => p.status !== 200)));
  ok(await page.getByRole('link', { name: 'My applications' }).first().isVisible(), 'student navigation shown');
  await logout(page);

  console.log('# admin');
  await page.goto(APP + '/admin/login'); await page.fill('#username', 'testadmin'); await page.fill('#password', 'testadminpass'); await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\/dashboard/);
  seen = await browse(['/admin/dashboard', '/', '/admin/students']);
  ok(seen.every((p) => p.status === 200), 'admin: the student probe does not answer 401', JSON.stringify(seen.filter((p) => p.status !== 200)));
  ok(await page.getByRole('button', { name: 'Add placement' }).isVisible().catch(() => false) || page.url().includes('/admin/students'), 'admin pages still load');

  console.log('# expired session still reads as logged out');
  await ctx.addCookies([{ name: 'student_token', value: 'garbage', url: API }]);
  probes.length = 0;
  await page.goto(APP + '/applications'); await page.waitForLoadState('networkidle').catch(() => {});
  ok(probes.some((p) => p.path === '/api/students/auth/check' && p.status === 401), 'a bad student cookie still gets 401');
  ok(/\/login/.test(page.url()), 'and the student-only page sends the visitor to log in', page.url());

  await browser.close();
  await mongoose.connection.db.collection('students').deleteMany({ email });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
