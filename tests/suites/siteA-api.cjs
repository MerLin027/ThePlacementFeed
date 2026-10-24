// Site upgrade, part A — backlog field, reset without the temporary password, catalog (university,
// institutes, branches), institute lock and two-step account delete. Local stack only.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const Placement = require(path.join(SERVER, 'models/Placement'));

const API = TEST.API;
const ORIGIN = TEST.APP;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const call = async (method, url, { body, cookie, origin = ORIGIN } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie() };
};
const cookieOf = (r, name) => (r.setCookie.find((c) => c.startsWith(name + '=')) || '').split(';')[0];
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

const TAG = `sa${Date.now() % 1000000}`;
const PROFILE = { firstName: 'Ravi', lastName: 'Patel', branch: 'CE', cgpa: 8, activeBacklogs: 0, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/ravi.pdf' };
const mkStudent = async (n, profile) => {
  const email = `${TAG}_${n}@example.com`;
  const rollNumber = `${TAG}R${n}`.toUpperCase();
  const r = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber, password: 'origpass123' } });
  const cookie = cookieOf(r, 'student_token');
  if (profile) await call('PATCH', '/api/students/me', { cookie, body: profile });
  const doc = await Student.findOne({ email }).lean();
  return { email, rollNumber, cookie, id: doc._id.toString() };
};
const resetAndLogin = async (s, admin) => {
  await call('POST', `/api/admin/students/${s.id}/reset-password`, { cookie: admin });
  const r = await call('POST', '/api/students/auth/login', { body: { email: s.email, password: 'college123' } });
  return cookieOf(r, 'student_token');
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const admin = cookieOf(r, 'admin_token');
  const drive = await Placement.create({
    company: `${TAG} Corp`, role: 'SDE', type: 'Full-Time', ctc: 10, applicationMode: 'in_app',
    deadline: new Date(istDate(10)), driveDate: new Date(istDate(12)),
  });

  console.log('# Backlog history is gone');
  const a = await mkStudent('a', { ...PROFILE, historyBacklogs: 4 });
  r = await call('GET', '/api/students/me', { cookie: a.cookie });
  ok(r.status === 200 && !('historyBacklogs' in r.json.data) && r.json.data.activeBacklogs === 0, 'profile DTO has active backlogs only');
  ok((await Student.findById(a.id).lean()).historyBacklogs === undefined, 'a sent historyBacklogs is ignored, not stored');
  await Application.create({
    driveId: drive._id, studentId: a.id, consentGiven: true,
    snapshot: { firstName: 'Ravi', lastName: 'Patel', email: a.email, rollNumber: a.rollNumber, branch: 'CE', cgpa: 8, activeBacklogs: 0, historyBacklogs: 3, graduationYear: 2026, phone: '9876543210' },
  });
  r = await call('GET', `/api/placements/${drive._id}/applicants`, { cookie: admin });
  ok(r.status === 200 && r.json.data[0] && !('historyBacklogs' in r.json.data[0].snapshot), 'applicant DTO leaves out an old snapshot value');
  const res = await fetch(`${API}/api/placements/${drive._id}/applicants/export`, { headers: { Cookie: admin, Origin: ORIGIN } });
  const xlsx = Buffer.from(await res.arrayBuffer());
  ok(res.status === 200 && !xlsx.includes('Backlog History') && xlsx.length > 0, 'export has no Backlog History column');

  console.log('# Reset without the temporary password');
  const b = await mkStudent('b', PROFILE);
  let bTemp = await resetAndLogin(b, admin);
  r = await call('POST', '/api/students/me/password', { cookie: bTemp, body: { newPassword: 'college123' } });
  ok(r.status === 400, 'the default is still rejected as the new password');
  r = await call('POST', '/api/students/me/password', { cookie: bTemp, body: { newPassword: 'short' } });
  ok(r.status === 400, 'strength rules still apply');
  r = await call('POST', '/api/students/me/password', { cookie: bTemp, body: { newPassword: 'brandnew456' } });
  const bNew = cookieOf(r, 'student_token');
  ok(r.status === 200 && bNew, 'reset session sets a password without currentPassword');
  r = await call('POST', '/api/students/auth/login', { body: { email: b.email, password: 'brandnew456' } });
  ok(r.status === 200 && r.json.mustChangePassword === false, 'new password logs in normally');

  console.log('# A normal session still needs the current password');
  r = await call('POST', '/api/students/me/password', { cookie: bNew, body: { newPassword: 'another789' } });
  ok(r.status === 400 && r.json.errors?.some((e) => e.field === 'currentPassword'), 'missing currentPassword -> 400 on a normal session');
  r = await call('POST', '/api/students/me/password', { cookie: bNew, body: { currentPassword: 'wrongpass1', newPassword: 'another789' } });
  ok(r.status === 400 && r.json.errors?.[0]?.message.includes('incorrect'), 'wrong current password -> 400');

  console.log('# An expired temporary password ends the restricted session');
  const c = await mkStudent('c', PROFILE);
  const cTemp = await resetAndLogin(c, admin);
  await Student.updateOne({ _id: c.id }, { $set: { tempPasswordExpiresAt: new Date(Date.now() - 60e3) } });
  r = await call('POST', '/api/students/me/password', { cookie: cTemp, body: { newPassword: 'brandnew456' } });
  ok(r.status === 401 && r.json.code === 'TEMP_PASSWORD_EXPIRED', 'expired window -> 401 TEMP_PASSWORD_EXPIRED');
  ok(r.setCookie.some((v) => v.startsWith('student_token=;')), 'and the cookie is cleared');
  const cDoc = await Student.findById(c.id).lean();
  ok(cDoc.mustChangePassword === true, 'password was not changed');

  // cleanup
  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
