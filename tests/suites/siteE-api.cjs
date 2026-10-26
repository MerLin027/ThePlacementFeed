// Site upgrade, part E — the admin's own password change (validation, sessions revoked, rate limit),
// the admin check naming the account, no-store on API responses, and the proxy-secret middleware
// that decides whether the visitor address forwarded by Vercel is believed.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const { createTrustedProxy } = require(path.join(SERVER, 'src/middleware/trustedProxy'));

const API = TEST.API;
const ORIGIN = TEST.APP;
const PASSWORD = 'testadminpass';
const NEW_PASSWORD = 'a-new-admin-pass-1';
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const call = async (method, url, { body, cookie, origin = ORIGIN } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers, setCookie: res.headers.getSetCookie() };
};
const cookieOf = (r, name) => (r.setCookie.find((c) => c.startsWith(name + '=')) || '').split(';')[0];
const login = async (password) => call('POST', '/api/auth/login', { body: { username: 'testadmin', password } });
const fieldError = (r, field) => (r.json.errors || []).find((e) => e.field === field)?.message || '';

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  try {
    console.log('# The admin check names the account');
    let r = await login(PASSWORD);
    const first = cookieOf(r, 'admin_token');
    ok(r.status === 200 && first, 'admin logs in');
    r = await call('GET', '/api/auth/check', { cookie: first });
    ok(r.status === 200 && r.json.authenticated === true && r.json.username === 'testadmin', 'check returns the username', JSON.stringify(r.json));
    ok(r.headers.get('cache-control') === 'no-store', 'API responses are no-store', r.headers.get('cache-control'));

    console.log('# Guards and validation');
    r = await call('POST', '/api/auth/password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    ok(r.status === 401, 'no session -> 401', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, origin: 'https://evil.example', body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    ok(r.status === 403, 'foreign Origin -> 403 (CSRF)', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: 'short' } });
    ok(r.status === 400 && /8/.test(fieldError(r, 'newPassword')), 'too short -> 400 on newPassword', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: PASSWORD } });
    ok(r.status === 400 && /different/.test(fieldError(r, 'newPassword')), 'same as current -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { newPassword: NEW_PASSWORD } });
    ok(r.status === 400 && fieldError(r, 'currentPassword'), 'missing current -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: { $ne: null }, newPassword: NEW_PASSWORD } });
    ok(r.status === 400, 'operator object as current -> 400', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: 'wrong-password', newPassword: NEW_PASSWORD } });
    ok(r.status === 400 && /incorrect/.test(fieldError(r, 'currentPassword')), 'wrong current -> 400 on currentPassword', JSON.stringify(r.json));
    ok(await bcrypt.compare(PASSWORD, (await Admin.findOne({ username: 'testadmin' })).passwordHash), 'failed attempts leave the password alone');

    console.log('# A change signs out every other session and keeps this one');
    const other = cookieOf(await login(PASSWORD), 'admin_token');
    const versionBefore = (await Admin.findOne({ username: 'testadmin' }).lean()).tokenVersion ?? 0;
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    const fresh = cookieOf(r, 'admin_token');
    ok(r.status === 200 && fresh && fresh !== first, 'change -> 200 with a fresh session cookie', JSON.stringify(r.json));
    ok((await call('GET', '/api/auth/check', { cookie: fresh })).status === 200, 'the fresh session works');
    ok((await call('GET', '/api/auth/check', { cookie: first })).status === 401, 'the session that changed it, old token -> 401');
    ok((await call('GET', '/api/admin/students', { cookie: other })).status === 401, 'another device -> 401');
    ok((await login(PASSWORD)).status === 401, 'old password no longer logs in');
    r = await login(NEW_PASSWORD);
    ok(r.status === 200, 'new password logs in');
    const admin = await Admin.findOne({ username: 'testadmin' }).lean();
    ok(admin.tokenVersion === versionBefore + 1 && !JSON.stringify(r.json).includes('passwordHash'), 'tokenVersion bumped; no hash in the response');

    console.log('# Changing it back (also restores the shared test credentials)');
    r = await call('POST', '/api/auth/password', { cookie: cookieOf(r, 'admin_token'), body: { currentPassword: NEW_PASSWORD, newPassword: PASSWORD } });
    ok(r.status === 200, 'changed back', JSON.stringify(r.json));
    const back = cookieOf(r, 'admin_token');

    console.log('# Wrong current passwords are rate limited per admin');
    let limited = 0;
    for (let i = 0; i < 8 && !limited; i++) {
      r = await call('POST', '/api/auth/password', { cookie: back, body: { currentPassword: `wrong-${i}`, newPassword: NEW_PASSWORD } });
      if (r.status === 429) limited = i + 1;
    }
    ok(limited > 0 && limited <= 6, 'too many attempts -> 429', `limited at ${limited}`);

    console.log('# Proxy secret: the forwarded visitor address is believed only with the secret');
    let secret = null;
    const run = (headers) => {
      const req = { headers: { 'x-forwarded-for': '203.0.113.9', ...headers } };
      let called = false;
      createTrustedProxy(secret)(req, {}, () => { called = true; });
      return { xff: req.headers['x-forwarded-for'], secretLeft: 'x-tpf-proxy-secret' in req.headers, called };
    };
    let out = run({ 'x-real-ip': '198.51.100.7', 'x-tpf-proxy-secret': 'anything' });
    ok(out.xff === '203.0.113.9' && !out.secretLeft && out.called, 'no PROXY_SECRET set: unchanged, header dropped');
    secret = 's3cret-value-for-tests';
    out = run({ 'x-real-ip': '198.51.100.7' });
    ok(out.xff === '203.0.113.9', 'secret missing: unchanged');
    out = run({ 'x-real-ip': '198.51.100.7', 'x-tpf-proxy-secret': 's3cret-value-for-test' });
    ok(out.xff === '203.0.113.9' && !out.secretLeft, 'wrong secret: unchanged, header dropped');
    out = run({ 'x-real-ip': '198.51.100.7', 'x-tpf-proxy-secret': 's3cret-value-for-tests' });
    ok(out.xff === '198.51.100.7' && !out.secretLeft, 'right secret: the visitor address is used');
    out = run({ 'x-real-ip': 'not-an-ip, 1.2.3.4', 'x-tpf-proxy-secret': 's3cret-value-for-tests' });
    ok(out.xff === '203.0.113.9', 'right secret but a malformed address: unchanged');
  } finally {
    // Whatever happened above, leave the shared admin with its usual password
    const hash = await bcrypt.hash(PASSWORD, 12);
    await Admin.updateOne({ username: 'testadmin' }, { $set: { passwordHash: hash } });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
