// Icon font guard (audit L-3): the app loads only the Material Symbols icons it uses (icon_names=…).
// Checks that index.css and index.html request the same font URL, that every icon rendered on every
// page is in that list, and that each one draws as a glyph (not as its name in plain text).
// Needs internet access (the font comes from fonts.googleapis.com). Local stack only otherwise.
const TEST = require('../lib/env.cjs');
const { logout } = require('../lib/logout.cjs');
const { until, settled } = require('../lib/wait.cjs');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const mongoose = require(path.join(TEST.SERVER, 'node_modules/mongoose'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `PI${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const J = (c) => ({ 'Content-Type': 'application/json', Origin: APP, ...(c ? { Cookie: c } : {}) });

(async () => {
  console.log('# font URL');
  const css = fs.readFileSync(path.join(TEST.CLIENT, 'src/index.css'), 'utf8');
  const html = fs.readFileSync(path.join(TEST.CLIENT, 'index.html'), 'utf8');
  const cssUrl = (css.match(/@import url\('([^']*Material\+Symbols[^']*)'\)/) || [])[1];
  const htmlUrl = (html.match(/href="([^"]*Material\+Symbols[^"]*)"/) || [])[1];
  ok(Boolean(cssUrl) && cssUrl === htmlUrl, 'index.css @import and index.html preload request the same URL', `\n   css:  ${cssUrl}\n   html: ${htmlUrl}`);
  const requested = (new URL(cssUrl).searchParams.get('icon_names') || '').split(',').filter(Boolean);
  ok(requested.length > 0, `font URL lists icon_names (${requested.length})`);
  ok(requested.join(',') === [...requested].sort().join(','), 'icon_names are in alphabetical order (Google Fonts requires it)');

  await mongoose.connect(TEST.MONGODB_URI);
  const admin = (await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) })).headers.getSetCookie()[0].split(';')[0];
  const drive = (await (await fetch(API + '/api/admin/drives', { method: 'POST', headers: J(admin), body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 6, applicationMode: 'both', formUrl: 'https://forms.gle/x', deadline: istDate(2), driveDate: istDate(6), eligibility: { branches: ['CE'], cgpa: 6 }, customPrompts: [{ question: 'Q?', required: false }], selectionRounds: [{ roundName: 'Test' }], tags: ['Pune'] }) })).json()).data;
  const email = `${TAG.toLowerCase()}@example.com`;
  await fetch(API + '/api/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email, rollNumber: `${TAG}R`, password: 'goodpass123' }) });

  const browser = await chromium.launch();
  const seen = new Map(); // name -> { glyph: boolean, where }
  const collect = async (page, where) => {
    await settled(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.fonts].some((f) => /Material Symbols/.test(f.family) && f.status === 'loaded'), null, { timeout: 15000 }).catch(() => {});
    const found = await page.evaluate(() => [...document.querySelectorAll('.material-symbols-outlined')].filter((el) => el.offsetParent !== null).map((el) => {
      const r = el.getBoundingClientRect(); const size = parseFloat(getComputedStyle(el).fontSize);
      return { name: el.textContent.trim(), glyph: r.width > 0 && r.width <= size * 1.5 };
    }));
    for (const f of found) { const prev = seen.get(f.name); if (!prev || (prev.glyph && !f.glyph)) seen.set(f.name, { glyph: f.glyph, where }); }
  };
  for (const [vp, w, h] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const r of ['/', '/timeline', `/placement/${drive._id}`, '/login', '/signup', '/admin/login', '/nope']) { await page.goto(APP + r); await collect(page, `${vp} ${r}`); }
    if (vp === 'phone') { await page.goto(APP + '/'); await page.getByRole('button', { name: 'Open menu' }).click(); await collect(page, 'phone menu'); }
    else {
      await page.goto(APP + '/'); await page.getByRole('button', { name: /notification/i }).first().click(); await collect(page, 'notifications');
      await page.keyboard.press('Escape'); await page.getByRole('button', { name: /filters/i }).first().click(); await collect(page, 'filters');
      await page.fill('input[placeholder*="Search"]', 'zzzz-none'); await collect(page, 'empty search');
    }
    // student pages
    await page.goto(APP + '/login'); await page.fill('#email', email); await page.fill('#password', 'goodpass123'); await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login')).catch(() => {});
    for (const r of ['/', '/profile', '/applications', '/change-password', `/placement/${drive._id}`]) { await page.goto(APP + r); await collect(page, `${vp} student ${r}`); }
    await page.goto(APP + '/'); await logout(page);
    // admin pages
    await page.goto(APP + '/admin/login'); await page.fill('#username', 'testadmin'); await page.fill('#password', 'testadminpass'); await page.click('button[type=submit]');
    await page.waitForURL(/dashboard/).catch(() => {});
    for (const r of ['/admin/dashboard', '/admin/students', `/admin/drives/${drive._id}/applicants`]) { await page.goto(APP + r); await collect(page, `${vp} admin ${r}`); }
    await page.goto(APP + '/admin/dashboard'); await page.getByRole('button', { name: 'Add placement' }).click(); await collect(page, `${vp} drive form`);
    await page.keyboard.press('Escape');
    await until(async () => !(await page.getByRole('dialog').count()));
    await page.getByRole('button', { name: /delete/i }).first().click().catch(() => {}); await collect(page, `${vp} delete dialog`);
    await ctx.close();
  }
  await browser.close();

  console.log(`# ${seen.size} distinct icons rendered`);
  const notRequested = [...seen.keys()].filter((n) => !requested.includes(n));
  ok(notRequested.length === 0, 'every rendered icon is in icon_names', `missing: ${notRequested.join(', ')} — add them to the URL in index.css AND index.html`);
  const asText = [...seen.entries()].filter(([, v]) => !v.glyph).map(([n, v]) => `${n} (${v.where})`);
  ok(asText.length === 0, 'every rendered icon draws as a glyph, not as text', asText.join(', '));
  console.log(`  rendered: ${[...seen.keys()].sort().join(' ')}`);

  await mongoose.connection.db.collection('placements').deleteOne({ _id: new mongoose.Types.ObjectId(drive._id) });
  await mongoose.connection.db.collection('students').deleteMany({ email });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
