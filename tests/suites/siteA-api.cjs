// Site upgrade, part A — backlog field, reset without the temporary password, catalog (university,
// institutes, branches), institute lock and two-step account delete. Local stack only.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const ExcelJS = require('exceljs');

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
  const r = await call('POST', '/api/auth/signup', { body: { email, rollNumber, password: 'origpass123' } });
  const cookie = cookieOf(r, 'tpf_session');
  if (profile) await call('PATCH', '/api/student/profile', { cookie, body: profile });
  const doc = await Student.findOne({ email }).lean();
  return { email, rollNumber, cookie, id: doc._id.toString() };
};
// Resets the account and signs in with the one-time password the reset returned
let lastTemp = null;
const resetAndLogin = async (s, admin) => {
  const reset = await call('POST', `/api/admin/students/${s.id}/reset-password`, { cookie: admin });
  lastTemp = reset.json.temporaryPassword;
  const r = await call('POST', '/api/auth/login', { body: { identifier: s.email, password: lastTemp } });
  return cookieOf(r, 'tpf_session');
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  let r = await call('POST', '/api/auth/login', { body: { identifier: 'testadmin', password: 'testadminpass' } });
  const admin = cookieOf(r, 'tpf_session');
  const drive = await Placement.create({
    company: `${TAG} Corp`, role: 'SDE', type: 'Full-Time', ctc: 10, applicationMode: 'in_app',
    deadline: new Date(istDate(10)), driveDate: new Date(istDate(12)),
  });

  console.log('# Backlog history is gone');
  const a = await mkStudent('a', { ...PROFILE, historyBacklogs: 4 });
  r = await call('GET', '/api/student/profile', { cookie: a.cookie });
  ok(r.status === 200 && !('historyBacklogs' in r.json.data) && r.json.data.activeBacklogs === 0, 'profile DTO has active backlogs only');
  ok((await Student.findById(a.id).lean()).historyBacklogs === undefined, 'a sent historyBacklogs is ignored, not stored');
  await Application.create({
    driveId: drive._id, studentId: a.id, consentGiven: true,
    snapshot: { firstName: 'Ravi', lastName: 'Patel', email: a.email, rollNumber: a.rollNumber, branch: 'CE', cgpa: 8, activeBacklogs: 0, historyBacklogs: 3, graduationYear: 2026, phone: '9876543210' },
  });
  r = await call('GET', `/api/admin/drives/${drive._id}/applicants`, { cookie: admin });
  ok(r.status === 200 && r.json.data[0] && !('historyBacklogs' in r.json.data[0].snapshot), 'applicant DTO leaves out an old snapshot value');
  const res = await fetch(`${API}/api/admin/drives/${drive._id}/applicants/export`, { headers: { Cookie: admin, Origin: ORIGIN } });
  // An .xlsx is a zip, so read it rather than searching the raw bytes
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const header = wb.getWorksheet('Applicants').getRow(1).values.filter(Boolean);
  ok(res.status === 200 && header.includes('Active Backlogs') && !header.includes('Backlog History'), 'export has no Backlog History column', header.join(', '));
  ok(header.includes('Institute'), 'export has an Institute column');

  console.log('# Reset without the temporary password');
  const b = await mkStudent('b', PROFILE);
  let bTemp = await resetAndLogin(b, admin);
  r = await call('POST', '/api/auth/password', { cookie: bTemp, body: { newPassword: lastTemp } });
  ok(r.status === 400, 'the one-time password is rejected as the new password');
  r = await call('POST', '/api/auth/password', { cookie: bTemp, body: { newPassword: 'short' } });
  ok(r.status === 400, 'strength rules still apply');
  r = await call('POST', '/api/auth/password', { cookie: bTemp, body: { newPassword: 'brandnew456' } });
  const bNew = cookieOf(r, 'tpf_session');
  ok(r.status === 200 && bNew, 'reset session sets a password without currentPassword');
  r = await call('POST', '/api/auth/login', { body: { identifier: b.email, password: 'brandnew456' } });
  ok(r.status === 200 && r.json.account.mustChangePassword === false, 'new password logs in normally');

  console.log('# A normal session still needs the current password');
  r = await call('POST', '/api/auth/password', { cookie: bNew, body: { newPassword: 'another789' } });
  ok(r.status === 400 && r.json.errors?.some((e) => e.field === 'currentPassword'), 'missing currentPassword -> 400 on a normal session');
  r = await call('POST', '/api/auth/password', { cookie: bNew, body: { currentPassword: 'wrongpass1', newPassword: 'another789' } });
  ok(r.status === 400 && r.json.errors?.[0]?.message.includes('incorrect'), 'wrong current password -> 400');

  console.log('# An expired temporary password ends the restricted session');
  const c = await mkStudent('c', PROFILE);
  const cTemp = await resetAndLogin(c, admin);
  await Student.updateOne({ _id: c.id }, { $set: { tempPasswordExpiresAt: new Date(Date.now() - 60e3) } });
  r = await call('POST', '/api/auth/password', { cookie: cTemp, body: { newPassword: 'brandnew456' } });
  ok(r.status === 401 && r.json.code === 'TEMP_PASSWORD_EXPIRED', 'expired window -> 401 TEMP_PASSWORD_EXPIRED');
  ok(r.setCookie.some((v) => v.startsWith('tpf_session=;')), 'and the cookie is cleared');
  const cDoc = await Student.findById(c.id).lean();
  ok(cDoc.mustChangePassword === true, 'password was not changed');

  console.log('# New admin routes are admin-only');
  const someId = new mongoose.Types.ObjectId().toString();
  const adminRoutes = [
    ['GET', '/api/admin/catalog'], ['PUT', '/api/admin/catalog/university', { name: 'X University' }],
    ['POST', '/api/admin/catalog/branches', { code: 'QQ', name: 'Quux' }], ['PATCH', `/api/admin/catalog/branches/${someId}`, { name: 'Quux' }],
    ['DELETE', `/api/admin/catalog/branches/${someId}`], ['POST', '/api/admin/catalog/institutes', { name: 'Quux' }],
    ['PATCH', `/api/admin/catalog/institutes/${someId}`, { name: 'Quux' }], ['DELETE', `/api/admin/catalog/institutes/${someId}`],
    ['GET', `/api/admin/catalog/branches/${someId}/usage`],
    ['POST', `/api/admin/students/${a.id}/reset-institute`], ['GET', `/api/admin/students/${a.id}/application-count`],
  ];
  for (const [method, url, body] of adminRoutes) {
    const label = `${method} ${url.replace(/[a-f0-9]{24}/, ':id')}`;
    r = await call(method, url, { body });
    ok(r.status === 401, `${label} without a session -> 401`);
    r = await call(method, url, { body, cookie: a.cookie });
    ok(r.status === 403, `${label} with a student session -> 403`);
    if (method !== 'GET') {
      r = await call(method, url, { body, cookie: admin, origin: 'https://evil.example.com' });
      ok(r.status === 403, `${label} from another origin -> 403`);
    }
  }

  console.log('# College/University');
  for (const bad of ['', 'x', 'y'.repeat(121), { $gt: '' }]) {
    r = await call('PUT', '/api/admin/catalog/university', { cookie: admin, body: { name: bad } });
    ok(r.status === 400, `university name ${JSON.stringify(bad).slice(0, 20)} -> 400`);
  }
  r = await call('PUT', '/api/admin/catalog/university', { cookie: admin, body: { name: '  CHARUSAT University  ' } });
  ok(r.status === 200 && r.json.data.university === 'CHARUSAT University', 'admin sets the university (trimmed)');
  r = await call('GET', '/api/catalog');
  ok(r.status === 200 && r.json.data.university === 'CHARUSAT University', 'public catalog shows it');
  ok(r.json.data.branches.some((x) => x.code === 'CE' && x.name === 'Computer Engineering'), 'branches were seeded from the built-in list');
  r = await call('GET', '/api/student/profile', { cookie: a.cookie });
  ok(r.json.data.university === 'CHARUSAT University' && r.json.data.institute === null && r.json.data.instituteLocked === false, 'every profile reads the current university');

  console.log('# Institutes');
  r = await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: `${TAG} CSPIT` } });
  ok(r.status === 201 && r.json.data.name === `${TAG} CSPIT`, 'create institute');
  const inst1 = r.json.data;
  r = await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: `${TAG} cspit` } });
  ok(r.status === 409 && r.json.code === 'DUPLICATE', 'same name in another case -> 409');
  for (const bad of ['', 'x', 'y'.repeat(121), 42]) {
    r = await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: bad } });
    ok(r.status === 400, `institute name ${JSON.stringify(bad).slice(0, 20)} -> 400`);
  }
  const inst2 = (await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: `${TAG} DEPSTAR` } })).json.data;
  const inst3 = (await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: `${TAG} CMPICA` } })).json.data;
  r = await call('PATCH', `/api/admin/catalog/institutes/${inst2.id}`, { cookie: admin, body: { active: false } });
  ok(r.status === 200 && r.json.data.active === false, 'archive institute');
  r = await call('PATCH', `/api/admin/catalog/institutes/${inst3.id}`, { cookie: admin, body: {} });
  ok(r.status === 400, 'empty update -> 400');
  r = await call('PATCH', `/api/admin/catalog/institutes/${inst3.id}`, { cookie: admin, body: { active: 'yes' } });
  ok(r.status === 400, 'non-boolean active -> 400');
  r = await call('GET', '/api/catalog');
  ok(r.json.data.institutes.some((i) => i.id === inst1.id) && !r.json.data.institutes.some((i) => i.id === inst2.id), 'catalog lists active institutes only');

  console.log('# Institute: required, chosen once, locked');
  const d = await mkStudent('d', PROFILE);
  r = await call('POST', '/api/student/applications', { cookie: d.cookie, body: { driveId: drive._id, consentGiven: true } });
  ok(r.status === 422 && r.json.code === 'INCOMPLETE_PROFILE' && r.json.missing.includes('instituteId'), 'no institute -> cannot apply');
  for (const [bad, label] of [['abc', 'malformed id'], [someId, 'unknown institute'], [inst2.id, 'archived institute'], [{ $ne: null }, 'operator']]) {
    r = await call('PUT', '/api/student/profile/institute', { cookie: d.cookie, body: { instituteId: bad } });
    ok(r.status === 400, `${label} -> 400`);
  }
  r = await call('PUT', '/api/student/profile/institute', { cookie: d.cookie, body: { instituteId: inst1.id }, origin: 'https://evil.example.com' });
  ok(r.status === 403, 'cross-origin choice -> 403');
  r = await call('PUT', '/api/student/profile/institute', { cookie: d.cookie, body: { instituteId: inst1.id } });
  ok(r.status === 200 && r.json.data.institute?.id === inst1.id && r.json.data.instituteLocked === true, 'first choice -> 200, locked');
  ok(!r.json.data.missingFields.includes('instituteId'), 'no longer missing');
  r = await call('PUT', '/api/student/profile/institute', { cookie: d.cookie, body: { instituteId: inst3.id } });
  ok(r.status === 409 && r.json.code === 'INSTITUTE_LOCKED', 'second choice -> 409 INSTITUTE_LOCKED');
  r = await call('PATCH', '/api/student/profile', { cookie: d.cookie, body: { instituteId: inst3.id, institute: 'Hacked' } });
  ok(r.status === 200 && r.json.data.institute.id === inst1.id, 'PATCH /me cannot change it');
  const e = await mkStudent('e', PROFILE);
  const racers = await Promise.all([inst1, inst3, inst1, inst3, inst1, inst3, inst1, inst3].map((i) =>
    call('PUT', '/api/student/profile/institute', { cookie: e.cookie, body: { instituteId: i.id } })));
  const winners = racers.filter((x) => x.status === 200);
  const eDoc = await Student.findById(e.id).lean();
  ok(winners.length === 1 && racers.filter((x) => x.status === 409).length === 7, `8 concurrent choices -> exactly one wins (${winners.length})`);
  ok(String(eDoc.instituteId) === winners[0]?.json.data.institute.id, 'and the stored one is the winner');
  r = await call('POST', '/api/student/applications', { cookie: d.cookie, body: { driveId: drive._id, consentGiven: true } });
  ok(r.status === 201, 'with an institute -> can apply');
  let dApp = await Application.findOne({ driveId: drive._id, studentId: d.id }).lean();
  ok(dApp.snapshot.institute === `${TAG} CSPIT` && dApp.snapshot.university === 'CHARUSAT University', 'snapshot keeps institute and university names');
  r = await call('GET', `/api/admin/students?search=${d.rollNumber}`, { cookie: admin });
  ok(r.json.data[0]?.institute?.name === `${TAG} CSPIT`, 'admin list shows the institute');

  console.log('# Admin resets the institute');
  r = await call('POST', `/api/admin/students/${e.id}/reset-institute`, { cookie: admin });
  ok(r.status === 200 && r.json.data.institute === null, 'reset -> institute cleared');
  r = await call('POST', `/api/admin/students/${someId}/reset-institute`, { cookie: admin });
  ok(r.status === 404, 'unknown student -> 404');
  r = await call('PUT', '/api/student/profile/institute', { cookie: e.cookie, body: { instituteId: inst3.id } });
  ok(r.status === 200 && r.json.data.institute.id === inst3.id, 'student can choose again after a reset');

  console.log('# Deleting institutes');
  r = await call('DELETE', `/api/admin/catalog/institutes/${inst1.id}`, { cookie: admin });
  ok(r.status === 409 && r.json.code === 'IN_USE' && r.json.usage.students === 1, 'in use -> 409 IN_USE with the count');
  r = await call('DELETE', `/api/admin/catalog/institutes/${inst1.id}?force=yes`, { cookie: admin });
  ok(r.status === 400, 'bad force value -> 400');
  r = await call('DELETE', `/api/admin/catalog/institutes/${inst1.id}?force=true`, { cookie: admin });
  ok(r.status === 200 && r.json.clearedStudents === 1, 'force delete -> its students are cleared');
  r = await call('GET', '/api/student/profile', { cookie: d.cookie });
  ok(r.json.data.institute === null && r.json.data.instituteLocked === false && r.json.data.missingFields.includes('instituteId'), 'that student must choose again');
  dApp = await Application.findById(dApp._id).lean();
  ok(dApp.snapshot.institute === `${TAG} CSPIT`, 'past application keeps the old name');
  r = await call('DELETE', `/api/admin/catalog/institutes/${inst2.id}`, { cookie: admin });
  ok(r.status === 200, 'unused institute deletes straight away');

  console.log('# Branches');
  const code = `T${TAG.slice(-5)}`.toUpperCase();
  r = await call('POST', '/api/admin/catalog/branches', { cookie: admin, body: { code: code.toLowerCase(), name: 'Test Quantum Engineering' } });
  ok(r.status === 201 && r.json.data.code === code && r.json.data.active === true, 'create branch (code upper-cased)');
  const br = r.json.data;
  r = await call('POST', '/api/admin/catalog/branches', { cookie: admin, body: { code, name: 'Again' } });
  ok(r.status === 409 && r.json.code === 'DUPLICATE', 'duplicate code -> 409');
  for (const bad of ['A,B', 'TOOLONGCODE123', '', '-X', { $gt: '' }]) {
    r = await call('POST', '/api/admin/catalog/branches', { cookie: admin, body: { code: bad, name: 'Bad Branch' } });
    ok(r.status === 400, `branch code ${JSON.stringify(bad)} -> 400`);
  }
  r = await call('PATCH', `/api/admin/catalog/branches/${br.id}`, { cookie: admin, body: { code: 'ZZ', name: 'Quantum Engineering' } });
  ok(r.status === 200 && r.json.data.code === code && r.json.data.name === 'Quantum Engineering', 'rename keeps the code');
  const f = await mkStudent('f', { ...PROFILE, branch: code });
  ok((await Student.findById(f.id).lean()).branch === code, 'students can choose the new branch');
  r = await call('POST', '/api/admin/drives', { cookie: admin, body: { company: `${TAG} Bad`, role: 'X', type: 'Full-Time', ctc: 5, eligibility: { branches: ['NOPE1'] } } });
  ok(r.status === 400, 'drive with an unknown branch -> 400');
  r = await call('PATCH', `/api/admin/catalog/branches/${br.id}`, { cookie: admin, body: { active: false } });
  ok(r.status === 200 && r.json.data.active === false, 'archive branch');
  const g = await mkStudent('g', PROFILE);
  r = await call('PATCH', '/api/student/profile', { cookie: g.cookie, body: { branch: code } });
  ok(r.status === 400 && r.json.errors?.[0]?.field === 'branch', 'archived branch cannot be newly chosen');
  r = await call('PATCH', '/api/student/profile', { cookie: f.cookie, body: { branch: code, firstName: 'Fiona' } });
  ok(r.status === 200, 'a student who has it can keep it');
  r = await call('GET', '/api/catalog');
  ok(r.json.data.branches.some((x) => x.code === code && x.active === false && x.name === 'Quantum Engineering'), 'archived branch still labelled in the catalog');

  console.log('# Deleting branches');
  const open1 = await Placement.create({ company: `${TAG} Open1`, role: 'R', type: 'Full-Time', ctc: 5, eligibility: { branches: [code, 'CE'] } });
  const only = await Placement.create({ company: `${TAG} Only`, role: 'R', type: 'Full-Time', ctc: 5, eligibility: { branches: [code] } });
  const past = await Placement.create({ company: `${TAG} Past`, role: 'R', type: 'Full-Time', ctc: 5, status: 'Completed', eligibility: { branches: [code] } });
  r = await call('GET', '/api/admin/catalog', { cookie: admin });
  const row = r.json.data.branches.find((x) => x.code === code);
  ok(row && row.students === 1 && row.openDrives === 2 && row.completedDrives === 1, 'settings list shows usage counts', JSON.stringify(row));
  r = await call('GET', `/api/admin/catalog/branches/${br.id}/usage`, { cookie: admin });
  ok(r.status === 200 && r.json.data.students === 1 && r.json.data.onlyBranchDrives.length === 1, 'usage endpoint lists what a delete would touch');
  r = await call('DELETE', `/api/admin/catalog/branches/${br.id}`, { cookie: admin });
  ok(r.status === 409 && r.json.code === 'IN_USE' && r.json.usage.students === 1 && r.json.usage.openDrives === 2, 'in use -> 409 IN_USE');
  r = await call('DELETE', `/api/admin/catalog/branches/${br.id}?force=true`, { cookie: admin });
  ok(r.status === 409 && r.json.code === 'ONLY_BRANCH' && r.json.usage.onlyBranchDrives.some((x) => x.id === only._id.toString()), 'an open drive only for it blocks even a forced delete');
  ok((await Student.findById(f.id).lean()).branch === code, 'and nothing was changed');
  await Placement.updateOne({ _id: only._id }, { $set: { 'eligibility.branches': ['CE'] } });
  r = await call('DELETE', `/api/admin/catalog/branches/${br.id}?force=true`, { cookie: admin });
  ok(r.status === 200 && r.json.clearedStudents === 1 && r.json.updatedDrives === 1, 'forced delete clears students and open drives', JSON.stringify(r.json));
  ok((await Student.findById(f.id).lean()).branch === undefined, 'student must choose a branch again');
  ok(JSON.stringify((await Placement.findById(open1._id).lean()).eligibility.branches) === '["CE"]', 'removed from the open drive');
  ok(JSON.stringify((await Placement.findById(past._id).lean()).eligibility.branches) === JSON.stringify([code]), 'completed drive keeps it as history');
  const unused = (await call('POST', '/api/admin/catalog/branches', { cookie: admin, body: { code: `${code}X`, name: 'Unused Branch' } })).json.data;
  r = await call('DELETE', `/api/admin/catalog/branches/${unused.id}`, { cookie: admin });
  ok(r.status === 200, 'unused branch deletes straight away');

  console.log('# Two-step account delete');
  const h = await mkStudent('h', PROFILE);
  await call('PUT', '/api/student/profile/institute', { cookie: h.cookie, body: { instituteId: inst3.id } });
  r = await call('POST', '/api/student/applications', { cookie: h.cookie, body: { driveId: drive._id, consentGiven: true } });
  ok(r.status === 201, 'h applied');
  r = await call('GET', `/api/admin/students/${h.id}/application-count`, { cookie: admin });
  ok(r.status === 200 && r.json.data.count === 1, 'application count for the second prompt');
  r = await call('DELETE', `/api/admin/students/${h.id}?applications=maybe`, { cookie: admin });
  ok(r.status === 400, 'unknown mode -> 400');
  r = await call('DELETE', `/api/admin/students/${h.id}?applications=retain`, { cookie: admin });
  ok(r.status === 200 && r.json.anonymizedApplications === 1, 'retain -> application kept');
  const kept = await Application.findOne({ driveId: drive._id, studentId: h.id }).lean();
  ok(kept && kept.studentDeleted === true && kept.snapshot.email === '' && kept.snapshot.branch === 'CE', 'kept record is flagged and scrubbed, academic data stays');
  r = await call('GET', `/api/admin/drives/${drive._id}/applicants?limit=100`, { cookie: admin });
  ok(r.json.data.some((x) => x.id === kept._id.toString() && x.studentDeleted === true), 'applicant list marks it as a deleted account');
  ok(r.json.stats.Applied >= 2, 'and still counts it');
  r = await call('DELETE', `/api/admin/students/${d.id}?applications=delete`, { cookie: admin });
  ok(r.status === 200 && r.json.deletedApplications === 1, 'delete -> applications removed too');
  ok((await Application.countDocuments({ studentId: d.id })) === 0 && !(await Student.exists({ _id: d.id })), 'nothing left of that account');
  const k = await mkStudent('k', PROFILE);
  r = await call('DELETE', `/api/admin/students/${k.id}`, { cookie: admin });
  ok(r.status === 200 && 'anonymizedApplications' in r.json, 'no mode (older client) -> retain');
  await Placement.deleteMany({ _id: { $in: [open1._id, only._id, past._id] } });
  await call('DELETE', `/api/admin/catalog/institutes/${inst3.id}?force=true`, { cookie: admin });

  // cleanup
  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
