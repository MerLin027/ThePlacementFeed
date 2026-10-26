// Site upgrade, part F — roles and one sign-in for everyone:
// - access matrix: every method on real and made-up paths under /api/admin and /api/student, for no
//   session, a student, an admin and the super admin (the guards sit at the namespace mount);
// - the super admin manages staff accounts (one-time passwords, first-login change, disable, roles,
//   delete) under the rules the server enforces (never your own role, always one super admin);
// - joint sign-in (username or email for staff, email for students), one email per account;
// - staff idle timeout, sessions ended on disable/reset, audit events;
// - the old (pre-namespace) addresses answer 404.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));

const API = TEST.API;
const ORIGIN = TEST.APP;
const TAG = `sf${Date.now() % 1000000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const call = async (method, url, { body, cookie, origin = ORIGIN } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie() };
};
const cookieOf = (r) => (r.setCookie.find((c) => c.startsWith('tpf_session=') && !c.startsWith('tpf_session=;')) || '').split(';')[0];
const login = async (identifier, password) => {
  const r = await call('POST', '/api/auth/login', { body: { identifier, password } });
  return { ...r, cookie: cookieOf(r) };
};
const fieldError = (r, field) => (r.json.errors || []).find((e) => e.field === field)?.message || '';

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const created = [];
  try {
    const superCookie = (await login('testadmin', 'testadminpass')).cookie;
    ok(Boolean(superCookie), 'the original admin signs in');
    const superDoc = await Admin.findOne({ username: 'testadmin' }).lean();
    ok(superDoc.role === 'super_admin', 'the original admin was made the super admin at startup');

    const s = await call('POST', '/api/auth/signup', { body: { email: `${TAG}s@example.com`, rollNumber: `${TAG}S1`.toUpperCase(), password: 'goodpass123' } });
    const studentCookie = cookieOf(s);
    ok(s.status === 201 && studentCookie && s.json.account.type === 'student', 'a student signs up (account in the response)');

    console.log('# The super admin creates an admin');
    let r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Riya Admin', username: `${TAG}admin`, email: `${TAG}a@example.com`, role: 'admin' } });
    ok(r.status === 201 && r.json.data.role === 'admin' && r.json.data.mustChangePassword === true, 'created, pending its first password change', JSON.stringify(r.json));
    const adminTemp = r.json.temporaryPassword;
    ok(/^[A-HJ-NP-Za-km-np-z2-9]{4}(-[A-HJ-NP-Za-km-np-z2-9]{4}){2}$/.test(adminTemp || ''), 'a random one-time password, shown in this response only');
    const adminId = r.json.data.id;
    created.push(adminId);
    r = await call('GET', '/api/admin/staff', { cookie: superCookie });
    ok(!r.text.includes(adminTemp) && !/passwordHash|\$2[ab]\$/.test(r.text), 'the list never shows passwords or hashes');

    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Dup', username: `${TAG}admin`, role: 'admin' } });
    ok(r.status === 400 && /taken/.test(fieldError(r, 'username')), 'a taken username -> 400');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Clash', username: `${TAG}clash`, email: `${TAG}s@example.com`, role: 'admin' } });
    ok(r.status === 400 && /already used/.test(fieldError(r, 'email')), "a student's email can't become a staff email");
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Bad', username: 'has@sign', role: 'admin' } });
    ok(r.status === 400 && fieldError(r, 'username'), 'a username with @ -> 400');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Bad', username: `${TAG}bad`, role: 'owner' } });
    ok(r.status === 400 && fieldError(r, 'role'), 'an unknown role -> 400');
    r = await call('POST', '/api/auth/signup', { body: { email: `${TAG}a@example.com`, rollNumber: `${TAG}S2`.toUpperCase(), password: 'goodpass123' } });
    ok(r.status === 409, "a staff email can't sign up as a student");

    console.log('# First sign-in of the new admin');
    let a = await login(`${TAG}admin`, adminTemp);
    ok(a.status === 200 && a.json.account.type === 'staff' && a.json.account.mustChangePassword === true, 'signs in with the one-time password (by username)');
    r = await call('GET', '/api/admin/students', { cookie: a.cookie });
    ok(r.status === 403 && r.json.code === 'PASSWORD_CHANGE_REQUIRED', 'everything under /api/admin is blocked until the password is changed');
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: adminTemp } });
    ok(r.status === 400, "the one-time password can't be kept");
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: 'short-pass' } });
    ok(r.status === 400 && /12/.test(fieldError(r, 'newPassword')), 'staff passwords need 12+ characters');
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: 'riya-strong-pass-26' } });
    ok(r.status === 200 && r.json.account.mustChangePassword === false, 'sets a password without the one-time one');
    const adminCookie = cookieOf(r);
    ok((await call('GET', '/api/auth/session', { cookie: a.cookie })).json.authenticated === false, 'the first-login session was replaced');
    a = await login(`${TAG}a@example.com`, 'riya-strong-pass-26');
    ok(a.status === 200 && a.json.account.username === `${TAG}admin`, 'staff can also sign in with their email');

    console.log('# Access matrix');
    const ADMIN_PATHS = ['/admin/drives', '/admin/students', '/admin/insights', '/admin/catalog', '/admin/staff', '/admin/anything/made-up', `/admin/drives/${superDoc._id}/applicants`];
    const STUDENT_PATHS = ['/student/profile', '/student/applications', '/student/applications/summary', '/student/made-up'];
    const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const statusOf = async (method, p, cookie) => (await call(method, `/api${p}`, { cookie, ...(method !== 'GET' && { body: {} }) })).status;
    let bad = [];
    for (const p of [...ADMIN_PATHS, ...STUDENT_PATHS]) for (const m of METHODS) { const st = await statusOf(m, p); if (st !== 401) bad.push(`${m} ${p} ${st}`); }
    ok(bad.length === 0, 'no session: 401 on every method of every admin and student path (real or not)', bad.join(', '));
    bad = [];
    for (const p of ADMIN_PATHS) for (const m of METHODS) { const st = await statusOf(m, p, studentCookie); if (st !== 403) bad.push(`${m} ${p} ${st}`); }
    ok(bad.length === 0, 'a student: 403 everywhere under /api/admin', bad.join(', '));
    bad = [];
    for (const p of STUDENT_PATHS) for (const m of METHODS) { const st = await statusOf(m, p, adminCookie); if (st !== 403) bad.push(`${m} ${p} ${st}`); }
    ok(bad.length === 0, 'staff: 403 everywhere under /api/student', bad.join(', '));
    bad = [];
    for (const p of ['/admin/catalog', '/admin/catalog/branches', '/admin/staff', `/admin/staff/${adminId}`]) for (const m of METHODS) { const st = await statusOf(m, p, adminCookie); if (st !== 403) bad.push(`${m} ${p} ${st}`); }
    ok(bad.length === 0, 'an admin: 403 on Setup and Team, every method', bad.join(', '));
    for (const p of ['/admin/drives', '/admin/students', '/admin/insights']) {
      ok((await call('GET', `/api${p}`, { cookie: adminCookie })).status === 200, `an admin can use ${p}`);
    }
    for (const p of ['/admin/catalog', '/admin/staff']) {
      ok((await call('GET', `/api${p}`, { cookie: superCookie })).status === 200, `the super admin can use ${p}`);
    }
    r = await call('GET', '/api/admin/made-up', { cookie: superCookie });
    ok(r.status === 404 && r.json.code === 'NOT_FOUND', 'signed-in staff on a made-up path -> JSON 404');

    console.log('# One sign-in, the same answer for every failure');
    const unknown = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}nobody`, password: 'whatever-123' } });
    const wrongStaff = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}admin`, password: 'whatever-123' } });
    const wrongStudent = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}s@example.com`, password: 'whatever-123' } });
    ok([unknown, wrongStaff, wrongStudent].every((x) => x.status === 401 && x.text === unknown.text), 'unknown, wrong staff and wrong student passwords answer identically');

    console.log('# Rules the server enforces');
    r = await call('PATCH', `/api/admin/staff/${superDoc._id}`, { cookie: superCookie, body: { role: 'admin' } });
    ok(r.status === 409 && r.json.code === 'SELF_CHANGE', "the super admin can't demote themself");
    r = await call('PATCH', `/api/admin/staff/${superDoc._id}`, { cookie: superCookie, body: { active: false } });
    ok(r.status === 409 && r.json.code === 'SELF_CHANGE', "…or disable themself");
    r = await call('DELETE', `/api/admin/staff/${superDoc._id}`, { cookie: superCookie });
    ok(r.status === 409, "…or delete themself");
    r = await call('POST', `/api/admin/staff/${superDoc._id}/reset-password`, { cookie: superCookie });
    ok(r.status === 409, "…or reset their own password here (Change password is for that)");

    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { role: 'super_admin' } });
    ok(r.status === 200 && r.json.data.role === 'super_admin', 'promote the admin to super admin');
    ok((await call('GET', '/api/admin/staff', { cookie: adminCookie })).status === 200, 'the promotion applies to their current session at once');
    r = await call('PATCH', `/api/admin/staff/${superDoc._id}`, { cookie: adminCookie, body: { role: 'admin' } });
    ok(r.status === 200, 'with two super admins, one may demote the other');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { name: 'x' } });
    ok(r.status === 403, 'the demoted account lost Team access at once');
    r = await call('PATCH', `/api/admin/staff/${superDoc._id}`, { cookie: adminCookie, body: { role: 'super_admin' } });
    ok(r.status === 200, 'promote the original back');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { role: 'admin' } });
    ok(r.status === 200, 'and demote the new one again');
    await Admin.updateMany({ role: 'super_admin', _id: { $ne: superDoc._id } }, { $set: { role: 'admin' } });
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: adminCookie, body: { role: 'super_admin' } });
    ok(r.status === 403, "an admin can't change roles");

    console.log('# Disable, reset, delete');
    r = await call('DELETE', `/api/admin/staff/${adminId}`, { cookie: superCookie });
    ok(r.status === 409 && r.json.code === 'STILL_ACTIVE', 'an active account must be disabled before deletion');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: false } });
    ok(r.status === 200 && r.json.data.active === false, 'disable');
    ok((await call('GET', '/api/admin/drives', { cookie: adminCookie })).status === 401, 'disabling ends its sessions at once');
    r = await login(`${TAG}admin`, 'riya-strong-pass-26');
    ok(r.status === 401 && r.text === unknown.text, 'a disabled account gets the same answer as a wrong password');
    r = await call('POST', `/api/admin/staff/${adminId}/reset-password`, { cookie: superCookie });
    const resetTemp = r.json.temporaryPassword;
    ok(r.status === 200 && resetTemp && resetTemp !== adminTemp, 'reset gives a new one-time password');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: true } });
    r = await login(`${TAG}admin`, 'riya-strong-pass-26');
    ok(r.status === 401, 'after a reset the old password is gone');
    r = await login(`${TAG}admin`, resetTemp);
    ok(r.status === 200 && r.json.account.mustChangePassword === true, 'the reset password signs in, pending a change');
    await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: false } });
    r = await call('DELETE', `/api/admin/staff/${adminId}`, { cookie: superCookie });
    ok(r.status === 200 && !(await Admin.exists({ _id: adminId })), 'a disabled account can be deleted');
    ok((await Session.countDocuments({ accountId: adminId })) === 0, 'and has no sessions left');

    console.log('# Staff idle timeout');
    const idle = await login('testadmin', 'testadminpass');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(idle.cookie.split('=')[1]).digest('hex');
    await Session.updateOne({ tokenHash: hash }, { $set: { lastUsedAt: new Date(Date.now() - 61 * 60 * 1000) } });
    r = await call('GET', '/api/admin/drives', { cookie: idle.cookie });
    ok(r.status === 401 && r.json.code === 'SESSION_EXPIRED', 'a staff session unused for over an hour has ended');
    ok(!(await Session.exists({ tokenHash: hash })), 'and is removed');
    const stu = await Session.findOne({ accountType: 'student' }).sort({ createdAt: -1 }).lean();
    ok(Math.abs(stu.expiresAt - Date.now() - 7 * 24 * 3600e3) < 10 * 60e3, 'student sessions keep their 7 days');

    console.log('# Audit trail of staff changes');
    const events = await mongoose.connection.collection('audit_events').find({ 'target.id': new mongoose.Types.ObjectId(adminId) }).toArray();
    const actions = new Set(events.map((e) => e.action));
    ok(['staff.create', 'staff.update', 'staff.resetPassword', 'staff.delete'].every((x) => actions.has(x)), `staff changes stored (${[...actions].join(', ')})`);
    ok(events.every((e) => e.actor.type === 'staff' && e.actor.role) && !JSON.stringify(events).includes(adminTemp), 'each names the acting staff role; no passwords');

    console.log('# Old addresses are gone');
    r = await call('POST', '/api/students/auth/login', { body: { email: `${TAG}s@example.com`, password: 'goodpass123' } });
    ok(r.status === 404, 'old student login -> 404');
    r = await call('GET', '/api/placements?limit=2');
    ok(r.status === 404, 'old drive list -> 404');

    console.log('# Public drive data');
    r = await call('GET', '/api/drives?limit=5');
    ok(r.json.data.every((d) => !('recentChanges' in d) && !('statusManuallySet' in d) && !('__v' in d)), 'public drives leave out internal fields');
    const any = await Placement.findOne().lean();
    if (any) {
      r = await call('GET', `/api/drives/${any._id}`);
      ok(r.status === 200 && !('recentChanges' in r.json.data) && Array.isArray(r.json.data.customPrompts), 'one drive: same, with its questions');
    }
  } finally {
    await Admin.deleteMany({ username: new RegExp(`^${TAG}`) });
    await Admin.updateOne({ username: 'testadmin' }, { $set: { role: 'super_admin', active: true } });
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: [...studs.map((x) => x._id), ...created.map((id) => new mongoose.Types.ObjectId(id))] } });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
