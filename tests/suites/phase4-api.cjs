// Phase 4 API verification — admin student management, default-password reset, delete + scrub. Local stack only.
const TEST = require('../lib/env.cjs');
const fs = require('fs');
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

const TAG = `p4${Date.now() % 1000000}`;
const mkStudent = async (n, profile) => {
  const email = `${TAG}_${n}@example.com`;
  const rollNumber = `${TAG}R${n}`.toUpperCase();
  const r = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber, password: 'origpass123' } });
  const cookie = cookieOf(r, 'student_token');
  if (profile) await call('PATCH', '/api/students/me', { cookie, body: profile });
  const doc = await Student.findOne({ email }).lean();
  return { email, rollNumber, cookie, id: doc._id.toString() };
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const admin = cookieOf(r, 'admin_token');

  const a = await mkStudent('a', { firstName: 'Aarav', lastName: 'Mehta', branch: 'CE', cgpa: 8.2, activeBacklogs: 0, graduationYear: 2026, phone: '9876500001', resumeUrl: 'https://example.com/a.pdf' });
  const b = await mkStudent('b', { firstName: 'Bhavna', lastName: 'Rao', branch: 'IT', cgpa: 7.9, activeBacklogs: 0, graduationYear: 2027, phone: '9876500002', resumeUrl: 'https://example.com/b.pdf' });
  const c = await mkStudent('c');

  console.log('# Access control');
  r = await call('GET', '/api/admin/students');
  ok(r.status === 401, 'no cookie -> 401');
  r = await call('GET', '/api/admin/students', { cookie: a.cookie });
  ok(r.status === 401, 'student cookie -> 401 on list');
  r = await call('GET', '/api/admin/students', { cookie: a.cookie.replace('student_token', 'admin_token') });
  ok(r.status === 401, 'student JWT in admin cookie -> 401');
  r = await call('POST', `/api/admin/students/${b.id}/reset-password`, { cookie: a.cookie });
  ok(r.status === 401, 'student cannot reset');
  r = await call('DELETE', `/api/admin/students/${b.id}`, { cookie: a.cookie });
  ok(r.status === 401, 'student cannot delete');

  console.log('# List, search, filters');
  r = await call('GET', `/api/admin/students?search=${TAG}&limit=100`, { cookie: admin });
  ok(r.status === 200 && r.json.data.length === 3, 'search by email/roll prefix finds 3');
  const keys = Object.keys(r.json.data[0]).sort().join(',');
  ok(keys === 'branch,createdAt,email,firstName,graduationYear,id,institute,lastName,mustChangePassword,rollNumber', 'minimal DTO only', keys);
  ok(!/phone|cgpa|resume|passwordHash|tokenVersion|\$2[ab]\$/.test(r.text), 'no phone/CGPA/resume/hash in list');
  r = await call('GET', `/api/admin/students?search=bhavna`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.data[0].email === b.email, 'case-insensitive name search');
  r = await call('GET', `/api/admin/students?search=${a.rollNumber.toLowerCase()}`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.data[0].id === a.id, 'roll number search');
  r = await call('GET', `/api/admin/students?search=${encodeURIComponent('.*')}`, { cookie: admin });
  ok(r.status === 200 && r.json.data.length === 0, 'regex characters matched literally');
  r = await call('GET', `/api/admin/students?search=${TAG}&branch=IT`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.data[0].id === b.id, 'branch filter');
  r = await call('GET', '/api/admin/students?branch=Hacking', { cookie: admin });
  ok(r.status === 400, 'unknown branch -> 400');
  r = await call('GET', '/api/admin/students?limit=500', { cookie: admin });
  ok(r.status === 400, 'limit over 100 -> 400');
  r = await call('GET', '/api/admin/students?search[$ne]=x', { cookie: admin });
  ok(r.status === 400 || (r.status === 200 && Array.isArray(r.json.data)), 'operator injection in query handled');
  r = await call('GET', `/api/admin/students?search=${TAG}&limit=2&page=2&sort=roll`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.pagination.total === 3 && r.json.pagination.totalPages === 2, 'pagination');

  console.log('# Reset password');
  r = await call('POST', '/api/admin/students/not-an-id/reset-password', { cookie: admin });
  ok(r.status === 400, 'invalid id -> 400');
  r = await call('POST', '/api/admin/students/507f1f77bcf86cd799439011/reset-password', { cookie: admin });
  ok(r.status === 404, 'unknown id -> 404');
  r = await call('POST', `/api/admin/students/${b.id}/reset-password`, { cookie: admin, origin: `${TEST.APP}.evil.com` });
  ok(r.status === 403, 'lookalike origin -> 403');
  r = await call('POST', `/api/admin/students/${b.id}/reset-password`, { cookie: admin });
  ok(r.status === 200 && r.json.data.mustChangePassword === true, 'reset -> 200, pending flag');
  ok(!r.text.includes('college123') && !/passwordHash|\$2[ab]\$/.test(r.text), 'response never contains the password or hash');
  r = await call('GET', '/api/students/me', { cookie: b.cookie });
  ok(r.status === 401, "student's existing session ended");
  r = await call('POST', '/api/students/auth/login', { body: { email: b.email, password: 'origpass123' } });
  ok(r.status === 401, 'old password no longer works');
  r = await call('POST', '/api/students/auth/login', { body: { email: b.email, password: 'college123' } });
  const bTemp = cookieOf(r, 'student_token');
  ok(r.status === 200 && r.json.mustChangePassword === true, 'login with default password -> mustChangePassword');
  r = await call('PATCH', '/api/students/me', { cookie: bTemp, body: { firstName: 'X' } });
  ok(r.status === 403 && r.json.code === 'PASSWORD_CHANGE_REQUIRED', 'restricted: profile edit blocked');
  r = await call('GET', '/api/applications/my/summary', { cookie: bTemp });
  ok(r.status === 403, 'restricted: applications blocked');
  r = await call('GET', '/api/students/me', { cookie: bTemp });
  ok(r.status === 200, 'restricted: profile read allowed');
  r = await call('POST', '/api/students/me/password', { cookie: bTemp, body: { newPassword: 'college123' } });
  ok(r.status === 400, 'cannot keep the default');
  r = await call('POST', '/api/students/me/password', { cookie: bTemp, body: { newPassword: 'brandnew456' } });
  const bNew = cookieOf(r, 'student_token');
  ok(r.status === 200, 'change from default without the temporary password -> 200');
  const bDoc = await Student.findById(b.id).lean();
  ok(!bDoc.mustChangePassword && !bDoc.tempPasswordExpiresAt, 'pending flags cleared');
  r = await call('GET', '/api/applications/my/summary', { cookie: bNew });
  ok(r.status === 200, 'full access restored');
  r = await call('GET', `/api/admin/students?search=bhavna`, { cookie: admin });
  ok(r.json.data[0].mustChangePassword === false, 'list shows reset no longer pending');

  console.log('# Temp password expiry');
  await call('POST', `/api/admin/students/${c.id}/reset-password`, { cookie: admin });
  const cDoc = await Student.findById(c.id).lean();
  const ttlH = (cDoc.tempPasswordExpiresAt - Date.now()) / 3600e3;
  ok(ttlH > 71.9 && ttlH <= 72, `temp password expires in 72h (${ttlH.toFixed(2)}h)`);
  await Student.updateOne({ _id: c.id }, { tempPasswordExpiresAt: new Date(Date.now() - 1000) });
  r = await call('POST', '/api/students/auth/login', { body: { email: c.email, password: 'college123' } });
  ok(r.status === 401 && r.json.message === 'Invalid credentials', 'expired default password -> generic 401');

  console.log('# Delete with application scrub');
  r = await call('POST', '/api/placements', { cookie: admin, body: { company: `${TAG} Co`, role: 'SDE', type: 'Full-Time', ctc: 9, applicationMode: 'in_app', driveDate: istDate(10), deadline: istDate(5), customPrompts: [{ question: 'Hometown?', required: true }] } });
  const drive = r.json.data;
  r = await call('POST', '/api/applications', { cookie: a.cookie, body: { driveId: drive._id, consentGiven: true, coverNote: 'Call me on 9876500001', customAnswers: [{ promptId: drive.customPrompts[0]._id, answer: 'Anand' }] } });
  ok(r.status === 201, 'student A applied');
  await Application.updateOne({ driveId: drive._id }, { status: 'Shortlisted', adminNote: 'strong' });
  r = await call('DELETE', `/api/admin/students/${a.id}`, { cookie: admin, origin: 'http://evil.example' });
  ok(r.status === 403, 'delete needs same-origin');
  r = await call('DELETE', `/api/admin/students/${a.id}`, { cookie: admin });
  ok(r.status === 200 && r.json.anonymizedApplications === 1, 'delete -> 200, 1 application anonymized');
  ok(!(await Student.findById(a.id)), 'student document removed');
  const app = await Application.findOne({ driveId: drive._id }).lean();
  ok(app.snapshot.firstName === 'Deleted' && app.snapshot.lastName === 'User' && app.snapshot.email === '' && app.snapshot.phone === '' && app.snapshot.rollNumber === '', 'snapshot identity scrubbed');
  ok(app.resumeUrl === undefined && app.coverNote === undefined && app.customAnswers.length === 0, 'resume, note and answers removed');
  ok(app.snapshot.branch === 'CE' && app.snapshot.cgpa === 8.2 && app.status === 'Shortlisted', 'academic data + status kept for records');
  ok(!JSON.stringify(app).includes(a.email) && !JSON.stringify(app).includes('9876500001'), 'no email/phone left anywhere in the application');
  r = await call('GET', '/api/students/me', { cookie: a.cookie });
  ok(r.status === 401, "deleted student's session is dead");
  r = await call('DELETE', `/api/admin/students/${a.id}`, { cookie: admin });
  ok(r.status === 404, 'second delete -> 404');
  r = await call('POST', '/api/students/auth/signup', { body: { email: a.email, rollNumber: a.rollNumber, password: 'again12345' } });
  ok(r.status === 201, 'same email + roll number can sign up again (D6)');

  console.log('# Audit log');
  const log = fs.readFileSync(TEST.SERVER_LOG, 'utf8').split('\n').filter((l) => l.includes('[AdminAction]'));
  ok(log.length === 3 && log.some((l) => l.includes('student.resetPassword')) && log.some((l) => l.includes('student.delete')), `admin actions logged (${log.length})`);
  ok(!log.some((l) => /college123|@example\.com|9876/.test(l)), 'audit log has no password, email or phone');

  // cleanup
  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
