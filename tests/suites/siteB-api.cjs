// Site upgrade, part B — admin Students and Applicants filters and sorts on a fixture where every
// filter has a known answer; validation of the new params; export returns the filtered rows.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
// The server writes exports with write-excel-file; the tests read them back with exceljs
const ExcelJS = require('exceljs');
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
  return { status: res.status, json, setCookie: res.headers.getSetCookie() };
};
const cookieOf = (r, name) => (r.setCookie.find((c) => c.startsWith(name + '=')) || '').split(';')[0];
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const TAG = `sb${Date.now() % 1000000}`;
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  let r = await call('POST', '/api/auth/login', { body: { username: 'testadmin', password: 'testadminpass' } });
  const admin = cookieOf(r, 'admin_token');
  const instB = (await call('POST', '/api/admin/catalog/institutes', { cookie: admin, body: { name: `${TAG} Beta` } })).json.data;

  // Fixture: five students with known attributes
  const base = { firstName: 'S', lastName: 'Test', phone: '9876543210', resumeUrl: 'https://example.com/r.pdf' };
  const specs = {
    a: { ...base, firstName: 'Aditi', branch: 'CE', cgpa: 8.5, activeBacklogs: 0, graduationYear: 2026, institute: 'test' },
    b: { ...base, firstName: 'Bharat', branch: 'IT', cgpa: 6.9, activeBacklogs: 2, graduationYear: 2027, institute: 'beta' },
    c: { ...base, firstName: 'Chirag', branch: 'CE', cgpa: 7.4, activeBacklogs: 1, graduationYear: 2027, institute: null }, // no institute
    d: { firstName: 'Diya', branch: 'EC', graduationYear: 2026, institute: 'test' }, // incomplete
    e: { ...base, firstName: 'Esha', branch: 'IT', cgpa: 9.1, activeBacklogs: 0, graduationYear: 2028, institute: 'test' },
  };
  const S = {};
  for (const [k, spec] of Object.entries(specs)) {
    const email = `${TAG}_${k}@example.com`;
    const rr = await call('POST', '/api/students/auth/signup', { body: { email, rollNumber: `${TAG}${k}`.toUpperCase(), password: 'origpass123' } });
    const cookie = cookieOf(rr, 'student_token');
    const { institute, ...profile } = spec;
    await call('PATCH', '/api/students/me', { cookie, body: profile });
    if (institute === 'test') await chooseInstitute(cookie);
    if (institute === 'beta') await call('PUT', '/api/students/me/institute', { cookie, body: { instituteId: instB.id } });
    S[k] = { cookie, id: (await Student.findOne({ email }).lean())._id.toString() };
  }
  await Student.updateOne({ _id: S.e.id }, { $set: { mustChangePassword: true } });
  const drive = await Placement.create({ company: `${TAG} Corp`, role: 'SDE', type: 'Full-Time', ctc: 10, applicationMode: 'in_app', deadline: new Date(istDate(10)), driveDate: new Date(istDate(12)) });
  // a, b and c (after picking an institute for the application) apply; statuses: a Offered, b Shortlisted
  await chooseInstitute(S.c.cookie);
  for (const k of ['a', 'b', 'c']) {
    r = await call('POST', '/api/applications', { cookie: S[k].cookie, body: { driveId: drive._id, consentGiven: true } });
    ok(r.status === 201, `${k} applied`, JSON.stringify(r.json));
  }
  await Application.updateOne({ driveId: drive._id, studentId: S.a.id }, { $set: { status: 'Offered' } });
  await Application.updateOne({ driveId: drive._id, studentId: S.b.id }, { $set: { status: 'Shortlisted' } });
  // c's institute is reset afterwards, so the account has none but the application keeps the name
  await call('POST', `/api/admin/students/${S.c.id}/reset-institute`, { cookie: admin });
  // Backdate b's application by 5 days for the date filter
  await Application.collection.updateOne({ driveId: drive._id, studentId: new mongoose.Types.ObjectId(S.b.id) }, { $set: { createdAt: new Date(Date.now() - 5 * 86400e3) } }); // raw: createdAt is immutable in Mongoose

  const students = async (qs) => {
    const res = await call('GET', `/api/admin/students?search=${TAG}&limit=100&${qs}`, { cookie: admin });
    return { status: res.status, names: (res.json.data || []).map((s) => s.firstName), json: res.json };
  };

  console.log('# Students filters');
  let x = await students('');
  ok(x.status === 200 && x.names.length === 5, 'fixture: 5 students');
  const aRow = x.json.data.find((s) => s.firstName === 'Aditi');
  ok(aRow.profileComplete === true && aRow.applications === 1 && aRow.selected === true, 'row has profile state and application counts');
  ok(x.json.data.find((s) => s.firstName === 'Diya').profileComplete === false, 'incomplete profile flagged');
  const checks = [
    ['branch=CE', ['Aditi', 'Chirag']],
    ['branch=__none', []],
    [`institute=${instB.id}`, ['Bharat']],
    ['institute=__none', ['Chirag']],
    ['gradYear=2027', ['Bharat', 'Chirag']],
    ['gradYear=2026,2028', ['Aditi', 'Diya', 'Esha']],
    ['profile=complete', ['Aditi', 'Bharat', 'Esha']],
    ['profile=incomplete', ['Chirag', 'Diya']],
    ['profile=no_institute', ['Chirag']],
    ['cgpaMin=7&cgpaMax=9', ['Aditi', 'Chirag']],
    ['backlogsMax=0', ['Aditi', 'Diya', 'Esha']], // Diya never entered any: the default is 0
    ['account=reset_pending', ['Esha']],
    ['applications=applied', ['Aditi', 'Bharat', 'Chirag']],
    ['applications=never', ['Diya', 'Esha']],
    ['applications=selected', ['Aditi']],
    ['branch=IT&gradYear=2027&backlogsMax=2', ['Bharat']],
  ];
  for (const [qs, expected] of checks) {
    x = await students(qs);
    ok(x.status === 200 && sameSet(x.names, expected), `students ${qs} -> ${expected.join(', ') || 'none'}`, `got ${x.names.join(', ')}`);
  }
  x = await students('sort=cgpa_desc');
  ok(x.names.join() === 'Esha,Aditi,Chirag,Bharat,Diya', 'sort cgpa_desc (missing CGPA last)', x.names.join());
  x = await students('sort=grad_desc');
  ok(x.names[0] === 'Esha', 'sort grad_desc', x.names.join());

  console.log('# Students validation');
  for (const qs of ['gradYear=1999', 'gradYear=2026,', 'institute=nope', 'profile=weird', 'applications=some', 'backlogsMax=-1', 'cgpaMin=11', 'sort=random', 'branch=NOPE9']) {
    r = await call('GET', `/api/admin/students?${qs}`, { cookie: admin });
    ok(r.status === 400, `students ${qs} -> 400`);
  }
  r = await call('GET', '/api/admin/students?gradYear=2026&gradYear=2027', { cookie: admin });
  ok(r.status === 400, 'repeated key -> 400');

  const applicants = async (qs) => {
    const res = await call('GET', `/api/placements/${drive._id}/applicants?limit=100&${qs}`, { cookie: admin });
    return { status: res.status, names: (res.json.data || []).map((a) => a.snapshot.firstName), json: res.json };
  };

  console.log('# Applicants filters');
  x = await applicants('');
  ok(x.status === 200 && x.names.length === 3, 'fixture: 3 applicants');
  ok(sameSet(x.json.facets.institutes, ['Test Institute', `${TAG} Beta`]) && sameSet(x.json.facets.gradYears.map(String), ['2026', '2027']), 'facets list institutes and years on this drive', JSON.stringify(x.json.facets));
  const appChecks = [
    ['status=Offered,Shortlisted', ['Aditi', 'Bharat']],
    ['status=Applied', ['Chirag']],
    [`institute=${encodeURIComponent(`${TAG} Beta`)}`, ['Bharat']],
    ['institute=Test%20Institute', ['Aditi', 'Chirag']],
    ['gradYear=2027', ['Bharat', 'Chirag']],
    ['backlogsMax=1', ['Aditi', 'Chirag']],
    [`appliedFrom=${istDate(-2)}`, ['Aditi', 'Chirag']],
    [`appliedTo=${istDate(-3)}`, ['Bharat']],
    [`appliedFrom=${istDate(-6)}&appliedTo=${istDate(0)}`, ['Aditi', 'Bharat', 'Chirag']],
    ['account=active', ['Aditi', 'Bharat', 'Chirag']],
    ['account=deleted', []],
    ['cgpaMin=7&branch=CE', ['Aditi', 'Chirag']],
  ];
  for (const [qs, expected] of appChecks) {
    x = await applicants(qs);
    ok(x.status === 200 && sameSet(x.names, expected), `applicants ${qs} -> ${expected.join(', ') || 'none'}`, `got ${x.names.join(', ')}`);
  }
  x = await applicants('sort=status');
  ok(x.names.join() === 'Chirag,Bharat,Aditi', 'sort by pipeline order (Applied, Shortlisted, Offered)', x.names.join());
  x = await applicants('sort=status&limit=1&page=2');
  r = await call('GET', `/api/placements/${drive._id}/applicants?sort=status&limit=1&page=2`, { cookie: admin });
  ok(r.json.data.length === 1 && r.json.data[0].snapshot.firstName === 'Bharat' && r.json.pagination.total === 3, 'pipeline sort pages correctly');
  x = await applicants('sort=branch');
  ok(x.names[x.names.length - 1] === 'Bharat', 'sort by branch', x.names.join());

  console.log('# Applicants validation');
  for (const qs of ['status=Bogus', 'status=Applied,Bogus', 'appliedFrom=yesterday', 'appliedTo=2026-13-45', 'account=gone', 'gradYear=20x6', 'sort=random', `institute=${'x'.repeat(121)}`]) {
    r = await call('GET', `/api/placements/${drive._id}/applicants?${qs}`, { cookie: admin });
    ok(r.status === 400, `applicants ${qs.slice(0, 40)} -> 400`);
  }

  console.log('# Export follows the filters');
  const exportRolls = async (qs) => {
    const res = await fetch(`${API}/api/placements/${drive._id}/applicants/export?${qs}`, { headers: { Cookie: admin, Origin: ORIGIN } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const sheet = wb.getWorksheet('Applicants');
    const header = sheet.getRow(1).values;
    const col = header.indexOf('First Name');
    const out = [];
    sheet.eachRow((row, n) => { if (n > 1) out.push(row.getCell(col).value); });
    return { status: res.status, names: out, header };
  };
  let ex = await exportRolls('status=Offered,Shortlisted&sort=status');
  ok(ex.status === 200 && ex.names.join() === 'Bharat,Aditi', 'export: same rows and order as the filtered list', ex.names.join());
  ok(ex.header.includes('Institute'), 'export has an Institute column');
  ex = await exportRolls(`appliedTo=${istDate(-3)}`);
  ok(ex.names.join() === 'Bharat', 'export: date filter');

  console.log('# Joined, answers and per-drive insights');
  // Bharat signed up 10 days ago; Aditi wrote a note; Aditi answered the drive's one question
  await Student.collection.updateOne({ _id: new mongoose.Types.ObjectId(S.b.id) }, { $set: { createdAt: new Date(Date.now() - 10 * 86400e3) } });
  x = await students(`joinedTo=${istDate(-5)}`);
  ok(x.status === 200 && x.names.join() === 'Bharat', 'students joinedTo', x.names.join());
  x = await students(`joinedFrom=${istDate(-1)}`);
  ok(sameSet(x.names, ['Aditi', 'Chirag', 'Diya', 'Esha']), 'students joinedFrom', x.names.join());
  r = await call('GET', '/api/admin/students?joinedFrom=last-week', { cookie: admin });
  ok(r.status === 400, 'bad joinedFrom -> 400');
  await Placement.collection.updateOne({ _id: drive._id }, { $set: { customPrompts: [{ _id: new mongoose.Types.ObjectId(), question: 'Why us?', required: false }] } });
  await Application.collection.updateOne({ driveId: drive._id, studentId: new mongoose.Types.ObjectId(S.a.id) }, { $set: { coverNote: 'Keen', customAnswers: [{ question: 'Why us?', answer: 'Because' }] } });
  x = await applicants('answers=note');
  ok(x.names.join() === 'Aditi', 'applicants answers=note', x.names.join());
  x = await applicants('answers=all_questions');
  ok(x.names.join() === 'Aditi', 'applicants answers=all_questions', x.names.join());
  ok(x.json.drive.promptCount === 1, 'list reports the drive\'s question count');
  r = await call('GET', `/api/placements/${drive._id}/applicants?answers=maybe`, { cookie: admin });
  ok(r.status === 400, 'bad answers -> 400');
  r = await call('GET', `/api/placements/${drive._id}/applicants/insights`);
  ok(r.status === 401, 'drive insights without a session -> 401');
  r = await call('GET', `/api/placements/${drive._id}/applicants/insights`, { cookie: admin });
  const di = r.json.data;
  const bucket = (label) => di.cgpa.find((b) => b.bucket === label)?.applicants;
  ok(r.status === 200 && di.cgpa.length === 9 && bucket('Below 6') === 0 && bucket('6.5–7') === 1 && bucket('7–7.5') === 1 && bucket('8.5–9') === 1, 'CGPA buckets (6.9, 7.4, 8.5)', JSON.stringify(di.cgpa));
  const ce = di.branches.find((b) => b.code === 'CE');
  ok(ce && ce.applications === 2 && ce.selected === 1 && di.branches.find((b) => b.code === 'IT')?.applications === 1, 'branch split with selections', JSON.stringify(di.branches));

  console.log('# Dashboard insights');
  r = await call('GET', '/api/admin/insights');
  ok(r.status === 401, 'insights without a session -> 401');
  r = await call('GET', '/api/admin/insights', { cookie: S.a.cookie });
  ok(r.status === 401, 'insights with a student session -> 401');
  r = await call('GET', '/api/admin/insights?weeks=3', { cookie: admin });
  ok(r.status === 400, 'weeks below 4 -> 400');
  r = await call('GET', '/api/admin/insights', { cookie: admin });
  const ins = r.json.data;
  ok(r.status === 200 && ins.kpis && ins.pipeline && Array.isArray(ins.weekly), 'insights shape');
  const pipelineSum = Object.values(ins.pipeline).reduce((t, n) => t + n, 0);
  ok(pipelineSum === ins.kpis.applications && ins.kpis.applications === (await Application.countDocuments()), 'pipeline adds up to all applications', `${pipelineSum} vs ${ins.kpis.applications}`);
  ok(ins.kpis.selected === ins.pipeline.Offered && ins.kpis.studentsPlaced === (await Application.distinct('studentId', { status: 'Offered' })).length, 'selected and placed counts');
  ok(ins.weekly.length === 12 && ins.weekly.every((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.weekStart) && new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() === 1), '12 weeks, each starting on a Monday (IST)');
  ok(ins.weekly[ins.weekly.length - 1].applications >= 2, 'this week includes the fixture applications');
  const ourDrive = ins.topDrives.find((d) => d.id === drive._id.toString());
  ok(!ourDrive || (ourDrive.total === 3 && ourDrive.statuses.Offered === 1 && ourDrive.statuses.Shortlisted === 1), 'per-drive split by status');
  r = await call('GET', '/api/admin/insights?weeks=26', { cookie: admin });
  ok(r.status === 200 && r.json.data.weekly.length === 26, 'weeks=26 -> 26 buckets');

  // cleanup
  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $regex: `^${TAG}` } });
  await call('DELETE', `/api/admin/catalog/institutes/${instB.id}?force=true`, { cookie: admin });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
