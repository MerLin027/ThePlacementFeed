// Phase 3 API verification — applications rules engine, ownership, cascade. Local throwaway server only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
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

// IST "YYYY-MM-DD" offset by n days
const istDate = (n) => {
  const d = new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3);
  return d.toISOString().slice(0, 10);
};

const TAG = `p3_${Date.now()}`;
let seq = 0;
const newStudent = async (profile) => {
  seq++;
  const email = `${TAG}_${seq}@example.com`;
  const r = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber: `P3${String(Date.now()).slice(-6)}${seq}`, password: 'goodpass123' } });
  if (r.status !== 201) throw new Error('signup failed ' + r.status + ' ' + r.text);
  const cookie = r.setCookie.find((c) => c.startsWith('student_token=')).split(';')[0];
  if (profile) {
    const p = await call('PATCH', '/api/students/me', { cookie, body: profile });
    await chooseInstitute(cookie);
    if (p.status !== 200) throw new Error('profile failed ' + p.text);
  }
  return { email, cookie };
};
const COMPLETE = { firstName: 'Ravi', lastName: 'Patel', branch: 'CE', cgpa: 8, activeBacklogs: 0, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/ravi.pdf' };

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);

  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const admin = r.setCookie[0].split(';')[0];
  const mk = async (overrides) => {
    const res = await call('POST', '/api/placements', {
      cookie: admin,
      body: { company: `${TAG}-Co`, role: 'SDE', type: 'Full-Time', ctc: 10, driveDate: istDate(10), deadline: istDate(5), ...overrides },
    });
    if (res.status !== 201) throw new Error('create drive failed ' + res.text);
    return res.json.data;
  };

  console.log('# Drive config validation');
  r = await call('POST', '/api/placements', { cookie: admin, body: { company: 'x', role: 'y', type: 'Full-Time', ctc: 1, applicationMode: 'both' } });
  ok(r.status === 400, "'both' without formUrl rejected");
  r = await call('POST', '/api/placements', { cookie: admin, body: { company: 'x', role: 'y', type: 'Full-Time', ctc: 1, applicationMode: 'magic' } });
  ok(r.status === 400, 'unknown applicationMode rejected');
  r = await call('POST', '/api/placements', { cookie: admin, body: { company: 'x', role: 'y', type: 'Full-Time', ctc: 1, applicationMode: 'in_app', customPrompts: Array(6).fill({ question: 'q' }) } });
  ok(r.status === 400, '6 custom prompts rejected');
  r = await call('POST', '/api/placements', { cookie: admin, body: { company: 'x', role: 'y', type: 'Full-Time', ctc: 1, applicationMode: 'in_app', customPrompts: [{ question: '   ' }] } });
  ok(r.status === 400, 'blank prompt rejected');

  const ext = await mk({ formUrl: 'https://forms.gle/abc' });
  ok(ext.applicationMode === 'external', 'default applicationMode is external');
  const inApp = await mk({
    applicationMode: 'in_app',
    eligibility: { branches: ['CE', 'IT'], cgpa: 7, backlog: 0 },
    customPrompts: [{ question: 'Willing to relocate?', required: true }, { question: 'GitHub profile', required: false }],
  });
  const postponed = await mk({ applicationMode: 'in_app' });
  await call('PATCH', `/api/placements/${postponed._id}/postpone`, { cookie: admin, body: { isPostponed: true } });
  const pastDeadline = await mk({ applicationMode: 'in_app', deadline: istDate(-1) });
  const todayDeadline = await mk({ applicationMode: 'in_app', deadline: istDate(0) });
  const completed = await mk({ applicationMode: 'in_app', status: 'Completed' });
  const meOnly = await mk({ applicationMode: 'in_app', eligibility: { branches: ['ME'] } });
  const cgpa9 = await mk({ applicationMode: 'in_app', eligibility: { cgpa: 9 } });
  const noBacklogs = await mk({ applicationMode: 'in_app', eligibility: { backlog: 0 } });
  const both = await mk({ applicationMode: 'both', formUrl: 'https://forms.gle/xyz' });
  const [q1, q2] = inApp.customPrompts;

  console.log('# Rules engine');
  const apply = (s, driveId, extra = {}) => call('POST', '/api/applications', { cookie: s.cookie, body: { driveId, consentGiven: true, ...extra } });

  const incomplete = await newStudent();
  r = await apply(incomplete, inApp._id);
  ok(r.status === 422 && r.json.code === 'INCOMPLETE_PROFILE' && r.json.missing.length === 8 && r.json.missing.includes('instituteId'), 'incomplete profile -> 422 with missing list (incl. institute)');

  const s1 = await newStudent(COMPLETE);
  r = await apply(s1, ext._id);
  ok(r.status === 400 && r.json.code === 'EXTERNAL_ONLY', 'external-only drive');
  r = await apply(s1, postponed._id);
  ok(r.status === 400 && r.json.code === 'DRIVE_POSTPONED', 'postponed drive');
  r = await apply(s1, pastDeadline._id);
  ok(r.status === 400 && r.json.code === 'DEADLINE_PASSED', 'deadline yesterday (IST) -> closed');
  r = await apply(s1, completed._id);
  ok(r.status === 400 && r.json.code === 'DRIVE_COMPLETED', 'completed drive');
  r = await apply(s1, meOnly._id);
  ok(r.status === 400 && r.json.code === 'INELIGIBLE_BRANCH', 'wrong branch');
  r = await apply(s1, cgpa9._id);
  ok(r.status === 400 && r.json.code === 'INELIGIBLE_CGPA', 'low CGPA');
  r = await apply(s1, inApp._id, { customAnswers: [{ promptId: q2._id, answer: 'gh/ravi' }] });
  ok(r.status === 400 && r.json.code === 'MISSING_ANSWERS' && r.json.missingPromptIds[0] === q1._id, 'required question unanswered');

  const s2 = await newStudent({ ...COMPLETE, activeBacklogs: 1 });
  r = await apply(s2, noBacklogs._id);
  ok(r.status === 400 && r.json.code === 'INELIGIBLE_BACKLOGS', 'too many backlogs');
  r = await apply(s2, inApp._id, { consentGiven: false });
  ok(r.status === 400, 'consent false rejected');
  r = await apply(s2, inApp._id, { consentGiven: 'true' });
  ok(r.status === 400, "consent 'true' string rejected");
  r = await apply(s2, inApp._id, { resumeUrl: 'javascript:alert(1)' });
  ok(r.status === 400, 'javascript: resume link rejected');
  r = await apply(s2, 'not-an-id');
  ok(r.status === 400, 'invalid driveId -> 400');
  r = await apply(s2, '507f1f77bcf86cd799439011');
  ok(r.status === 404, 'unknown drive -> 404');
  r = await call('POST', '/api/applications', { cookie: s2.cookie, origin: `${TEST.APP}.evil.com`, body: { driveId: inApp._id, consentGiven: true } });
  ok(r.status === 403, 'lookalike origin -> 403');

  console.log('# Successful application + mass assignment');
  const s3 = await newStudent(COMPLETE);
  const s3Doc = await Student.findOne({ email: s3.email }).lean();
  r = await apply(s3, inApp._id, {
    resumeUrl: 'https://example.com/tailored.pdf',
    coverNote: '  Excited to apply  ',
    customAnswers: [
      { promptId: q1._id, answer: 'Yes' },
      { promptId: '507f1f77bcf86cd799439011', answer: 'ignored' },
    ],
    status: 'Offered',
    studentId: s1.cookie,
    snapshot: { cgpa: 10, firstName: 'Hacker' },
    adminNote: 'self-promoted',
  });
  ok(r.status === 201 && r.json.data.status === 'Applied', 'eligible application -> 201 Applied');
  ok(!('adminNote' in r.json.data) && !('snapshot' in r.json.data), 'student DTO hides admin note and snapshot');
  let app = await Application.findOne({ driveId: inApp._id, studentId: s3Doc._id }).lean();
  ok(app && app.status === 'Applied' && !app.adminNote, 'status/adminNote not settable by student');
  ok(app.snapshot.cgpa === 8 && app.snapshot.firstName === 'Ravi' && app.snapshot.email === s3.email, 'snapshot built from profile, not body');
  ok(app.customAnswers.length === 1 && app.customAnswers[0].question === 'Willing to relocate?', 'answers matched to drive prompts; unknown id ignored');
  ok(app.resumeUrl === 'https://example.com/tailored.pdf' && app.coverNote === 'Excited to apply', 'resume override + trimmed note stored');
  r = await apply(s3, inApp._id, { customAnswers: [{ promptId: q1._id, answer: 'Yes' }] });
  ok(r.status === 409 && r.json.code === 'ALREADY_APPLIED', 'duplicate -> 409');
  r = await apply(s3, todayDeadline._id);
  ok(r.status === 201, 'deadline today (IST) still open');
  r = await apply(s3, both._id);
  ok(r.status === 201, "'both' drive accepts in-app application");
  ok((await Application.findOne({ driveId: both._id, studentId: s3Doc._id }).lean()).resumeUrl === COMPLETE.resumeUrl, 'resume defaults to profile link');

  await call('PATCH', '/api/students/me', { cookie: s3.cookie, body: { cgpa: 9.5, firstName: 'Ravindra' } });
  app = await Application.findOne({ driveId: inApp._id, studentId: s3Doc._id }).lean();
  ok(app.snapshot.cgpa === 8 && app.snapshot.firstName === 'Ravi', 'later profile edit does not change snapshot');

  console.log('# Ownership');
  r = await call('GET', '/api/applications/my/summary', { cookie: s3.cookie });
  ok(r.status === 200 && r.json.data.length === 3, 'own summary lists 3');
  r = await call('GET', '/api/applications/my/summary', { cookie: s1.cookie });
  ok(r.status === 200 && r.json.data.length === 0, "other student's summary is empty");
  r = await call('GET', '/api/applications/my', { cookie: s3.cookie });
  ok(r.status === 200 && r.json.data.length === 3 && r.json.data[0].company && r.json.pagination.total === 3, 'own paginated list with drive names');
  ok(!r.text.includes('snapshot') && !r.text.includes('phone'), 'list exposes no snapshot/PII');
  r = await call('GET', '/api/applications/my/summary');
  ok(r.status === 401, 'summary without session -> 401');
  r = await call('GET', '/api/applications/my/summary', { cookie: admin.replace('admin_token', 'student_token') });
  ok(r.status === 401, 'admin token cannot read student summary');

  console.log('# Public drive data has no applicant info');
  r = await call('GET', `/api/placements/${inApp._id}`);
  ok(r.status === 200 && !/applicant|application(s|Count)|snapshot|Ravi/i.test(r.text), 'public drive JSON has no applicant data');

  console.log('# Restricted session cannot apply');
  await Student.updateOne({ email: s1.email }, { mustChangePassword: true });
  r = await apply(s1, todayDeadline._id);
  ok(r.status === 403 && r.json.code === 'PASSWORD_CHANGE_REQUIRED', 'restricted student -> 403');

  console.log('# Admin count + cascade delete');
  r = await call('GET', `/api/placements/${inApp._id}/application-count`, { cookie: admin });
  ok(r.status === 200 && r.json.data.count === 1, 'admin application-count = 1');
  r = await call('GET', `/api/placements/${inApp._id}/application-count`, { cookie: s3.cookie });
  ok(r.status === 401, 'student cannot read application-count');
  r = await call('DELETE', `/api/placements/${inApp._id}`, { cookie: admin });
  ok(r.status === 200 && r.json.deletedApplications === 1, 'drive delete reports deleted applications');
  ok((await Application.countDocuments({ driveId: inApp._id })) === 0, 'applications removed with drive');

  console.log('# Per-student apply rate limit');
  const s4 = await newStudent(COMPLETE);
  let last;
  for (let i = 0; i < 11; i++) last = await apply(s4, ext._id);
  ok(last.status === 429, '11th apply attempt in 15 min -> 429');
  r = await apply(s3, ext._id);
  ok(r.status === 400, 'other student unaffected by that limit');

  // cleanup
  const ids = (await Placement.find({ company: `${TAG}-Co` }).select('_id').lean()).map((d) => d._id);
  await Application.deleteMany({ driveId: { $in: ids } });
  await Placement.deleteMany({ _id: { $in: ids } });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
