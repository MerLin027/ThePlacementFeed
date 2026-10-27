// Site upgrade, part F — roles and one sign-in for everyone:
// - access matrix: every method on real and made-up paths under /api/admin and /api/student, for no
//   session, a student, an admin and the super admin (the guards sit at the namespace mount);
// - the super admin adds admins (name + email, one-time password, first-login change), edits,
//   disables, resets and deletes them; there is exactly one super admin, which the Team API can't
//   touch and nobody can be promoted to;
// - the super admin's profile (name, username, email; the password guards sign-in changes);
// - startup migration: admins lose their usernames once they have an email; one super admin index;
// - joint sign-in (email for students and admins, username or email for the super admin), one email
//   per account;
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
const seedAdmin = require(path.join(SERVER, 'src/features/auth/seed'));

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
    ok((await Admin.countDocuments({ role: 'super_admin' })) === 1, 'there is exactly one super admin');

    const s = await call('POST', '/api/auth/signup', { body: { email: `${TAG}s@example.com`, rollNumber: `${TAG}S1`.toUpperCase(), password: 'goodpass123' } });
    const studentCookie = cookieOf(s);
    ok(s.status === 201 && studentCookie && s.json.account.type === 'student', 'a student signs up (account in the response)');

    console.log('# The super admin creates an admin (name + email)');
    let r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Riya Admin', email: `${TAG}a@example.com` } });
    ok(r.status === 201 && r.json.data.role === 'admin' && r.json.data.mustChangePassword === true, 'created, pending its first password change', JSON.stringify(r.json));
    ok(r.json.data.username === null && r.json.data.email === `${TAG}a@example.com`, 'an admin has no username; the email is its sign-in');
    const adminTemp = r.json.temporaryPassword;
    ok(/^[A-HJ-NP-Za-km-np-z2-9]{4}(-[A-HJ-NP-Za-km-np-z2-9]{4}){2}$/.test(adminTemp || ''), 'a random one-time password, shown in this response only');
    const adminId = r.json.data.id;
    created.push(adminId);
    r = await call('GET', '/api/admin/staff', { cookie: superCookie });
    ok(!r.text.includes(adminTemp) && !/passwordHash|\$2[ab]\$/.test(r.text), 'the list never shows passwords or hashes');
    ok(r.json.data[0].role === 'super_admin' && r.json.data[0].isYou === true, 'the super admin is listed first');

    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Second', email: `${TAG}b2@example.com` } });
    ok(r.status === 201, 'a second admin without a username is fine (partial unique index)');
    created.push(r.json.data.id);
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Dup', email: `${TAG}A@example.com` } });
    ok(r.status === 400 && /already used/.test(fieldError(r, 'email')), 'a taken email (any case) -> 400');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Clash', email: `${TAG}s@example.com` } });
    ok(r.status === 400 && /already used/.test(fieldError(r, 'email')), "a student's email can't become a staff email");
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'No Email' } });
    ok(r.status === 400 && fieldError(r, 'email'), 'the email is required');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Bad', email: 'not-an-email' } });
    ok(r.status === 400 && fieldError(r, 'email'), 'an invalid email -> 400');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Sneaky', email: `${TAG}x@example.com`, role: 'super_admin' } });
    ok(r.status === 400 && !(await Admin.exists({ email: `${TAG}x@example.com` })), 'a role in the request is refused, not ignored');
    r = await call('POST', '/api/admin/staff', { cookie: superCookie, body: { name: 'Sneaky', email: `${TAG}x@example.com`, username: `${TAG}x` } });
    ok(r.status === 400, 'so is a username');
    ok((await Admin.countDocuments({ role: 'super_admin' })) === 1, 'still exactly one super admin');
    r = await call('POST', '/api/auth/signup', { body: { email: `${TAG}a@example.com`, rollNumber: `${TAG}S2`.toUpperCase(), password: 'goodpass123' } });
    ok(r.status === 409, "a staff email can't sign up as a student");

    console.log('# First sign-in of the new admin');
    let a = await login(`${TAG}a@example.com`, adminTemp);
    ok(a.status === 200 && a.json.account.type === 'staff' && a.json.account.mustChangePassword === true, 'signs in with the one-time password (by email)');
    ok(a.json.account.username === '' && a.json.account.role === 'admin', 'the session names an admin without a username');
    r = await call('GET', '/api/admin/students', { cookie: a.cookie });
    ok(r.status === 403 && r.json.code === 'PASSWORD_CHANGE_REQUIRED', 'everything under /api/admin is blocked until the password is changed');
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: adminTemp } });
    ok(r.status === 400, "the one-time password can't be kept");
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: 'short-pass' } });
    ok(r.status === 400 && /12/.test(fieldError(r, 'newPassword')), 'staff passwords need 12+ characters');
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: `${TAG}a-is-my-password` } });
    ok(r.status === 400 && fieldError(r, 'newPassword') === "Your password can't contain your email name.", 'not built from the email name (the message names only what an admin has)', fieldError(r, 'newPassword'));
    r = await call('POST', '/api/auth/password', { cookie: a.cookie, body: { newPassword: 'riya-strong-pass-26' } });
    ok(r.status === 200 && r.json.account.mustChangePassword === false, 'sets a password without the one-time one');
    let adminCookie = cookieOf(r);
    ok((await call('GET', '/api/auth/session', { cookie: a.cookie })).json.authenticated === false, 'the first-login session was replaced');

    console.log('# Access matrix');
    const ADMIN_PATHS = ['/admin/drives', '/admin/students', '/admin/insights', '/admin/catalog', '/admin/staff', '/admin/profile', '/admin/anything/made-up', `/admin/drives/${superDoc._id}/applicants`];
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
    for (const p of ['/admin/catalog', '/admin/catalog/branches', '/admin/staff', `/admin/staff/${adminId}`, '/admin/profile']) for (const m of METHODS) { const st = await statusOf(m, p, adminCookie); if (st !== 403) bad.push(`${m} ${p} ${st}`); }
    ok(bad.length === 0, 'an admin: 403 on Setup, Team and the super admin profile, every method', bad.join(', '));
    for (const p of ['/admin/drives', '/admin/students', '/admin/insights']) {
      ok((await call('GET', `/api${p}`, { cookie: adminCookie })).status === 200, `an admin can use ${p}`);
    }
    for (const p of ['/admin/catalog', '/admin/staff', '/admin/profile']) {
      ok((await call('GET', `/api${p}`, { cookie: superCookie })).status === 200, `the super admin can use ${p}`);
    }
    r = await call('GET', '/api/admin/made-up', { cookie: superCookie });
    ok(r.status === 404 && r.json.code === 'NOT_FOUND', 'signed-in staff on a made-up path -> JSON 404');

    console.log('# One sign-in, the same answer for every failure');
    const unknown = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}nobody`, password: 'whatever-123' } });
    const wrongStaff = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}a@example.com`, password: 'whatever-123' } });
    const wrongStudent = await call('POST', '/api/auth/login', { body: { identifier: `${TAG}s@example.com`, password: 'whatever-123' } });
    ok([unknown, wrongStaff, wrongStudent].every((x) => x.status === 401 && x.text === unknown.text), 'unknown, wrong staff and wrong student passwords answer identically');

    console.log('# Rules the server enforces');
    for (const [method, url, body] of [
      ['PATCH', `/api/admin/staff/${superDoc._id}`, { name: 'Renamed' }],
      ['PATCH', `/api/admin/staff/${superDoc._id}`, { active: false }],
      ['DELETE', `/api/admin/staff/${superDoc._id}`],
      ['POST', `/api/admin/staff/${superDoc._id}/reset-password`],
    ]) {
      r = await call(method, url, { cookie: superCookie, body });
      ok(r.status === 403 && r.json.code === 'SUPER_ADMIN', `the Team API can't touch the super admin: ${method} ${url.split('/').slice(4).join('/') || 'id'}`);
    }
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { role: 'super_admin' } });
    ok(r.status === 400 && (await Admin.findById(adminId).lean()).role === 'admin', 'nobody can be promoted to super admin');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { username: `${TAG}u` } });
    ok(r.status === 400, "an admin can't be given a username");
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { email: '' } });
    ok(r.status === 400 && fieldError(r, 'email'), "an admin's email can't be removed");
    let second;
    try {
      second = await Admin.create({ username: `${TAG}boss2`, role: 'super_admin', passwordHash: 'x' });
    } catch (error) {
      second = error;
    }
    ok(second?.code === 11000, 'the database itself refuses a second super admin', String(second?.message || second));
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: adminCookie, body: { name: 'Self Rename' } });
    ok(r.status === 403, "an admin can't use the Team API");

    console.log('# Edit an admin');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { name: 'Riya Shah' } });
    ok(r.status === 200 && r.json.data.name === 'Riya Shah', 'rename');
    ok((await call('GET', '/api/admin/drives', { cookie: adminCookie })).status === 200, 'a rename keeps their sessions');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { email: `${TAG}s@example.com` } });
    ok(r.status === 400 && /already used/.test(fieldError(r, 'email')), "can't take a student's email");
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { email: `${TAG}b@example.com` } });
    ok(r.status === 200 && r.json.data.email === `${TAG}b@example.com`, 'change the email');
    ok((await call('GET', '/api/admin/drives', { cookie: adminCookie })).status === 401, 'a new email (their sign-in) ends their sessions');
    ok((await login(`${TAG}a@example.com`, 'riya-strong-pass-26')).status === 401, 'the old email no longer signs in');
    a = await login(`${TAG}b@example.com`, 'riya-strong-pass-26');
    ok(a.status === 200, 'the new one does');
    adminCookie = a.cookie;

    console.log('# Disable, reset, delete');
    r = await call('DELETE', `/api/admin/staff/${adminId}`, { cookie: superCookie });
    ok(r.status === 409 && r.json.code === 'STILL_ACTIVE', 'an active account must be disabled before deletion');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: false } });
    ok(r.status === 200 && r.json.data.active === false, 'disable');
    ok((await call('GET', '/api/admin/drives', { cookie: adminCookie })).status === 401, 'disabling ends its sessions at once');
    r = await login(`${TAG}b@example.com`, 'riya-strong-pass-26');
    ok(r.status === 401 && r.text === unknown.text, 'a disabled account gets the same answer as a wrong password');
    r = await call('POST', `/api/admin/staff/${adminId}/reset-password`, { cookie: superCookie });
    const resetTemp = r.json.temporaryPassword;
    ok(r.status === 200 && resetTemp && resetTemp !== adminTemp, 'reset gives a new one-time password');
    r = await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: true } });
    r = await login(`${TAG}b@example.com`, 'riya-strong-pass-26');
    ok(r.status === 401, 'after a reset the old password is gone');
    r = await login(`${TAG}b@example.com`, resetTemp);
    ok(r.status === 200 && r.json.account.mustChangePassword === true, 'the reset password signs in, pending a change');
    await call('PATCH', `/api/admin/staff/${adminId}`, { cookie: superCookie, body: { active: false } });
    r = await call('DELETE', `/api/admin/staff/${adminId}`, { cookie: superCookie });
    ok(r.status === 200 && !(await Admin.exists({ _id: adminId })), 'a disabled account can be deleted');
    ok((await Session.countDocuments({ accountId: adminId })) === 0, 'and has no sessions left');

    console.log('# The super admin profile');
    const before = await Admin.findById(superDoc._id).lean();
    r = await call('GET', '/api/admin/profile', { cookie: superCookie });
    ok(r.status === 200 && r.json.data.username === 'testadmin' && r.json.data.role === 'super_admin' && 'university' in r.json, 'read the profile, with the College/University', JSON.stringify(r.json));
    ok(!/passwordHash|\$2[ab]\$/.test(r.text), 'no password hash in it');
    r = await call('PATCH', '/api/admin/profile', { cookie: superCookie, body: { name: 'Head of Placements' } });
    ok(r.status === 200 && r.json.data.name === 'Head of Placements' && r.json.account.name === 'Head of Placements', 'a new name needs no password');
    ok((await call('GET', '/api/admin/staff', { cookie: superCookie })).status === 200, 'and keeps the session');
    r = await call('PATCH', '/api/admin/profile', { cookie: superCookie, body: { email: `${TAG}boss@example.com` } });
    ok(r.status === 400 && /current password/.test(fieldError(r, 'currentPassword')), 'a new email needs the current password');
    r = await call('PATCH', '/api/admin/profile', { cookie: superCookie, body: { email: `${TAG}boss@example.com`, currentPassword: 'not-my-password' } });
    ok(r.status === 400 && /incorrect/.test(fieldError(r, 'currentPassword')), 'a wrong password is refused');
    r = await call('PATCH', '/api/admin/profile', { cookie: superCookie, body: { email: `${TAG}s@example.com`, currentPassword: 'testadminpass' } });
    ok(r.status === 400 && /already used/.test(fieldError(r, 'email')), "can't take a student's email");
    const other = await login('testadmin', 'testadminpass');
    r = await call('PATCH', '/api/admin/profile', { cookie: superCookie, body: { email: `${TAG}boss@example.com`, currentPassword: 'testadminpass' } });
    const newSuperCookie = cookieOf(r);
    ok(r.status === 200 && r.json.data.email === `${TAG}boss@example.com` && newSuperCookie, 'with the password, the email changes and this browser gets a fresh session');
    ok((await call('GET', '/api/admin/staff', { cookie: other.cookie })).status === 401, 'other devices are signed out');
    ok((await call('GET', '/api/admin/staff', { cookie: newSuperCookie })).status === 200, 'this one stays signed in');
    ok((await login(`${TAG}boss@example.com`, 'testadminpass')).status === 200, 'the super admin can sign in with the new email');
    r = await call('PATCH', '/api/admin/profile', { cookie: newSuperCookie, body: { username: 'has@sign', currentPassword: 'testadminpass' } });
    ok(r.status === 400 && fieldError(r, 'username'), 'a username with @ -> 400');
    r = await call('PATCH', '/api/admin/profile', { cookie: newSuperCookie, body: { username: '' } });
    ok(r.status === 400 && fieldError(r, 'username'), 'the username is required');
    r = await call('PATCH', '/api/admin/profile', { cookie: newSuperCookie, body: { role: 'admin' } });
    ok(r.status === 400 && (await Admin.findById(superDoc._id).lean()).role === 'super_admin', 'no role changes through the profile');
    r = await call('PATCH', '/api/admin/profile', { cookie: newSuperCookie, body: { email: '', name: '', currentPassword: 'testadminpass' } });
    ok(r.status === 200 && r.json.data.email === '' && r.json.data.name === '', 'name and email can be cleared (only the username is required)');
    const profileEvents = await mongoose.connection.collection('audit_events').find({ action: 'staff.profile.update', 'target.id': superDoc._id }).toArray();
    ok(profileEvents.some((e) => e.outcome === 'failure') && profileEvents.some((e) => e.details?.emailChanged), 'profile changes and failed attempts are audited');
    ok(!JSON.stringify(profileEvents).includes(`${TAG}boss`) && !JSON.stringify(profileEvents).includes('Head of'), 'without the values');
    await Admin.updateOne({ _id: superDoc._id }, before.name ? { $set: { name: before.name } } : { $unset: { name: '' } });
    const superCookieAfter = (await login('testadmin', 'testadminpass')).cookie;

    console.log('# Startup migration');
    const legacy = mongoose.connection.collection('admins');
    await legacy.insertMany([
      { username: `${TAG}old1`, email: `${TAG}old1@example.com`, role: 'admin', active: true, passwordHash: 'x', createdAt: new Date() },
      { username: `${TAG}old2`, role: 'admin', active: true, passwordHash: 'x', createdAt: new Date() },
    ]);
    await seedAdmin();
    const old1 = await Admin.findOne({ email: `${TAG}old1@example.com` }).lean();
    const old2 = await Admin.findOne({ username: `${TAG}old2` }).lean();
    ok(old1 && old1.username === undefined, 'an admin with an email loses its old username');
    ok(old2 && old2.username === `${TAG}old2`, 'an admin without an email keeps it, so it can still sign in');
    r = await call('GET', '/api/admin/staff', { cookie: superCookieAfter });
    ok(r.json.data.find((x) => x.id === old2._id.toString())?.needsEmail === true, 'the Team page is told it needs an email');
    r = await call('PATCH', `/api/admin/staff/${old2._id}`, { cookie: superCookieAfter, body: { email: `${TAG}old2@example.com` } });
    ok(r.status === 200 && r.json.data.username === null && r.json.data.needsEmail === false, 'adding the email removes the username');
    const indexes = await Admin.collection.indexes();
    ok(indexes.some((i) => i.name === 'one_super_admin' && i.unique) && indexes.some((i) => i.name === 'username_1' && i.partialFilterExpression), 'the one-super-admin and partial username indexes exist');
    ok((await Admin.countDocuments({ role: 'super_admin' })) === 1, 'a restart keeps exactly one super admin');

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
    await Admin.deleteMany({ $or: [{ username: new RegExp(`^${TAG}`) }, { email: new RegExp(`^${TAG}`) }] });
    await Admin.updateOne({ username: 'testadmin' }, { $set: { role: 'super_admin', active: true }, $unset: { email: '' } });
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: [...studs.map((x) => x._id), ...created.map((id) => new mongoose.Types.ObjectId(id))] } });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
