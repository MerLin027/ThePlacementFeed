// Upgrade Phase 5 checks (react-markdown 10): hostile drive descriptions are neutralised in the
// browser; normal markdown (GFM tables, lists, code, links) still renders and is styled.
// Local stack only (API 5099, Vite 5173, mongod 27099).
const TEST = require('../lib/env.cjs');
const path = require('path');
const { chromium } = require('playwright');
const API = TEST.API;
const APP = TEST.APP;
const TAG = `UP5${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

const HOSTILE = [
  '## About the role',
  'Normal **bold** text and a [safe link](https://example.com/jobs).',
  '',
  '- item one',
  '- item two',
  '',
  '1. first',
  '2. second',
  '',
  '| Col A | Col B |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '`inline code` and:',
  '',
  '```',
  'block code',
  '```',
  '',
  '> a quote',
  '',
  '<script>window.__xss = "script"</script>',
  '<img src="x" onerror="window.__xss = \'img\'">',
  '<iframe src="https://example.com"></iframe>',
  '<a href="javascript:window.__xss=\'link\'">js link</a>',
  '[md js link](javascript:window.__xss=1)',
  '<div style="position:fixed;inset:0;background:red" onclick="window.__xss=\'click\'">overlay</div>',
  '<svg><script>window.__xss="svg"</script></svg>',
  '<form action="https://evil.example"><input name="q"><button>go</button></form>',
  '<details open ontoggle="window.__xss=\'toggle\'"><summary>s</summary>d</details>',
  '<a href="https://example.com/raw">raw html link</a>',
].join('\n');

(async () => {
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const created = await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 5, applicationMode: 'external', formUrl: 'https://forms.gle/x', deadline: istDate(2), driveDate: istDate(5), eligibility: { branches: ['CE'] }, jdDescription: HOSTILE }) })).json();
  ok(created.success, 'setup: drive with hostile description created', JSON.stringify(created).slice(0, 200));
  const id = created.data._id;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(`${APP}/placement/${id}`);
  await page.locator('.markdown-body').waitFor();
  await page.waitForTimeout(800);
  // Try to trigger handlers that might have survived
  await page.locator('.markdown-body details').first().click().catch(() => {});
  await page.locator('.markdown-body >> text=overlay').first().click({ timeout: 1000 }).catch(() => {});

  const r = await page.evaluate(() => {
    const body = document.querySelector('.markdown-body');
    const all = [...body.querySelectorAll('*')];
    return {
      xss: window.__xss,
      scripts: body.querySelectorAll('script').length,
      iframes: body.querySelectorAll('iframe').length,
      forms: body.querySelectorAll('form, button, select, textarea').length,
      liveInputs: [...body.querySelectorAll('input')].filter((i) => !(i.type === 'checkbox' && i.disabled)).length,
      handlers: all.filter((el) => [...el.attributes].some((a) => a.name.startsWith('on'))).map((el) => el.outerHTML.slice(0, 80)),
      styles: all.filter((el) => el.hasAttribute('style')).length,
      jsLinks: [...body.querySelectorAll('a')].filter((a) => /^\s*javascript:/i.test(a.getAttribute('href') || '')).length,
      links: [...body.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })),
      h2: body.querySelector('h2')?.textContent,
      strong: body.querySelector('strong')?.textContent,
      ul: body.querySelectorAll('ul > li').length,
      ol: body.querySelectorAll('ol > li').length,
      table: body.querySelectorAll('table td').length,
      code: body.querySelector('pre code')?.textContent.trim(),
      inlineCode: body.querySelector('p code')?.textContent,
      quote: body.querySelector('blockquote')?.textContent.trim(),
      tableBorder: body.querySelector('table') && getComputedStyle(body.querySelector('table')).borderCollapse,
      listStyle: body.querySelector('ul') && getComputedStyle(body.querySelector('ul')).listStyleType,
    };
  });
  console.log('# hostile content neutralised');
  ok(r.xss === undefined && dialogs.length === 0, 'no injected script ran', `__xss=${r.xss} dialogs=${dialogs.join(',')}`);
  ok(r.scripts === 0, 'no <script> elements');
  ok(r.iframes === 0, 'no <iframe> elements');
  ok(r.forms === 0, 'no form, button, select or textarea');
  ok(r.liveInputs === 0, 'any surviving input is a disabled checkbox (GFM task list)');
  ok(r.handlers.length === 0, 'no on* attributes', r.handlers.join(' | '));
  ok(r.styles === 0, 'no inline style attributes');
  ok(r.jsLinks === 0, 'no javascript: links', JSON.stringify(r.links));
  ok(r.links.every((l) => l.target === '_blank' && l.rel === 'noopener noreferrer'), 'every link opens in a new tab with noopener noreferrer', JSON.stringify(r.links));
  ok(r.links.some((l) => l.href === 'https://example.com/jobs') && r.links.some((l) => l.href === 'https://example.com/raw'), 'safe markdown and raw-HTML links kept');
  console.log('# normal markdown still renders');
  ok(r.h2 === 'About the role' && r.strong === 'bold', 'heading and bold');
  ok(r.ul === 2 && r.ol === 2, 'bullet and numbered lists');
  ok(r.table === 2 && r.tableBorder === 'collapse', 'GFM table rendered and styled');
  ok(r.code === 'block code' && r.inlineCode === 'inline code', 'code block and inline code');
  ok(r.quote === 'a quote', 'blockquote');
  ok(r.listStyle === 'disc', 'list styling from .markdown-body');
  ok(consoleErrors.filter((e) => !/40[0-9]|ERR_ABORTED/.test(e)).length === 0, 'no console errors', consoleErrors.join(' | '));

  await browser.close();
  await fetch(API + `/api/placements/${id}`, { method: 'DELETE', headers: H });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
