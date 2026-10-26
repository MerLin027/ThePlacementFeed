// Upgrade Phase 4 checks (Mongoose 9): indexes on a fresh DB match those Mongoose 8 built,
// the rewritten pre-validate hook, duplicate-key mapping, ObjectId handling, aggregation.
// Local stack only (API 5099, mongod 27099).
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `UP4${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const describe = (indexes) => indexes
  .map((i) => `${JSON.stringify(i.key)}${i.unique ? ' unique' : ''}${i.sparse ? ' sparse' : ''}${i.partialFilterExpression ? ' partial:' + JSON.stringify(i.partialFilterExpression) : ''}${i.collation ? ' collation:' + i.collation.locale + '/' + i.collation.strength : ''}`)
  .sort();

(async () => {
  console.log(`# mongoose ${mongoose.version}`);
  ok(/^9\./.test(mongoose.version), 'running Mongoose 9');

  console.log('# indexes: fresh DB (Mongoose 9) vs existing DB (built by Mongoose 8)');
  const old = await mongoose.createConnection(TEST.MONGODB_URI).asPromise();
  const freshName = `tpf_idx_${Date.now()}`;
  await mongoose.connect(TEST.dbUri(freshName));
  for (const M of [Placement, Student, Application, Admin]) {
    await M.init();
    const fresh = describe(await M.collection.indexes());
    // The site upgrade replaced { institute, rollNumber } with { rollNumber }; existing databases keep
    // the old index until the cleanup release (the previous code still needs it for a rollback)
    const before = describe(await old.db.collection(M.collection.collectionName).indexes())
      .filter((i) => i !== '{"institute":1,"rollNumber":1} unique');
    ok(JSON.stringify(fresh) === JSON.stringify(before), `${M.modelName}: ${fresh.length} indexes identical`, `\n    fresh:  ${fresh.join(' | ')}\n    before: ${before.join(' | ')}`);
    ok(!(await M.collection.indexes()).some((i) => 'background' in i), `${M.modelName}: no background option`);
  }

  console.log('# pre-validate hook (rewritten without next)');
  const bad = new Placement({ company: 'X', role: 'Y', type: 'Full-Time', deadline: new Date('2026-11-10'), driveDate: new Date('2026-11-01') });
  let err = null;
  try { await bad.validate(); } catch (e) { err = e; }
  ok(err && err.errors?.deadline?.message === 'Deadline cannot be after the drive date', 'deadline after drive date is rejected with the same message', err?.message);
  const good = new Placement({ company: 'X', role: 'Y', type: 'Full-Time', deadline: new Date('2026-11-01'), driveDate: new Date('2026-11-10') });
  let goodErr = null;
  try { await good.validate(); } catch (e) { goodErr = e; }
  ok(!goodErr?.errors?.deadline, 'deadline before drive date passes the hook', goodErr?.message);
  const sameDay = new Placement({ company: 'X', role: 'Y', type: 'Full-Time', deadline: new Date('2026-11-01'), driveDate: new Date('2026-11-01') });
  let sameErr = null;
  try { await sameDay.validate(); } catch (e) { sameErr = e; }
  ok(!sameErr?.errors?.deadline, 'deadline on drive day passes', sameErr?.message);
  const noDates = new Placement({ company: 'X', role: 'Y', type: 'Full-Time' });
  let ndErr = null;
  try { await noDates.validate(); } catch (e) { ndErr = e; }
  ok(!ndErr?.errors?.deadline, 'no dates: hook does not complain', ndErr?.message);

  console.log('# ObjectId handling');
  ok(mongoose.isValidObjectId('6ada6277149acdb15179ab43') && !mongoose.isValidObjectId('not-an-id') && !mongoose.isValidObjectId(123), 'isValidObjectId: strings ok, numbers rejected');
  await mongoose.disconnect();
  await old.close();
  // drop the scratch DB
  const tmp = await mongoose.createConnection(TEST.dbUri(freshName)).asPromise();
  await tmp.dropDatabase();
  await tmp.close();

  console.log('# through the API (server on Mongoose 9)');
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ username: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const H = { 'Content-Type': 'application/json', Origin: APP, Cookie: admin };
  const created = await (await fetch(API + '/api/placements', { method: 'POST', headers: H, body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 5, applicationMode: 'in_app', deadline: istDate(2), driveDate: istDate(5), eligibility: { branches: ['CE'] } }) })).json();
  ok(created.success && created.data.status === 'Upcoming', 'create drive, auto status computed', JSON.stringify(created).slice(0, 150));
  const id = created.data._id;
  // Edit so the deadline lands after the drive date — must hit the model hook (via doc.save)
  const put = await fetch(API + `/api/placements/${id}`, { method: 'PUT', headers: H, body: JSON.stringify({ company: `${TAG} Corp`, role: 'Eng', type: 'Full-Time', ctc: 5, applicationMode: 'in_app', deadline: istDate(9), driveDate: istDate(5), eligibility: { branches: ['CE'] } }) });
  const putJson = await put.json();
  ok(put.status === 400 && JSON.stringify(putJson).includes('Deadline cannot be after the drive date'), `PUT with deadline after drive date → ${put.status} with the message`, JSON.stringify(putJson).slice(0, 200));
  const email = `${TAG.toLowerCase()}@example.com`;
  const sign = (roll) => fetch(API + '/api/students/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: roll, password: 'goodpass123' }) });
  const s1 = await sign(`${TAG}A`);
  ok(s1.status === 201 || s1.status === 200, `signup → ${s1.status}`);
  const s2 = await sign(`${TAG}B`);
  const s2j = await s2.json();
  ok(s2.status === 409, `duplicate email → ${s2.status} (unique index mapping)`, JSON.stringify(s2j));
  const sc = s1.headers.getSetCookie().find((c) => c.startsWith('student_token=')).split(';')[0];
  await fetch(API + '/api/students/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ firstName: 'U', lastName: 'Four', branch: 'CE', cgpa: 7, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/r.pdf' }) });
  await chooseInstitute(sc);
  const a1 = await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ driveId: id, consentGiven: true }) });
  const a2 = await fetch(API + '/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP, Cookie: sc }, body: JSON.stringify({ driveId: id, consentGiven: true }) });
  ok(a1.status === 201 && a2.status === 409, `apply once (${a1.status}), twice → ${a2.status}`);
  const bad1 = await fetch(API + '/api/placements/123');
  ok(bad1.status === 400, `numeric id → ${bad1.status}`);
  const bad2 = await fetch(API + '/api/placements/ffffffffffffffffffffffff');
  ok(bad2.status === 404, `unknown valid id → ${bad2.status}`);
  const cs = await (await fetch(API + '/api/placements?sort=closing_soon&limit=50')).json();
  ok(cs.success && cs.data.some((d) => d._id === id), 'closing_soon aggregation returns the new drive');
  const cron = await fetch(API + '/api/cron/trigger', { headers: { Authorization: `Bearer ${TEST.CRON_SECRET}` } });
  ok(cron.status === 200, 'cron job runs (conditional updateOne)');
  const ch = await (await fetch(API + `/api/placements/changes?since=${encodeURIComponent(new Date(Date.now() - 60e3).toISOString())}`)).json();
  ok(ch.success && Array.isArray(ch.data) && typeof ch.serverTime === 'string', 'changes feed with serverTime');
  const del = await fetch(API + `/api/placements/${id}`, { method: 'DELETE', headers: H });
  ok(del.status === 200, 'delete drive (cascade)');
  await mongoose.connect(TEST.MONGODB_URI);
  ok((await Application.countDocuments({ driveId: id })) === 0, 'applications removed with the drive');
  await Student.deleteMany({ email });
  await mongoose.disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
