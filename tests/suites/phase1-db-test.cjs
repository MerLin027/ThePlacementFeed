// Sessions, revocation and restricted (reset) sessions, against the local test DB only: the session
// guards run directly against cookies from the real API, and the database is flipped between checks.
const TEST = require('../lib/env.cjs');
const path = require('path');
const crypto = require('crypto');
const SERVER = TEST.SERVER;
// The guards read the server's config, which needs the same settings the API runs with
Object.assign(process.env, { MONGODB_URI: TEST.MONGODB_URI, CLIENT_URL: TEST.APP });
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const { authenticate, requireStudent, requireStudentAllowPending } = require(path.join(SERVER, 'src/features/auth/guards'));

const BASE = TEST.API.replace('localhost', '127.0.0.1');
const H = { 'Content-Type': 'application/json', Origin: TEST.APP };
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l); };

// Runs authenticate, then a guard, on a request carrying `cookie`
const runGuard = (guard, cookie) => new Promise((resolve) => {
  const [name, value] = cookie.split('=');
  const req = { cookies: { [name]: value } };
  const res = { status(code) { this.code = code; return this; }, json(body) { resolve({ status: this.code, body }); } };
  authenticate(req, res, (err) => {
    if (err) return resolve({ status: 'error', err });
    guard(req, res, (err2) => resolve(err2 ? { status: 'error', err: err2 } : { status: 'next', req }));
  });
});
const tokenOf = (cookie) => cookie.split('=')[1];
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const login = async (email, password) => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ identifier: email, password }) });
  const set = r.headers.getSetCookie().find((c) => c.startsWith('tpf_session='));
  return { status: r.status, json: await r.json(), cookie: set ? set.split(';')[0] : null };
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const email = 'revoke@example.com';
  const existing = await Student.findOne({ email }).select('_id').lean();
  if (existing) await Session.deleteMany({ accountId: existing._id });
  await Student.deleteOne({ email });
  const r0 = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: H, body: JSON.stringify({ email, rollNumber: 'REV0001', password: 'goodpass123' }) });
  const cookie = r0.headers.getSetCookie().find((c) => c.startsWith('tpf_session=')).split(';')[0];
  const student = await Student.findOne({ email }).lean();

  console.log('# Stored sessions');
  const stored = await Session.find({ accountId: student._id }).lean();
  ok(stored.length === 1 && stored[0].accountType === 'student', 'one session row for the new account');
  ok(stored[0].tokenHash === sha256(tokenOf(cookie)) && !JSON.stringify(stored[0]).includes(tokenOf(cookie)), 'only the SHA-256 of the token is stored');
  const ttl = (await Session.collection.indexes()).find((i) => i.key.expiresAt === 1);
  ok(ttl && ttl.expireAfterSeconds === 0, 'expired sessions are removed by a TTL index');
  ok(Math.abs(stored[0].expiresAt - Date.now() - 7 * 24 * 3600e3) < 60e3, 'student sessions last 7 days');

  console.log('# Guards');
  ok((await runGuard(requireStudent, cookie)).status === 'next', 'a normal session passes requireStudent');

  // Restricted session after an admin-style reset
  await Student.updateOne({ email }, { mustChangePassword: true, tempPasswordExpiresAt: new Date(Date.now() + 3600e3) });
  const m = await runGuard(requireStudent, cookie);
  ok(m.status === 403 && m.body.code === 'PASSWORD_CHANGE_REQUIRED', 'a restricted session is denied by default (403)');
  ok((await runGuard(requireStudentAllowPending, cookie)).status === 'next', 'a restricted session is allowed on opt-in routes');
  const probe = await (await fetch(BASE + '/api/auth/session', { headers: { Cookie: cookie } })).json();
  ok(probe.authenticated && probe.account.mustChangePassword === true, 'the session probe reports mustChangePassword');

  // Temporary password login: valid, then expired
  await Student.updateOne({ email }, { passwordHash: await bcrypt.hash('Temp-Pass-1234', 12) });
  let r = await login(email, 'Temp-Pass-1234');
  ok(r.status === 200 && r.json.account.mustChangePassword === true, 'a temporary password works within its window');
  await Student.updateOne({ email }, { tempPasswordExpiresAt: new Date(Date.now() - 1000) });
  r = await login(email, 'Temp-Pass-1234');
  ok(r.status === 401 && r.json.message === 'Invalid credentials', 'an expired temporary password -> the generic 401');

  console.log('# Revocation');
  await Student.updateOne({ email }, { mustChangePassword: false, $unset: { tempPasswordExpiresAt: '' } });
  ok((await runGuard(requireStudent, cookie)).status === 'next', 'still valid before revocation');
  await Session.deleteMany({ accountId: student._id });
  const revoked = await runGuard(requireStudent, cookie);
  ok(revoked.status === 401 && revoked.body.code === 'SESSION_EXPIRED', 'deleting the session row ends it at once');

  r = await login(email, 'Temp-Pass-1234');
  await Session.updateOne({ tokenHash: sha256(tokenOf(r.cookie)) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  ok((await runGuard(requireStudent, r.cookie)).status === 401, 'a session past its expiry is refused (even before the TTL sweep)');

  // Deleted account
  r = await login(email, 'Temp-Pass-1234');
  await Student.deleteOne({ email });
  ok((await runGuard(requireStudentAllowPending, r.cookie)).status === 401, 'a deleted account’s session is refused');
  await Session.deleteMany({ accountId: student._id });

  // Indexes
  const idx = await Student.collection.indexes();
  ok(idx.some((i) => i.key.email === 1 && i.unique), 'unique email index');
  ok(idx.some((i) => JSON.stringify(i.key) === '{"rollNumber":1}' && i.unique), 'unique rollNumber index');

  console.log(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})();
