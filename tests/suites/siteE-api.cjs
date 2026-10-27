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
const SECOND_PASSWORD = 'another-admin-pass-3';
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
const login = async (password) => call('POST', '/api/auth/login', { body: { identifier: 'testadmin', password } });
const fieldError = (r, field) => (r.json.errors || []).find((e) => e.field === field)?.message || '';

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  try {
    console.log('# The admin check names the account');
    let r = await login(PASSWORD);
    const first = cookieOf(r, 'tpf_session');
    ok(r.status === 200 && first, 'admin logs in');
    r = await call('GET', '/api/auth/session', { cookie: first });
    ok(r.status === 200 && r.json.authenticated === true && r.json.account.username === 'testadmin' && r.json.account.role === 'super_admin', 'session names the account and role', JSON.stringify(r.json));
    ok(r.headers.get('cache-control') === 'no-store', 'API responses are no-store', r.headers.get('cache-control'));

    console.log('# Guards and validation');
    r = await call('POST', '/api/auth/password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    ok(r.status === 401, 'no session -> 401', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, origin: 'https://evil.example', body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    ok(r.status === 403, 'foreign Origin -> 403 (CSRF)', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: 'short' } });
    ok(r.status === 400 && /12/.test(fieldError(r, 'newPassword')), 'shorter than 12 -> 400 on newPassword', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: 'password1234' } });
    ok(r.status === 400 && /common/.test(fieldError(r, 'newPassword')), 'a common password -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: 'my-testadmin-2026' } });
    ok(r.status === 400 && /username/.test(fieldError(r, 'newPassword')), 'a password containing the username -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: PASSWORD } });
    ok(r.status === 400 && /different/.test(fieldError(r, 'newPassword')), 'same as current -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { newPassword: NEW_PASSWORD } });
    ok(r.status === 400 && fieldError(r, 'currentPassword'), 'missing current -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: { $ne: null }, newPassword: NEW_PASSWORD } });
    ok(r.status === 400, 'operator object as current -> 400', r.status);
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: 'wrong-password', newPassword: NEW_PASSWORD } });
    ok(r.status === 400 && /incorrect/.test(fieldError(r, 'currentPassword')), 'wrong current -> 400 on currentPassword', JSON.stringify(r.json));
    ok(await bcrypt.compare(PASSWORD, (await Admin.findOne({ username: 'testadmin' }).select('+passwordHash')).passwordHash), 'failed attempts leave the password alone');

    console.log('# A change signs out every other session and keeps this one');
    const other = cookieOf(await login(PASSWORD), 'tpf_session');
    r = await call('POST', '/api/auth/password', { cookie: first, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    const fresh = cookieOf(r, 'tpf_session');
    ok(r.status === 200 && fresh && fresh !== first, 'change -> 200 with a fresh session cookie', JSON.stringify(r.json));
    ok((await call('GET', '/api/auth/session', { cookie: fresh })).status === 200, 'the fresh session works');
    ok((await call('GET', '/api/auth/session', { cookie: first })).json.authenticated === false, 'the session that changed it is replaced (old cookie no longer works)');
    ok((await call('GET', '/api/admin/students', { cookie: other })).status === 401, 'another device -> 401');
    ok((await login(PASSWORD)).status === 401, 'old password no longer logs in');
    r = await login(NEW_PASSWORD);
    ok(r.status === 200, 'new password logs in');
    ok(!JSON.stringify(r.json).includes('passwordHash') && !/\$2[ab]\$/.test(JSON.stringify(r.json)), 'no hash in the response');

    console.log('# Changing it again (the shared test password is restored at the end)');
    r = await call('POST', '/api/auth/password', { cookie: cookieOf(r, 'tpf_session'), body: { currentPassword: NEW_PASSWORD, newPassword: SECOND_PASSWORD } });
    ok(r.status === 200, 'changed again', JSON.stringify(r.json));
    const back = cookieOf(r, 'tpf_session');

    console.log('# Wrong current passwords are rate limited per admin');
    let limited = 0;
    for (let i = 0; i < 8 && !limited; i++) {
      r = await call('POST', '/api/auth/password', { cookie: back, body: { currentPassword: `wrong-${i}`, newPassword: NEW_PASSWORD } });
      if (r.status === 429) limited = i + 1;
    }
    ok(limited > 0 && limited <= 6, 'too many attempts -> 429', `limited at ${limited}`);
    ok(r.json.code === 'RATE_LIMITED', '429 carries code RATE_LIMITED', JSON.stringify(r.json));

    console.log('# Hardening: global CSRF, password policy, audit events');
    const suiteStart = new Date(Date.now() - 60 * 1000);
    r = await call('POST', '/api/auth/logout', { origin: null });
    ok(r.status === 403 && r.json.code === 'CSRF_REJECTED', 'a write without Origin -> 403 CSRF_REJECTED', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/logout', { origin: 'https://evil.example' });
    ok(r.status === 403, 'student logout from another site -> 403', r.status);
    const TAG = `se${Date.now() % 1000000}`;
    r = await call('POST', '/api/auth/signup', { body: { email: `${TAG}@example.com`, rollNumber: `${TAG}R1`.toUpperCase(), password: 'password123' } });
    ok(r.status === 400 && /common/.test(fieldError(r, 'password')), 'signup with a common password -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/signup', { body: { email: `${TAG}@example.com`, rollNumber: `${TAG}R1`.toUpperCase(), password: `x-${TAG}r1-pass` } });
    ok(r.status === 400 && /roll number/.test(fieldError(r, 'password')), 'signup with the roll number in the password -> 400', JSON.stringify(r.json));
    r = await call('POST', '/api/auth/login', { body: { identifier: 'testadmin', password: 'definitely-wrong' } });
    ok(r.status === 401 && r.json.code === 'INVALID_CREDENTIALS', 'wrong admin password -> 401 INVALID_CREDENTIALS');
    const events = await mongoose.connection.collection('audit_events').find({ at: { $gte: suiteStart } }).toArray();
    const loginFail = events.find((e) => e.action === 'auth.login' && e.outcome === 'failure' && e.actor.type === 'staff');
    ok(loginFail && loginFail.actor.type === 'staff' && loginFail.ip && loginFail.requestId, 'failed staff login stored (actor, address, request id)', JSON.stringify(loginFail));
    ok(events.some((e) => e.action === 'auth.login' && e.outcome === 'success'), 'successful staff login stored');
    ok(events.filter((e) => e.action === 'auth.password.change' && e.outcome === 'success').length >= 2, 'password changes stored');
    ok(!/definitely-wrong|a-new-admin-pass|testadmin"/.test(JSON.stringify(events)), 'no passwords or usernames in stored events');

    console.log('# Proxy secret: the visitor address is believed only with the secret');
    const fakeRes = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
    const run = (secret, headers, { required = false, path: reqPath = '/api/drives' } = {}) => {
      const req = { path: reqPath, headers: { 'x-forwarded-for': '203.0.113.9', ...headers } };
      const res = fakeRes();
      let called = false;
      createTrustedProxy(secret, { required })(req, res, () => { called = true; });
      return { xff: req.headers['x-forwarded-for'], secretLeft: 'x-tpf-proxy-secret' in req.headers, called, via: req.viaWebsite, res };
    };
    const SECRET = 's3cret-value-for-tests';
    let out = run(null, { 'x-vercel-forwarded-for': '198.51.100.7', 'x-tpf-proxy-secret': 'anything' });
    ok(out.xff === '203.0.113.9' && !out.secretLeft && out.called && out.via === false, 'no PROXY_SECRET set: unchanged, header dropped');
    out = run(SECRET, { 'x-vercel-forwarded-for': '198.51.100.7' });
    ok(out.xff === '203.0.113.9' && out.called && out.via === false, 'secret missing: unchanged');
    out = run(SECRET, { 'x-vercel-forwarded-for': '198.51.100.7', 'x-tpf-proxy-secret': 's3cret-value-for-test' });
    ok(out.xff === '203.0.113.9' && !out.secretLeft && out.via === false, 'wrong secret: unchanged, header dropped');
    out = run(SECRET, { 'x-vercel-forwarded-for': '198.51.100.7', 'x-tpf-proxy-secret': SECRET });
    ok(out.xff === '198.51.100.7' && !out.secretLeft && out.via === true, 'right secret: the visitor address (x-vercel-forwarded-for) is used');
    out = run(SECRET, { 'x-vercel-forwarded-for': '2001:db8::7', 'x-tpf-proxy-secret': SECRET });
    ok(out.xff === '2001:db8::7', 'an IPv6 visitor address works too');
    out = run(SECRET, { 'x-real-ip': '198.51.100.8', 'x-tpf-proxy-secret': SECRET });
    ok(out.xff === '203.0.113.9', 'x-real-ip is never used');
    out = run(SECRET, { 'x-vercel-forwarded-for': 'not-an-ip, 1.2.3.4', 'x-tpf-proxy-secret': SECRET });
    ok(out.xff === '203.0.113.9' && out.called, 'right secret but a malformed address: unchanged');

    console.log('# Required (production): nothing gets in around the website');
    out = run(SECRET, { 'x-vercel-forwarded-for': '198.51.100.7' }, { required: true });
    ok(!out.called && out.res.statusCode === 403 && out.res.body.code === 'DIRECT_ACCESS', 'no secret: 403 DIRECT_ACCESS, nothing else runs', JSON.stringify(out.res.body));
    out = run(SECRET, { 'x-tpf-proxy-secret': 'guess' }, { required: true });
    ok(!out.called && out.res.statusCode === 403, 'a wrong secret: 403');
    out = run(SECRET, { 'x-tpf-proxy-secret': SECRET }, { required: true });
    ok(out.called && out.via === true, 'the right secret: through');
    out = run(SECRET, {}, { required: true, path: '/api/health' });
    ok(out.called && out.via === false, 'the health check stays reachable directly (it reveals nothing)');
    out = run(SECRET, {}, { required: true, path: '/api/health/../drives' });
    ok(!out.called, 'only that exact path');
  } finally {
    // Whatever happened above, leave the shared admin with its usual password
    const hash = await bcrypt.hash(PASSWORD, 12);
    await Admin.updateOne({ username: 'testadmin' }, { $set: { passwordHash: hash } });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
