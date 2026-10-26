// Phase 1 verification — runs against a local throwaway server/DB only.
import { createRequire } from 'node:module';
const TEST = createRequire(import.meta.url)('../lib/env.cjs');

const BASE = TEST.API.replace('localhost', '127.0.0.1');
const ORIGIN = TEST.APP;
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('  PASS', label); }
  else { fail++; console.log('  FAIL', label, extra); }
};

const req = async (method, path, { body, cookie, origin = ORIGIN, headers = {} } = {}) => {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (origin) h.Origin = origin;
  if (cookie) h.Cookie = cookie;
  const res = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  const setCookie = res.headers.getSetCookie?.() || [];
  return { status: res.status, json, text, setCookie };
};
const cookieFrom = (r, name) => {
  const c = r.setCookie.find((s) => s.startsWith(name + '='));
  return c ? c.split(';')[0] : null;
};

console.log('# Staff sign-in and server-side sessions');
let r = await req('POST', '/api/auth/login', { body: { identifier: 'testadmin', password: 'testadminpass' } });
const adminCookie = cookieFrom(r, 'tpf_session');
ok(r.status === 200 && adminCookie && r.json.account.type === 'staff', 'staff login sets the session cookie');
ok(r.setCookie.length === 1, 'exactly one cookie set', r.setCookie.join(' | '));
ok(/HttpOnly/i.test(r.setCookie[0]) && /SameSite=Lax/i.test(r.setCookie[0]) && /Path=\//.test(r.setCookie[0]), 'cookie HttpOnly, SameSite=Lax, Path=/');
ok(/^tpf_session=[A-Za-z0-9_-]{43};/.test(r.setCookie[0]), 'the cookie is an opaque 256-bit token (no readable claims)', r.setCookie[0].slice(0, 30));
r = await req('GET', '/api/auth/session', { cookie: adminCookie });
ok(r.status === 200 && r.json.authenticated && r.json.account.role === 'super_admin', 'session probe names the account and role');

r = await req('GET', '/api/auth/session');
ok(r.status === 200 && r.json.success === true && r.json.authenticated === false && !r.json.expired, 'no cookie: 200, logged out');
r = await req('GET', '/api/auth/session', { cookie: 'tpf_session=garbage' });
ok(r.status === 200 && r.json.authenticated === false && r.json.expired === true, 'unknown token: logged out, flagged expired');
ok(r.setCookie.some((s) => s.startsWith('tpf_session=;')), 'unknown token: cookie cleared');
r = await req('GET', '/api/auth/session', { cookie: `tpf_session=${'A'.repeat(43)}` });
ok(r.status === 200 && r.json.authenticated === false, 'well-formed but made-up token rejected');
r = await req('GET', '/api/admin/students', { cookie: 'tpf_session=garbage' });
ok(r.status === 401 && r.json.code === 'SESSION_EXPIRED', 'admin route with an unknown token -> 401 SESSION_EXPIRED');
r = await req('GET', '/api/auth/session', { cookie: 'admin_token=eyJhbGciOiJIUzI1NiJ9.e30.x' });
ok(r.status === 200 && r.json.authenticated === false, 'an old JWT cookie is not a session');

console.log('# Logout ends the session on the server');
r = await req('POST', '/api/auth/login', { body: { identifier: 'testadmin', password: 'testadminpass' } });
const throwaway = cookieFrom(r, 'tpf_session');
ok(throwaway && throwaway !== adminCookie, 'each login gets a new session');
r = await req('POST', '/api/auth/logout', { cookie: throwaway });
ok(r.status === 200, 'logout 200');
r = await req('GET', '/api/auth/session', { cookie: throwaway });
ok(r.json.authenticated === false, 'the logged-out cookie no longer works (even if copied)');
r = await req('GET', '/api/auth/session', { cookie: adminCookie });
ok(r.json.authenticated === true, 'another session of the same account is unaffected');

console.log('# CSRF');
r = await req('POST', '/api/auth/logout', { origin: `${TEST.APP}.evil.com` });
ok(r.status === 403, 'lookalike origin rejected');
r = await req('POST', '/api/auth/logout', { origin: `${TEST.APP}5` });
ok(r.status === 403, 'port-prefix origin rejected');
r = await req('POST', '/api/auth/logout', { origin: null });
ok(r.status === 403, 'missing origin rejected');
r = await req('POST', '/api/auth/logout', { origin: null, headers: { Referer: `${TEST.APP}/admin/dashboard` } });
ok(r.status === 200, 'valid referer accepted');
r = await req('POST', '/api/auth/logout');
ok(r.status === 200 && r.setCookie.some((s) => s.startsWith('tpf_session=;')), 'admin logout clears admin_token');

console.log('# Student signup');
const email = `Stu${Date.now()}@Example.com`;
r = await req('POST', '/api/auth/signup', { body: { email, rollNumber: '21ce001', password: 'goodpass123' } });
const stuCookie = cookieFrom(r, 'tpf_session');
ok(r.status === 201 && stuCookie, 'signup 201 + student_token', JSON.stringify(r.json));
ok(!r.text.includes('passwordHash') && !r.text.includes('$2'), 'signup response has no hash');
r = await req('POST', '/api/auth/signup', { body: { email, rollNumber: '21CE999', password: 'goodpass123' } });
ok(r.status === 409, 'duplicate email 409');
const dupEmailMsg = r.json.message;
r = await req('POST', '/api/auth/signup', { body: { email: 'other' + email, rollNumber: '21CE001', password: 'goodpass123' } });
ok(r.status === 409 && r.json.message === dupEmailMsg, 'duplicate roll number 409 (case-insensitive) same message');
r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'college123' } });
ok(r.status === 400, 'default password rejected at signup');
r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'short' } });
ok(r.status === 400, 'short password rejected');
r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'a'.repeat(73) } });
ok(r.status === 400, '73-char password rejected');
r = await req('POST', '/api/auth/signup', { body: { email: { $gt: '' }, rollNumber: '21CE002', password: 'goodpass123' } });
ok(r.status === 400, 'operator object as email rejected');
r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', rollNumber: '../$x', password: 'goodpass123' } });
ok(r.status === 400, 'bad roll number rejected');
r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE003', institute: 'MIT', password: 'goodpass123' } });
ok(r.status === 400, 'unknown institute rejected');
r = await req('POST', '/api/auth/signup', { body: { email: 'mass@y.com', rollNumber: '21CE004', password: 'goodpass123', tokenVersion: 99, mustChangePassword: true, cgpa: 10 } });
ok(r.status === 201, 'signup ignores extra fields (status)');
const massCookie = cookieFrom(r, 'tpf_session');
r = await req('GET', '/api/auth/session', { cookie: massCookie });
ok(r.status === 200 && r.json.account.mustChangePassword === false, 'mass-assigned mustChangePassword ignored');

console.log('# Student login');
r = await req('POST', '/api/auth/login', { body: { identifier: email.toUpperCase(), password: 'goodpass123' } });
ok(r.status === 200 && cookieFrom(r, 'tpf_session') && r.json.account.type === 'student' && r.json.account.mustChangePassword === false, 'login 200 (email case-insensitive)');
let t0 = Date.now();
r = await req('POST', '/api/auth/login', { body: { identifier: email, password: 'wrongpass1' } });
const tWrong = Date.now() - t0;
const wrongBody = r.text;
ok(r.status === 401, 'wrong password 401');
t0 = Date.now();
r = await req('POST', '/api/auth/login', { body: { identifier: 'nobody@nowhere.com', password: 'wrongpass1' } });
const tUnknown = Date.now() - t0;
ok(r.status === 401 && r.text === wrongBody, 'unknown email 401 identical body');
console.log(`    timing wrong=${tWrong}ms unknown=${tUnknown}ms`);
ok(Math.abs(tWrong - tUnknown) < Math.max(tWrong, tUnknown) * 0.5, 'timings comparable');

console.log('# Student session / cross-role');
r = await req('GET', '/api/auth/session', { cookie: stuCookie });
ok(r.status === 200 && r.json.account.type === 'student' && r.json.account.missingFields.length === 8 && r.json.account.missingFields.includes('instituteId'), 'student session with missingFields (incl. institute)');
ok(!r.text.includes('passwordHash') && !r.text.includes('tokenHash') && !('permissions' in r.json.account), 'session has no internals and no staff fields');
r = await req('POST', '/api/admin/drives', { cookie: stuCookie, body: { company: 'x' } });
ok(r.status === 403 && r.json.code === 'FORBIDDEN', 'a student session cannot create a drive (403)');
r = await req('GET', '/api/student/profile', { cookie: adminCookie });
ok(r.status === 403 && r.json.code === 'FORBIDDEN', 'a staff session cannot use student routes (403)');

console.log('# Revocation & restricted session (DB flips via mongosh helper)');
// export state for the DB step
console.log('STATE', JSON.stringify({ email, stuCookie }));

console.log('# Rate limit (per IP+email)');
const victim = 'ratelimit@example.com';
let last;
for (let i = 0; i < 6; i++) last = await req('POST', '/api/auth/login', { body: { identifier: victim, password: 'wrongpass1' } });
ok(last.status === 429, '6th failed login for same email -> 429');
r = await req('POST', '/api/auth/login', { body: { identifier: email, password: 'goodpass123' } });
ok(r.status === 200, 'other account from same IP still allowed');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
