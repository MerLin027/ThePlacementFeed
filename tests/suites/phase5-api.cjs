// Phase 5 API verification — applicant management + Excel export. Local throwaway stack only.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const fs = require('fs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
// Reads the exports back; a test-only dependency (the server writes them with write-excel-file)
const ExcelJS = require('exceljs');
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));

const API = TEST.API;
const ORIGIN = TEST.APP;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const call = async (method, url, { body, cookie, origin = ORIGIN, raw } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie() };
};
const cookieOf = (r, name) => (r.setCookie.find((c) => c.startsWith(name + '=')) || '').split(';')[0];
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `p5${Date.now() % 1000000}`;

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const suiteStart = new Date();
  let r = await call('POST', '/api/auth/login', { body: { identifier: 'testadmin', password: 'testadminpass' } });
  const admin = cookieOf(r, 'tpf_session');
  const mkDrive = async (name, extra = {}) => (await call('POST', '/api/admin/drives', { cookie: admin, body: { company: `${TAG} ${name}`, role: 'SDE', type: 'Full-Time', ctc: 9, applicationMode: 'in_app', driveDate: istDate(10), deadline: istDate(5), ...extra } })).json.data;
  const d1 = await mkDrive('Acme', { customPrompts: [{ question: 'Hometown?', required: true }] });
  const d2 = await mkDrive('Other');
  const promptId = d1.customPrompts[0]._id;

  const people = [
    { n: 'a', firstName: 'Asha', lastName: 'Iyer', branch: 'CE', cgpa: 9.1 },
    { n: 'b', firstName: 'Bharat', lastName: 'Shah', branch: 'IT', cgpa: 7.4 },
    { n: 'c', firstName: 'Chirag', lastName: 'Modi', branch: 'IT', cgpa: 8.3 },
    { n: 'd', firstName: 'Diya', lastName: 'Patel', branch: 'EC', cgpa: 6.9 },
  ];
  const students = {};
  for (const p of people) {
    const email = `${TAG}_${p.n}@example.com`;
    const s = await call('POST', '/api/auth/signup', { body: { email, rollNumber: `${TAG}${p.n}`.toUpperCase(), password: 'goodpass123' } });
    const cookie = cookieOf(s, 'tpf_session');
    await call('PATCH', '/api/student/profile', { cookie, body: { firstName: p.firstName, lastName: p.lastName, branch: p.branch, cgpa: p.cgpa, activeBacklogs: 0, graduationYear: 2026, phone: '9000000001', resumeUrl: `https://example.com/${p.n}.pdf` } });
    await chooseInstitute(cookie);
    const answer = p.n === 'a' ? '+1+1' : 'Anand';
    const cover = p.n === 'a' ? '=HYPERLINK("http://evil.example","click me")' : 'Hello';
    r = await call('POST', '/api/student/applications', { cookie, body: { driveId: d1._id, consentGiven: true, coverNote: cover, customAnswers: [{ promptId, answer }] } });
    if (r.status !== 201) throw new Error('apply failed ' + r.text);
    students[p.n] = { email, cookie, appId: r.json.data.id };
  }
  r = await call('POST', '/api/student/applications', { cookie: students.b.cookie, body: { driveId: d2._id, consentGiven: true } });
  const d2AppId = r.json.data.id;
  const base = `/api/admin/drives/${d1._id}/applicants`;

  console.log('# Access control');
  r = await call('GET', base);
  ok(r.status === 401, 'no cookie -> 401');
  r = await call('GET', base, { cookie: students.a.cookie });
  ok(r.status === 403, 'student -> 403 on list');
  r = await call('GET', `${base}/export`, { cookie: students.a.cookie });
  ok(r.status === 403, 'student -> 403 on export');
  r = await call('PATCH', `${base}/${students.a.appId}`, { cookie: students.a.cookie, body: { status: 'Offered' } });
  ok(r.status === 403, 'student cannot change own status');
  r = await call('GET', '/api/admin/drives/not-an-id/applicants', { cookie: admin });
  ok(r.status === 400, 'invalid drive id -> 400');
  r = await call('GET', '/api/admin/drives/507f1f77bcf86cd799439011/applicants', { cookie: admin });
  ok(r.status === 404, 'unknown drive -> 404');

  console.log('# List + filters');
  r = await call('GET', base, { cookie: admin });
  ok(r.status === 200 && r.json.pagination.total === 4 && r.json.stats.Applied === 4 && r.json.drive.company === `${TAG} Acme`, 'list: 4 applicants, stats, drive info');
  const one = r.json.data.find((a) => a.snapshot.firstName === 'Asha');
  ok(one.customAnswers[0].question === 'Hometown?' && one.coverNote.startsWith('=HYPERLINK') && one.snapshot.phone === '9000000001', 'DTO has answers, note, contact details');
  ok(!r.text.includes('studentId') && !r.text.includes('__v'), 'DTO hides internal ids');
  r = await call('GET', `${base}?branch=IT`, { cookie: admin });
  ok(r.json.data.length === 2 && r.json.data.every((a) => a.snapshot.branch === 'IT'), 'branch filter');
  r = await call('GET', `${base}?cgpaMin=8&cgpaMax=9.5`, { cookie: admin });
  ok(r.json.data.length === 2, 'CGPA range filter');
  r = await call('GET', `${base}?sort=cgpa_desc`, { cookie: admin });
  ok(r.json.data.map((a) => a.snapshot.cgpa).join(',') === '9.1,8.3,7.4,6.9', 'sort by CGPA desc');
  r = await call('GET', `${base}?search=${TAG}c`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.data[0].snapshot.firstName === 'Chirag', 'search by roll number');
  r = await call('GET', `${base}?search=${encodeURIComponent('(.*)')}`, { cookie: admin });
  ok(r.status === 200 && r.json.data.length === 0, 'regex chars literal');
  r = await call('GET', `${base}?limit=101`, { cookie: admin });
  ok(r.status === 400, 'limit > 100 -> 400');
  r = await call('GET', `${base}?status=Hired`, { cookie: admin });
  ok(r.status === 400, 'unknown status -> 400');
  r = await call('GET', `${base}?cgpaMin=abc`, { cookie: admin });
  ok(r.status === 400, 'non-numeric CGPA -> 400');

  console.log('# Single update');
  r = await call('PATCH', `${base}/${students.a.appId}`, { cookie: admin, body: { status: 'Shortlisted', adminNote: '@SUM(1) strong profile' } });
  ok(r.status === 200 && r.json.data.status === 'Shortlisted' && r.json.data.adminNote.startsWith('@SUM'), 'status + note saved');
  r = await call('PATCH', `${base}/${d2AppId}`, { cookie: admin, body: { status: 'Offered' } });
  ok(r.status === 404, 'application from another drive -> 404');
  ok((await Application.findById(d2AppId).lean()).status === 'Applied', 'other drive application untouched');
  r = await call('PATCH', `${base}/${students.b.appId}`, { cookie: admin, body: { status: 'Hired' } });
  ok(r.status === 400, 'invalid status -> 400');
  r = await call('PATCH', `${base}/${students.b.appId}`, { cookie: admin, body: {} });
  ok(r.status === 400, 'empty update -> 400');
  r = await call('PATCH', `${base}/${students.b.appId}`, { cookie: admin, body: { status: 'Offered', snapshot: { cgpa: 10 }, studentId: '507f1f77bcf86cd799439011' } });
  const bApp = await Application.findById(students.b.appId).lean();
  ok(r.status === 200 && bApp.snapshot.cgpa === 7.4 && bApp.studentId.toString() !== '507f1f77bcf86cd799439011', 'only status/note can change');
  r = await call('PATCH', `${base}/${students.b.appId}`, { cookie: admin, origin: `${TEST.APP}.evil.com`, body: { status: 'Rejected' } });
  ok(r.status === 403, 'lookalike origin -> 403');
  r = await call('GET', '/api/student/applications/summary', { cookie: students.a.cookie });
  ok(r.json.data.find((x) => x.driveId === d1._id).status === 'Shortlisted', 'student sees new status');
  r = await call('GET', '/api/student/applications', { cookie: students.a.cookie });
  ok(!r.text.includes('strong profile'), 'student never sees admin note');
  r = await call('GET', base, { cookie: admin });
  ok(r.json.stats.Shortlisted === 1 && r.json.stats.Offered === 1 && r.json.stats.Applied === 2, 'stats follow updates');

  console.log('# Bulk update');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: admin, body: { applicationIds: [students.c.appId, students.d.appId, d2AppId], status: 'Rejected' } });
  ok(r.status === 200 && r.json.matched === 2, 'bulk only touches this drive (2 of 3 ids)');
  ok((await Application.findById(d2AppId).lean()).status === 'Applied', 'cross-drive id ignored');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: admin, body: { applicationIds: Array(101).fill(students.c.appId), status: 'Rejected' } });
  ok(r.status === 400, '> 100 ids -> 400');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: admin, body: { applicationIds: ['nope'], status: 'Rejected' } });
  ok(r.status === 400, 'invalid id -> 400');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: admin, body: { applicationIds: [], status: 'Rejected' } });
  ok(r.status === 400, 'empty selection -> 400');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: admin, body: { applicationIds: [{ $ne: null }], status: 'Rejected' } });
  ok(r.status === 400, 'operator object in ids -> 400');
  r = await call('PATCH', `${base}/bulk-status`, { cookie: students.a.cookie, body: { applicationIds: [students.a.appId], status: 'Offered' } });
  ok(r.status === 403, 'student cannot bulk update');

  console.log('# Export');
  r = await call('GET', `${base}/export`, { cookie: admin, raw: true });
  ok(r.status === 200 && r.headers.get('content-type').includes('spreadsheetml'), 'xlsx content type');
  const cd = r.headers.get('content-disposition');
  ok(/^attachment; filename="applicants-[A-Za-z0-9-]+-\d{4}-\d{2}-\d{2}\.xlsx"$/.test(cd), 'safe server-built filename', cd);
  ok(r.headers.get('cache-control') === 'no-store', 'no-store cache header');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.buf);
  const ws = wb.getWorksheet('Applicants');
  const headers = ws.getRow(1).values.slice(1);
  ok(headers.includes('Hometown?') && headers.includes('Branch') && headers.includes('Admin Note'), 'headers include custom question', headers.join('|'));
  ok(ws.rowCount === 5, `4 data rows + header (${ws.rowCount})`);
  const col = (name) => headers.indexOf(name) + 1;
  let ashaRow;
  ws.eachRow((row, i) => { if (i > 1 && row.getCell(col('First Name')).value === 'Asha') ashaRow = row; });
  const coverCell = ashaRow.getCell(col('Note from Student'));
  ok(coverCell.type === ExcelJS.ValueType.String && coverCell.value === `'=HYPERLINK("http://evil.example","click me")`, 'formula-looking note is a quoted string, not a formula', `${coverCell.type} ${coverCell.value}`);
  ok(ashaRow.getCell(col('Hometown?')).value === "'+1+1" && ashaRow.getCell(col('Admin Note')).value.startsWith("'@SUM"), '+ and @ prefixes neutralised');
  let formulaCells = 0;
  ws.eachRow((row) => row.eachCell((c) => { if (c.type === ExcelJS.ValueType.Formula || c.formula) formulaCells++; }));
  ok(formulaCells === 0, 'no formula cells anywhere');
  ok(ashaRow.getCell(col('Branch')).value === 'Computer Engineering', 'branch exported as full name');
  ok(ashaRow.getCell(col('Applied At')).value instanceof Date, 'applied-at is a real date');
  r = await call('GET', `${base}/export?status=Rejected`, { cookie: admin, raw: true });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(r.buf);
  ok(wb2.getWorksheet('Applicants').rowCount === 3, 'export respects filters (2 rejected)');
  r = await call('GET', `${base}/export?branch=Nope`, { cookie: admin });
  ok(r.status === 400, 'invalid export filter -> 400');
  let last;
  for (let i = 0; i < 4; i++) last = await call('GET', `${base}/export`, { cookie: admin, raw: true });
  ok(last.status === 429, 'export rate limit (5 / 15 min) -> 429');

  console.log('# Bulk delete');
  r = await call('POST', `${base}/bulk-delete`, { cookie: students.a.cookie, body: { applicationIds: [students.a.appId] } });
  ok(r.status === 403, 'student cannot delete applications');
  for (const [ids, label] of [[[], 'empty selection'], [['nope'], 'invalid id'], [Array(101).fill(students.c.appId), '> 100 ids'], [[{ $ne: null }], 'operator object in ids']]) {
    r = await call('POST', `${base}/bulk-delete`, { cookie: admin, body: { applicationIds: ids } });
    ok(r.status === 400, `delete: ${label} -> 400`);
  }
  r = await call('POST', `${base}/bulk-delete`, { cookie: admin, body: { applicationIds: [students.c.appId, d2AppId] } });
  ok(r.status === 200 && r.json.deleted === 1, 'delete only touches this drive (1 of 2 ids)', r.text);
  ok(!(await Application.findById(students.c.appId).lean()) && Boolean(await Application.findById(d2AppId).lean()), 'record on this drive gone, cross-drive id kept');
  r = await call('GET', base, { cookie: admin });
  ok(r.json.pagination.total === 3, 'list shows 3 applicants after the delete');
  r = await call('POST', '/api/student/applications', { cookie: students.c.cookie, body: { driveId: d1._id, consentGiven: true, customAnswers: [{ promptId, answer: 'Anand' }] } });
  ok(r.status === 201, 'the student can apply again after their record is deleted', r.text.slice(0, 160));

  console.log('# Audit trail');
  const events = await mongoose.connection.collection('audit_events').find({ at: { $gte: suiteStart }, 'actor.type': 'staff' }).toArray();
  const actions = new Set(events.map((e) => e.action));
  ok(['applicants.export', 'applicants.bulkStatus', 'applicants.delete', 'applicant.update'].every((a) => actions.has(a)), `export, bulk actions, deletes and single updates stored (${[...actions].join(', ')})`);
  const log = fs.readFileSync(TEST.SERVER_LOG, 'utf8').split('\n').filter((l) => l.includes('[Audit]'));
  ok(!log.some((l) => /@example\.com|9000000001|Hometown/.test(l)) && !/@example\.com|9000000001|Hometown/.test(JSON.stringify(events)), 'audit trail free of PII');

  // cleanup
  await Application.deleteMany({ driveId: { $in: [d1._id, d2._id] } });
  await Placement.deleteMany({ _id: { $in: [d1._id, d2._id] } });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
