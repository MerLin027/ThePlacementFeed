// Phase 1 verification — runs against a local throwaway server/DB only.
import { createRequire } from 'node:module';
const TEST = createRequire(import.meta.url)('../lib/env.cjs');
const require = createRequire(`${TEST.SERVER}/index.js`);
const jwt = require('jsonwebtoken');

const BASE = TEST.API.replace('localhost', '127.0.0.1');
const ORIGIN = TEST.APP;
const SECRET = 'test-secret-0123456789abcdef0123456789';
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

console.log('# Admin auth');
let r = await req('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
const adminCookie = cookieFrom(r, 'admin_token');
ok(r.status === 200 && adminCookie, 'admin login sets admin_token');
ok(!r.setCookie.some((s) => s.startsWith('token=')), 'no legacy token cookie set');
ok(r.setCookie[0]?.includes('HttpOnly'), 'admin cookie HttpOnly');
r = await req('GET', '/api/auth/check', { cookie: adminCookie });
ok(r.status === 200 && r.json.authenticated, 'admin check with admin_token');

const legacy = jwt.sign({ id: 'x', username: 'testadmin' }, SECRET, { expiresIn: '1h' });
// No admin_token at all (a legacy 'token' cookie is just an unknown cookie): logged out, not an error
r = await req('GET', '/api/auth/check', { cookie: `token=${legacy}` });
ok(r.status === 200 && r.json.authenticated === false, 'legacy token cookie not accepted (logged out)');
r = await req('GET', '/api/auth/check');
ok(r.status === 200 && r.json.success === true && r.json.authenticated === false, 'admin check without cookie: 200, logged out');
r = await req('GET', '/api/auth/check', { cookie: 'admin_token=garbage' });
ok(r.status === 401 && r.json.success === false, 'garbage admin_token still 401');
r = await req('GET', '/api/auth/check', { cookie: `admin_token=${legacy}` });
ok(r.status === 401, 'role-less token in admin_token rejected');
const noneAlg = jwt.sign({ sub: 'x', role: 'admin' }, '', { algorithm: 'none' });
r = await req('GET', '/api/auth/check', { cookie: `admin_token=${noneAlg}` });
ok(r.status === 401, 'alg=none token rejected');

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
ok(r.status === 200 && r.setCookie.some((s) => s.startsWith('admin_token=;')), 'admin logout clears admin_token');

console.log('# Student signup');
const email = `Stu${Date.now()}@Example.com`;
r = await req('POST', '/api/students/auth/signup', { body: { email, rollNumber: '21ce001', password: 'goodpass123' } });
const stuCookie = cookieFrom(r, 'student_token');
ok(r.status === 201 && stuCookie, 'signup 201 + student_token', JSON.stringify(r.json));
ok(!r.text.includes('passwordHash') && !r.text.includes('$2'), 'signup response has no hash');
r = await req('POST', '/api/students/auth/signup', { body: { email, rollNumber: '21CE999', password: 'goodpass123' } });
ok(r.status === 409, 'duplicate email 409');
const dupEmailMsg = r.json.message;
r = await req('POST', '/api/students/auth/signup', { body: { email: 'other' + email, rollNumber: '21CE001', password: 'goodpass123' } });
ok(r.status === 409 && r.json.message === dupEmailMsg, 'duplicate roll number 409 (case-insensitive) same message');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'college123' } });
ok(r.status === 400, 'default password rejected at signup');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'short' } });
ok(r.status === 400, 'short password rejected');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE002', password: 'a'.repeat(73) } });
ok(r.status === 400, '73-char password rejected');
r = await req('POST', '/api/students/auth/signup', { body: { email: { $gt: '' }, rollNumber: '21CE002', password: 'goodpass123' } });
ok(r.status === 400, 'operator object as email rejected');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'x@y.com', rollNumber: '../$x', password: 'goodpass123' } });
ok(r.status === 400, 'bad roll number rejected');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'x@y.com', rollNumber: '21CE003', institute: 'MIT', password: 'goodpass123' } });
ok(r.status === 400, 'unknown institute rejected');
r = await req('POST', '/api/students/auth/signup', { body: { email: 'mass@y.com', rollNumber: '21CE004', password: 'goodpass123', tokenVersion: 99, mustChangePassword: true, cgpa: 10 } });
ok(r.status === 201, 'signup ignores extra fields (status)');
const massCookie = cookieFrom(r, 'student_token');
r = await req('GET', '/api/students/auth/check', { cookie: massCookie });
ok(r.status === 200 && r.json.student.mustChangePassword === false, 'mass-assigned mustChangePassword ignored');

console.log('# Student login');
r = await req('POST', '/api/students/auth/login', { body: { email: email.toUpperCase(), password: 'goodpass123' } });
ok(r.status === 200 && cookieFrom(r, 'student_token') && r.json.mustChangePassword === false, 'login 200 (email case-insensitive)');
let t0 = Date.now();
r = await req('POST', '/api/students/auth/login', { body: { email, password: 'wrongpass1' } });
const tWrong = Date.now() - t0;
const wrongBody = r.text;
ok(r.status === 401, 'wrong password 401');
t0 = Date.now();
r = await req('POST', '/api/students/auth/login', { body: { email: 'nobody@nowhere.com', password: 'wrongpass1' } });
const tUnknown = Date.now() - t0;
ok(r.status === 401 && r.text === wrongBody, 'unknown email 401 identical body');
console.log(`    timing wrong=${tWrong}ms unknown=${tUnknown}ms`);
ok(Math.abs(tWrong - tUnknown) < Math.max(tWrong, tUnknown) * 0.5, 'timings comparable');

console.log('# Student check / cross-role');
r = await req('GET', '/api/students/auth/check', { cookie: stuCookie });
ok(r.status === 200 && r.json.student.missingFields.length === 7, 'student check 200 with missingFields');
ok(!r.text.includes('tokenVersion') && !r.text.includes('passwordHash'), 'check has no internals');
r = await req('GET', '/api/auth/check', { cookie: stuCookie.replace('student_token', 'admin_token') });
ok(r.status === 401, 'student JWT in admin_token rejected');
r = await req('POST', '/api/placements', { cookie: stuCookie.replace('student_token', 'admin_token'), body: { company: 'x' } });
ok(r.status === 401, 'student JWT cannot create placement');
r = await req('GET', '/api/students/auth/check', { cookie: adminCookie.replace('admin_token', 'student_token') });
ok(r.status === 401, 'admin JWT in student_token rejected');
r = await req('GET', '/api/students/auth/check');
ok(r.status === 200 && r.json.success === true && r.json.authenticated === false && !('student' in r.json), 'student check without cookie: 200, logged out');
r = await req('GET', '/api/students/auth/check', { cookie: 'student_token=garbage' });
ok(r.status === 401 && r.json.success === false, 'garbage student_token still 401');

console.log('# Revocation & restricted session (DB flips via mongosh helper)');
// export state for the DB step
console.log('STATE', JSON.stringify({ email, stuCookie }));

console.log('# Rate limit (per IP+email)');
const victim = 'ratelimit@example.com';
let last;
for (let i = 0; i < 6; i++) last = await req('POST', '/api/students/auth/login', { body: { email: victim, password: 'wrongpass1' } });
ok(last.status === 429, '6th failed login for same email -> 429');
r = await req('POST', '/api/students/auth/login', { body: { email, password: 'goodpass123' } });
ok(r.status === 200, 'other account from same IP still allowed');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
