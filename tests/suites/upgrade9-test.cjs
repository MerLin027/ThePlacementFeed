// Upgrade Phase 9 checks (Node 24 runtime): the riskiest code paths — Excel export round-trip through
// exceljs/archiver (oldest deps in the tree) incl. formula-injection escaping; a production-mode boot
// (cookie flags, no warnings); resetAdmin from the project root. Local stack only (API 5099, mongod 27099).
const TEST = require('../lib/env.cjs');
const { until } = require('../lib/wait.cjs');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const SERVER = TEST.SERVER;
const ROOT = TEST.ROOT;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const ExcelJS = require(path.join(SERVER, 'node_modules/exceljs'));
const Placement = require(path.join(SERVER, 'models/Placement'));
const Student = require(path.join(SERVER, 'models/Student'));
const Application = require(path.join(SERVER, 'models/Application'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `UP9${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (cookie) => ({ 'Content-Type': 'application/json', Origin: APP, ...(cookie ? { Cookie: cookie } : {}) });

(async () => {
  console.log(`# node ${process.version}`);
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const drive = (await (await fetch(API + '/api/placements', { method: 'POST', headers: J(admin), body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 9, applicationMode: 'in_app', deadline: istDate(3), driveDate: istDate(7), eligibility: { branches: ['CE', 'IT'] }, customPrompts: [{ question: 'Relocate?', required: true }] }) })).json()).data;
  const promptId = drive.customPrompts[0]._id;

  const students = [
    { email: `${TAG.toLowerCase()}a@example.com`, roll: `${TAG}A`, first: 'Asha', branch: 'CE', cgpa: 8.4, note: '=HYPERLINK("http://evil.example","click")', answer: '@SUM(1,2)' },
    { email: `${TAG.toLowerCase()}b@example.com`, roll: `${TAG}B`, first: 'Bina', branch: 'IT', cgpa: 7.1, note: 'Plain note', answer: 'Yes' },
  ];
  const appIds = [];
  for (const s of students) {
    const r = await fetch(API + '/api/students/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email: s.email, rollNumber: s.roll, password: 'goodpass123' }) });
    const c = r.headers.getSetCookie().find((x) => x.startsWith('student_token=')).split(';')[0];
    await fetch(API + '/api/students/me', { method: 'PATCH', headers: J(c), body: JSON.stringify({ firstName: s.first, lastName: 'Test', branch: s.branch, cgpa: s.cgpa, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/r.pdf' }) });
    const a = await (await fetch(API + '/api/applications', { method: 'POST', headers: J(c), body: JSON.stringify({ driveId: drive._id, consentGiven: true, coverNote: s.note, customAnswers: [{ promptId, answer: s.answer }] }) })).json();
    appIds.push(a.data?._id || a.data?.id);
  }
  ok(appIds.every(Boolean), 'setup: two applications created');
  const note = await fetch(API + `/api/placements/${drive._id}/applicants/${appIds[0]}`, { method: 'PATCH', headers: J(admin), body: JSON.stringify({ status: 'Shortlisted', adminNote: '+1 strong' }) });
  ok(note.status === 200, `admin note + status update → ${note.status}`);

  console.log('# Excel export round-trip (exceljs → archiver/zip streams)');
  const ex = await fetch(API + `/api/placements/${drive._id}/applicants/export`, { headers: { Origin: APP, Cookie: admin } });
  const buf = Buffer.from(await ex.arrayBuffer());
  ok(ex.status === 200 && /spreadsheetml/.test(ex.headers.get('content-type')), `export → ${ex.status} ${ex.headers.get('content-type')}`);
  ok(/attachment; filename="applicants-UP9\d+-Corp-\d{4}-\d{2}-\d{2}\.xlsx"/.test(ex.headers.get('content-disposition') || ''), 'safe attachment filename', ex.headers.get('content-disposition'));
  ok(buf.length > 2000 && buf.subarray(0, 2).toString() === 'PK', `valid zip container (${buf.length} bytes)`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.getWorksheet('Applicants');
  ok(Boolean(sheet), 'sheet "Applicants" present');
  const header = sheet.getRow(1).values.slice(1);
  ok(header[0] === 'First Name' && header.includes('Relocate?') && header[header.length - 1] === 'Admin Note' && sheet.getRow(1).font?.bold, 'header row incl. custom prompt column, bold', JSON.stringify(header));
  ok(sheet.actualRowCount === 3, `header + 2 applicant rows (${sheet.actualRowCount})`);
  const rows = [2, 3].map((n) => { const r = sheet.getRow(n); return Object.fromEntries(header.map((h, i) => [h, r.getCell(i + 1)])); });
  const asha = rows.find((r) => r['First Name'].value === 'Asha');
  const bina = rows.find((r) => r['First Name'].value === 'Bina');
  ok(asha && bina, 'both applicants exported');
  ok(asha['Note from Student'].value === `'${students[0].note}` && asha['Note from Student'].type !== ExcelJS.ValueType.Formula, 'formula in cover note escaped with a leading quote, stored as text', JSON.stringify(asha['Note from Student'].value));
  ok(asha['Relocate?'].value === `'${students[0].answer}`, '@-formula in custom answer escaped', JSON.stringify(asha['Relocate?'].value));
  ok(asha['Admin Note'].value === "'+1 strong", '+-formula in admin note escaped', JSON.stringify(asha['Admin Note'].value));
  ok(!rows.some((r) => Object.values(r).some((c) => c.type === ExcelJS.ValueType.Formula)), 'no formula cells anywhere');
  ok(asha.Branch.value === 'Computer Engineering' && bina.Branch.value === 'Information Technology', 'branch exported by full name');
  ok(asha.CGPA.value === 8.4 && typeof bina.CGPA.value === 'number', 'CGPA exported as a number');
  ok(asha['Applied At'].value instanceof Date && asha['Applied At'].numFmt === 'dd mmm yyyy hh:mm', 'Applied At is a date with the dd mmm yyyy format', String(asha['Applied At'].numFmt));
  ok(asha.Status.value === 'Shortlisted' && bina['Note from Student'].value === 'Plain note', 'status and plain text unchanged');
  const fx = await fetch(API + `/api/placements/${drive._id}/applicants/export?status=Shortlisted`, { headers: { Origin: APP, Cookie: admin } });
  const fwb = new ExcelJS.Workbook();
  await fwb.xlsx.load(Buffer.from(await fx.arrayBuffer()));
  ok(fwb.getWorksheet('Applicants').actualRowCount === 2, 'filtered export (status=Shortlisted) has 1 row');

  console.log('# production-mode boot on this Node (cwd without .env, local DB only)');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, MONGODB_URI: TEST.MONGODB_URI, JWT_SECRET: 'test-secret-0123456789abcdef0123456789', COOKIE_SECRET: 'test-cookie-0123456789abcdef0123456', CLIENT_URL: 'https://client.example.test', NODE_ENV: 'production', PORT: '5098', ADMIN_USERNAME: 'testadmin', ADMIN_PASSWORD: 'testadminpass', NODE_OPTIONS: '--trace-deprecation' };
  const srv = spawn(process.execPath, [path.join(SERVER, 'index.js')], { cwd: TEST.OUT, env });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  const up = await until(async () => (await fetch('http://localhost:5098/api/health')).status === 200, { every: 250 });
  ok(up, 'production server answers /api/health', log.slice(-300));
  const pl = await fetch('http://localhost:5098/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://client.example.test' }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const ck = pl.headers.getSetCookie().find((c) => c.startsWith('admin_token=')) || '';
  ok(pl.status === 200 && /HttpOnly/i.test(ck) && /Secure/i.test(ck) && /SameSite=None/i.test(ck), 'prod cookie is HttpOnly; Secure; SameSite=None', ck.replace(/=[^;]+/, '=…'));
  const bad = await fetch('http://localhost:5098/api/placements/not-an-id');
  const badText = await bad.text();
  ok(bad.status === 400 && !/stack|\bat /.test(badText), 'prod error response has no stack trace');
  const csrf = await fetch('http://localhost:5098/api/auth/logout', { method: 'POST', headers: { Origin: 'https://evil.example.test' } });
  ok(csrf.status === 403, `prod CSRF check rejects a foreign origin → ${csrf.status}`);
  await wait(500); // deliberate: lets late warnings reach the log before it is checked
  srv.kill();
  ok(!/DeprecationWarning|ExperimentalWarning|\[MONGOOSE\] Warning|\(node:\d+\)/.test(log), 'no runtime warnings in the production boot log', (log.match(/.*(Warning|\(node:).*/) || [''])[0]);
  ok(!/injecting env|dotenv/.test(log), 'no dotenv banner');

  console.log('# resetAdmin from the project root (prompt only, stdin closed, no DB contact)');
  const ra = spawn(process.execPath, ['server/scripts/resetAdmin.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let raOut = '';
  ra.stdout.on('data', (d) => { raOut += d; });
  ra.stderr.on('data', (d) => { raOut += d; });
  const raCode = await new Promise((r) => ra.on('close', r));
  ok(/Enter new admin username/.test(raOut) && !/FATAL/.test(raOut), 'resetAdmin finds server/.env from the project root and prompts', raOut.trim());
  ok(raCode === 0, `resetAdmin exits cleanly (${raCode})`);

  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email: { $in: students.map((s) => s.email) } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
