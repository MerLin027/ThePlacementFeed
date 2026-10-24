// Revocation + restricted-session checks against the local test DB only.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Student = require(path.join(SERVER, 'models/Student'));
const { requireStudent, requireStudentAllowPending } = require(path.join(SERVER, 'middleware/requireStudent'));

const BASE = TEST.API.replace('localhost', '127.0.0.1');
const H = { 'Content-Type': 'application/json', Origin: TEST.APP };
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l); };

const runMw = (mw, cookie) => new Promise((resolve) => {
  const [name, value] = cookie.split('=');
  const req = { cookies: { [name]: value } };
  const res = { status(code) { this.code = code; return this; }, json(body) { resolve({ status: this.code, body }); } };
  mw(req, res, (err) => resolve(err ? { status: 'error', err } : { status: 'next', req }));
});

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const email = 'revoke@example.com';
  await Student.deleteOne({ email });
  let r = await fetch(BASE + '/api/students/auth/signup', { method: 'POST', headers: H, body: JSON.stringify({ email, rollNumber: 'REV0001', password: 'goodpass123' }) });
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];

  ok((await runMw(requireStudent, cookie)).status === 'next', 'normal session passes requireStudent');

  // Restricted session after an admin-style reset
  await Student.updateOne({ email }, { mustChangePassword: true, tempPasswordExpiresAt: new Date(Date.now() + 3600e3) });
  let m = await runMw(requireStudent, cookie);
  ok(m.status === 403 && m.body.code === 'PASSWORD_CHANGE_REQUIRED', 'restricted session denied by default (403)');
  ok((await runMw(requireStudentAllowPending, cookie)).status === 'next', 'restricted session allowed on opt-in routes');
  r = await fetch(BASE + '/api/students/auth/check', { headers: { Cookie: cookie } });
  const j = await r.json();
  ok(r.status === 200 && j.student.mustChangePassword === true, '/check reports mustChangePassword');

  // Temp password login: valid, then expired
  await Student.updateOne({ email }, { passwordHash: await bcrypt.hash('college123', 12) });
  r = await fetch(BASE + '/api/students/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email, password: 'college123' }) });
  const lj = await r.json();
  ok(r.status === 200 && lj.mustChangePassword === true, 'temp password login works within window');
  await Student.updateOne({ email }, { tempPasswordExpiresAt: new Date(Date.now() - 1000) });
  r = await fetch(BASE + '/api/students/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email, password: 'college123' }) });
  ok(r.status === 401 && (await r.json()).message === 'Invalid credentials', 'expired temp password -> generic 401');

  // tokenVersion bump revokes
  await Student.updateOne({ email }, { mustChangePassword: false, $inc: { tokenVersion: 1 } });
  ok((await runMw(requireStudent, cookie)).status === 401, 'tokenVersion bump revokes old token');

  // Deleted account
  await Student.deleteOne({ email });
  ok((await runMw(requireStudentAllowPending, cookie)).status === 401, 'deleted account token rejected');

  // Indexes
  const idx = await Student.collection.indexes();
  ok(idx.some((i) => i.key.email === 1 && i.unique), 'unique email index');
  ok(idx.some((i) => JSON.stringify(i.key) === '{"rollNumber":1}' && i.unique), 'unique rollNumber index');

  // 409 from global handler
  console.log(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})();
