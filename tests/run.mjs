// Regression runner: starts the API (fresh per suite, so in-memory rate limits reset) and the Vite dev
// server against a LOCAL MongoDB, runs each suite with a timeout and prints totals.
// A suite that ends without its summary line (crash, timeout, server failure) counts as failed.
//
//   node tests/run.mjs                 all suites
//   node tests/run.mjs phase3-api ...  selected suites (file name without extension)
//
// Requires a local mongod (default mongodb://127.0.0.1:27099/tpf_test, see tests/README.md).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const env = require('./lib/env.cjs');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(HERE, 'suites');
const LOGS = path.join(env.OUT, 'logs');
const SUITE_TIMEOUT_MS = 400_000;

const ALL = fs.readdirSync(SUITES_DIR).filter((f) => /\.(c|m)?js$/.test(f)).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
function order(f) { return /^phase\d/.test(f) ? 0 : /^phase[A-Z]/.test(f) ? 1 : /^eligibility/.test(f) ? 2 : 3; }
const wanted = process.argv.slice(2);
const suites = wanted.length ? ALL.filter((f) => wanted.includes(f.replace(/\.(c|m)?js$/, ''))) : ALL;
if (!suites.length) { console.error(`No matching suites. Available: ${ALL.join(', ')}`); process.exit(2); }

fs.mkdirSync(LOGS, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const up = async (url, tries = 60) => { for (let i = 0; i < tries; i++) { try { if ((await fetch(url)).ok) return true; } catch { /* not yet */ } await wait(500); } return false; };

// Test-only environment. The API runs with cwd = tests/output, so dotenv finds no .env file and
// nothing from the real server/.env (production Atlas) can leak in.
const apiEnv = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
  MONGODB_URI: env.assertLocalDb(), JWT_SECRET: 'test-secret-0123456789abcdef0123456789',
  COOKIE_SECRET: 'test-cookie-0123456789abcdef0123456', CLIENT_URL: env.APP, NODE_ENV: 'development',
  PORT: new URL(env.API).port, ADMIN_USERNAME: 'testadmin', ADMIN_PASSWORD: 'testadminpass', CRON_SECRET: env.CRON_SECRET,
  NODE_OPTIONS: process.env.NODE_OPTIONS || '',
};
let api = null;
// The previous instance's port can take a moment to be released, so a failed start is retried once.
// Each attempt's log is kept as tests/output/logs/<suite>.server-<n>.log for diagnosis.
const startApi = async (suite) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const log = fs.openSync(env.SERVER_LOG, 'w');
    api = spawn(process.execPath, [path.join(env.SERVER, 'index.js')], { cwd: env.OUT, env: apiEnv, stdio: ['ignore', log, log] });
    const exited = new Promise((r) => api.once('exit', () => r(false)));
    const ok = await Promise.race([up(`${env.API}/api/health`), exited]);
    fs.closeSync(log);
    if (ok) return true;
    fs.copyFileSync(env.SERVER_LOG, path.join(LOGS, `${suite}.server-${attempt}.log`));
    await stopApi();
    await wait(2000);
  }
  return false;
};
const stopApi = async () => { if (api && api.exitCode === null) { api.kill(); await new Promise((r) => api.once('exit', r)); } api = null; };

const startVite = async () => {
  const vite = spawn(process.execPath, [path.join(env.CLIENT, 'node_modules/vite/bin/vite.js'), '--port', new URL(env.APP).port, '--strictPort'], {
    cwd: env.CLIENT, env: { ...process.env, VITE_API_URL: env.API }, stdio: ['ignore', fs.openSync(path.join(env.OUT, 'vite.log'), 'w'), 'pipe'],
  });
  const ok = await up(env.APP);
  if (ok) await fetch(`${env.APP}/src/main.jsx`).catch(() => {}); // warm the dependency optimiser
  return { vite, ok };
};

const runSuite = (file) => new Promise((resolve) => {
  const out = fs.createWriteStream(path.join(LOGS, `${file}.log`));
  const child = spawn(process.execPath, [path.join(SUITES_DIR, file)], {
    cwd: env.OUT, env: { ...process.env, TEST_SERVER_LOG: env.SERVER_LOG, CRON_SECRET_TEST: env.CRON_SECRET, PLAYWRIGHT_BROWSERS_PATH: path.join(HERE, '.playwright-browsers') }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let text = '';
  const onData = (d) => { text += d; out.write(d); };
  child.stdout.on('data', onData); child.stderr.on('data', onData);
  const timer = setTimeout(() => { text += '\nTIMEOUT\n'; child.kill(); }, SUITE_TIMEOUT_MS);
  child.on('exit', (code) => { clearTimeout(timer); out.end(); resolve({ code, text }); });
});

const cleanup = () => new Promise((r) => spawn(process.execPath, [path.join(HERE, 'lib', 'cleanup.cjs')], { stdio: 'inherit' }).on('exit', r));

(async () => {
  console.log(`node ${process.version} · db ${env.MONGODB_URI} · ${suites.length} suite(s)`);
  await cleanup();
  const { vite, ok: viteOk } = await startVite();
  if (!viteOk) { console.error('Vite did not start — see tests/output/vite.log'); process.exit(2); }
  let passed = 0, failed = 0; const broken = [];
  for (const file of suites) {
    await stopApi();
    if (!(await startApi(file))) { broken.push(`${file}: API did not start (tests/output/server.log)`); console.log(`${file.padEnd(24)} API did not start`); continue; }
    const { code, text } = await runSuite(file);
    const summary = text.match(/(\d+) passed, (\d+) failed\s*$/m) || text.match(/(\d+)\/(\d+) passed\s*$/m);
    let line;
    if (summary && /\/\d+ passed/.test(summary[0])) { const p = +summary[1], t = +summary[2]; passed += p; failed += t - p; line = `${p}/${t} passed`; }
    else if (summary) { passed += +summary[1]; failed += +summary[2]; line = `${summary[1]} passed, ${summary[2]} failed`; }
    if (!summary || /CRASH|TIMEOUT/.test(text)) broken.push(`${file}: ${/TIMEOUT/.test(text) ? 'timed out' : /CRASH/.test(text) ? 'crashed' : `no summary (exit ${code})`}`);
    console.log(`${file.padEnd(24)} ${line || 'NO SUMMARY'}`);
    for (const l of text.split('\n').filter((x) => /^\s*FAIL|CRASH|TIMEOUT/.test(x)).slice(0, 5)) console.log('   ', l.trim());
  }
  await stopApi();
  vite.kill();
  console.log(`\nTOTAL ${passed} passed, ${failed} failed, ${broken.length} suite(s) without a clean finish`);
  broken.forEach((b) => console.log('  !', b));
  process.exit(failed || broken.length ? 1 : 0);
})().catch(async (e) => { console.error(e); await stopApi(); process.exit(2); });
