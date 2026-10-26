// Upgrade Phase 2 checks: helmet 8 headers, bcryptjs 3 hash compatibility, express-rate-limit 8
// keying and boot-log warnings. Local stack only (API on 5099, mongod 27099).
const TEST = require('../lib/env.cjs');
const path = require('path');
const fs = require('fs');
const SERVER = TEST.SERVER;
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const { ipKeyGenerator } = require(path.join(SERVER, 'node_modules/express-rate-limit'));
const API = TEST.API;
const APP = TEST.APP;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

(async () => {
  console.log('# helmet 8');
  const r = await fetch(API + '/api/health');
  const h = (n) => r.headers.get(n) || '';
  ok(/max-age=31536000/.test(h('strict-transport-security')), 'HSTS max-age is 365 days', h('strict-transport-security'));
  ok(/includeSubDomains/.test(h('strict-transport-security')), 'HSTS includeSubDomains');
  ok(/default-src 'self'/.test(h('content-security-policy')), 'CSP default-src self', h('content-security-policy'));
  ok(h('x-content-type-options') === 'nosniff', 'nosniff');
  ok(h('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options SAMEORIGIN', h('x-frame-options'));
  ok(!h('x-powered-by'), 'no X-Powered-By');
  const pre = await fetch(API + '/api/drives', { headers: { Origin: APP } });
  ok(pre.headers.get('access-control-allow-origin') === APP && pre.headers.get('access-control-allow-credentials') === 'true', 'CORS still allows the client origin with credentials');

  console.log('# bcryptjs 3');
  const legacy = '$2a$12$GKh7blGTmDJaRLvz9YzfR.mNa5ByAsSvWCpRnGbSpYlJG1.9g0x1u'; // DUMMY hash made by bcryptjs 2
  ok((await bcrypt.compare('anything', legacy)) === false, 'legacy $2a$ hash compares (false for wrong password, no throw)');
  const old2a = await bcrypt.hash('college123', await bcrypt.genSalt(4)); // whatever prefix v3 makes
  ok(await bcrypt.compare('college123', old2a), 'new hash verifies');
  ok(/^\$2[ab]\$/.test(old2a), `new hash prefix ${old2a.slice(0, 4)}`);
  // A $2a$ hash generated with known input (cost 4) — must still verify under v3
  const known2a = '$2a$04$' + old2a.slice(7); // same salt+digest with $2a$ prefix: identical algorithm for ASCII input
  ok(await bcrypt.compare('college123', known2a), '$2a$ variant of the same hash verifies');
  ok(!(await bcrypt.compare('college124', known2a)), 'wrong password rejected');
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
  ok(login.status === 200, 'admin login with hash created before the upgrade');

  console.log('# express-rate-limit 8');
  ok(ipKeyGenerator('203.0.113.7') === '203.0.113.7', 'IPv4 key unchanged');
  ok(ipKeyGenerator('2001:db8:abcd:12::1') === ipKeyGenerator('2001:db8:abcd:12:ffff::9'), 'IPv6 addresses in one /56 share a key');
  ok(ipKeyGenerator('::ffff:203.0.113.7') !== ipKeyGenerator('::ffff:198.51.100.1'), 'IPv4-mapped clients do NOT share one key (8.0.0–8.0.1 bug)');
  // Per-account login lockout: 5 failures then 429
  const email = `rl${Date.now()}@example.com`;
  let last;
  for (let i = 0; i < 6; i++) {
    last = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: email, password: 'wrongpass1' }) });
  }
  ok(last.status === 429, 'per-account login limiter still trips after 5 failures', String(last.status));
  ok(last.headers.get('ratelimit-limit') === '5' || /limit=5/.test(last.headers.get('ratelimit') || '') || last.headers.has('ratelimit-policy'), 'standard RateLimit headers present');
  const other = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: 'x' + email, password: 'wrongpass1' }) });
  ok(other.status !== 429, 'a different account from the same IP is not locked', String(other.status));

  console.log('# boot log');
  const log = fs.readFileSync(TEST.SERVER_LOG, 'utf8');
  ok(!/ERR_ERL|ValidationError|deprecat/i.test(log), 'no rate-limit validation or deprecation warnings', log.match(/.*(ERR_ERL|ValidationError|deprecat).*/i)?.[0]);
  ok(!/injecting env|dotenv@/i.test(log), 'no dotenv banner');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
