// Upgrade Phase 3 checks (Express 5): empty/odd bodies never 500, NoSQL-injection still blocked,
// validated query values still coerced, sanitiser still strips $-keys in-process, 404/error shape.
// Local stack only (API 5099, mongod 27099). Run on Express 4 first, then 5, to compare.
const TEST = require('../lib/env.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const path = require('path');
const fs = require('fs');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const API = TEST.API;
const APP = TEST.APP;
const TAG = `UP3${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

const req = async (method, url, { cookie, body, raw, type } = {}) => {
  const headers = { Origin: APP };
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (raw !== undefined) { payload = raw; headers['Content-Type'] = type || 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const r = await fetch(API + url, { method, headers, body: payload });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, json, text, headers: r.headers };
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
  const admin = login.headers.getSetCookie()[0].split(';')[0];
  const drive = (await req('POST', '/api/admin/drives', { cookie: admin, body: { company: `${TAG} Corp`, role: 'Engineer', type: 'Full-Time', ctc: 6, applicationMode: 'in_app', deadline: istDate(3), driveDate: istDate(8), eligibility: { branches: ['CE'] }, tags: [] } })).json.data;
  const email = `${TAG.toLowerCase()}@example.com`;
  const s = await fetch(API + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: APP }, body: JSON.stringify({ email, rollNumber: `${TAG}S`, password: 'goodpass123' }) });
  const student = s.headers.getSetCookie().find((c) => c.startsWith('tpf_session=')).split(';')[0];
  await req('PATCH', '/api/student/profile', { cookie: student, body: { firstName: 'Up', lastName: 'Three', branch: 'CE', cgpa: 8, graduationYear: 2026, phone: '9876543210', resumeUrl: 'https://example.com/r.pdf' } });
  await chooseInstitute(student);
  const created = (await req('POST', '/api/student/applications', { cookie: student, body: { driveId: drive._id, consentGiven: true } })).json;
  const appId = created?.data?._id || created?.data?.id;
  ok(Boolean(appId), 'setup: application created', JSON.stringify(created).slice(0, 150));

  console.log('# empty and odd bodies never cause a 500');
  const noBody = [
    ['POST', '/api/auth/login', null],
    ['POST', '/api/auth/login', null],
    ['POST', '/api/auth/signup', null],
    ['PATCH', '/api/student/profile', student],
    ['POST', '/api/auth/password', student],
    ['POST', '/api/student/applications', student],
    ['POST', '/api/admin/drives', admin],
    ['PUT', `/api/admin/drives/${drive._id}`, admin],
    ['PATCH', `/api/admin/drives/${drive._id}/postpone`, admin],
    ['PATCH', `/api/admin/drives/${drive._id}/status-automation`, admin],
    ['PATCH', `/api/admin/drives/${drive._id}/applicants/bulk-status`, admin],
    ['POST', `/api/admin/drives/${drive._id}/applicants/bulk-delete`, admin],
    ['PATCH', `/api/admin/drives/${drive._id}/applicants/${appId}`, admin],
  ];
  for (const [m, u, c] of noBody) {
    const r = await req(m, u, { cookie: c || undefined });
    const label = u.replace(drive._id, ':id').replace(String(appId), ':appId');
    ok(r.status >= 200 && r.status < 500 && r.json && r.json.success !== undefined, `${m} ${label} with no body → ${r.status}`, r.text.slice(0, 120));
  }
  const plain = await req('POST', '/api/admin/drives', { cookie: admin, raw: 'company=x', type: 'text/plain' });
  ok(plain.status === 415 && plain.json?.code === 'UNSUPPORTED_MEDIA_TYPE', 'text/plain body → 415 (JSON only)', `${plain.status} ${plain.text.slice(0, 100)}`);
  const formPost = await req('POST', '/api/admin/drives', { cookie: admin, raw: 'company=x', type: 'application/x-www-form-urlencoded' });
  ok(formPost.status === 415, 'form-encoded body → 415 (no HTML form can post to the API)', `${formPost.status} ${formPost.text.slice(0, 100)}`);
  const bad = await req('POST', '/api/admin/drives', { cookie: admin, raw: '{"company": ' });
  ok(bad.status === 400 && !/\bat |node_modules/.test(bad.text), 'malformed JSON → 400, no stack', `${bad.status} ${bad.text.slice(0, 100)}`);
  ok(bad.json?.code === 'INVALID_JSON' && !/Unexpected|position/.test(bad.text), 'malformed JSON → no parser message echoed', bad.text.slice(0, 100));
  const unknown = await req('GET', '/api/nope-at-all');
  ok(unknown.status === 404 && unknown.json?.code === 'NOT_FOUND', 'unknown API route → JSON 404', unknown.text.slice(0, 80));
  const repeated = await req('GET', '/api/drives?page=1&page=2');
  ok(repeated.status === 400 && repeated.json?.code === 'INVALID_QUERY', 'repeated query key → 400', repeated.text.slice(0, 80));

  console.log('# NoSQL injection is still blocked');
  const a1 = await req('POST', '/api/auth/login', { body: { username: { $ne: null }, password: { $ne: null } } });
  ok(a1.status !== 200 && a1.status < 500, `admin login with operator objects → ${a1.status}`);
  const a2 = await req('POST', '/api/auth/login', { body: { email: { $gt: '' }, password: 'x' } });
  ok(a2.status !== 200 && a2.status < 500, `student login with operator email → ${a2.status}`);
  const allCount = (await req('GET', '/api/drives?limit=100')).json?.pagination?.total;
  for (const q of ['branch=CE&branch=IT', 'search=a&search=b', 'branch[$ne]=zzz','search[$regex]=.*', 'status[$ne]=Upcoming', 'ctcMin[$gt]=0', 'sort[$ne]=x']) {
    const r = await req('GET', `/api/drives?${q}`);
    ok(r.status < 500, `GET placements ?${q} → ${r.status} (no 500)`, r.text.slice(0, 120));
  }
  const ch = await req('GET', '/api/drives/changes?since[$gt]=');
  ok(ch.status < 500, `GET changes ?since[$gt]= → ${ch.status} (no 500)`, ch.text.slice(0, 120));
  for (const [u, c] of [['/api/drives?status[$ne]=x', null], ['/api/drives/changes?since[$gt]=', null], ['/api/admin/students?search[$ne]=x', admin], ['/api/student/applications?page[$gt]=0', student]]) {
    const r = await req('GET', u, { cookie: c || undefined });
    ok(r.status === 400 && r.json?.success === false, `bracketed query key rejected: ${u.split('?')[1]} → ${r.status}`, r.text.slice(0, 100));
  }
  const ninj = await req('GET', '/api/drives?branch[$ne]=zzz&limit=100');
  ok(ninj.status !== 200 || ninj.json.pagination.total <= allCount, 'operator in query never widens results');
  const s1 = await req('GET', '/api/admin/students?search[$ne]=x', { cookie: admin });
  ok(s1.status < 500, `admin students ?search[$ne] → ${s1.status}`);
  const s2 = await req('GET', `/api/admin/drives/${drive._id}/applicants?status[$ne]=x`, { cookie: admin });
  ok(s2.status < 500, `applicants ?status[$ne] → ${s2.status}`);
  const p1 = await req('PATCH', '/api/student/profile', { cookie: student, body: { branch: { $ne: 'x' } } });
  ok(p1.status === 400, `profile branch as operator object → ${p1.status}`);
  const p2 = await req('PUT', `/api/admin/drives/${drive._id}`, { cookie: admin, body: { company: { $gt: '' }, role: 'x' } });
  ok(p2.status === 400, `placement company as operator object → ${p2.status}`);
  const stillThere = await Student.findOne({ email }).lean();
  ok(stillThere && stillThere.branch === 'CE', 'profile unchanged by injection attempts');

  console.log('# sanitiser in-process (same express as the server)');
  const express = require(path.join(SERVER, 'node_modules/express'));
  const sanitizeRequest = require(path.join(SERVER, 'src/middleware/sanitize'));
  const probe = express();
  probe.use(express.json());
  probe.use(express.urlencoded({ extended: true }));
  probe.use(sanitizeRequest);
  probe.use((rq, _rs, n) => { rq.query.marker = 42; n(); }); // a later middleware's change must persist
  probe.all('/p', (rq, rs) => rs.json({ body: rq.body, query: rq.query, marker: rq.query.marker }));
  probe.use((err, rq, rs, _n) => rs.status(500).json({ error: err.message }));
  const srv = probe.listen(0);
  const port = srv.address().port;
  const pr = await fetch(`http://127.0.0.1:${port}/p?%24where=1&b.c=2&ok=1`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: { $gt: '' }, 'y.z': 1, keep: 'v', nested: { $where: '1', fine: 2 } }) });
  const pj = await pr.json();
  srv.close();
  ok(pr.status === 200, `sanitiser does not crash (${pr.status})`, JSON.stringify(pj));
  ok(pj.body && !JSON.stringify(pj.body).includes('$') && !('y.z' in pj.body) && pj.body.keep === 'v' && pj.body.nested?.fine === 2, 'body: $ and dotted keys stripped, others kept', JSON.stringify(pj.body));
  const hasOperatorKey = (v) => v && typeof v === 'object' && Object.entries(v).some(([k, x]) => k.startsWith('$') || hasOperatorKey(x));
  ok(pj.query && !hasOperatorKey(pj.query) && pj.query.ok === '1', 'query: no $-operator keys reach handlers', JSON.stringify(pj.query));
  ok(pj.marker === 42, 'changes to req.query by later middleware persist (validator coercion)', JSON.stringify(pj));
  const srv2 = probe.listen(0);
  const port2 = srv2.address().port;
  const arr = await (await fetch(`http://127.0.0.1:${port2}/p`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"list":[{"$gt":1,"k":1},"s"],"__proto__":{"polluted":true},"deep":{"a":{"b":{"$ne":1,"c":3}}}}' })).json();
  const form = await (await fetch(`http://127.0.0.1:${port2}/p`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email[$gt]=&name=ok' })).json();
  const empty = await (await fetch(`http://127.0.0.1:${port2}/p`, { method: 'POST' })).json();
  srv2.close();
  ok(JSON.stringify(arr.body.list) === '[{"k":1},"s"]', 'operators inside arrays stripped', JSON.stringify(arr.body.list));
  ok(!Object.prototype.hasOwnProperty.call(arr.body, '__proto__') && ({}).polluted === undefined, '__proto__ key dropped, no prototype pollution');
  ok(JSON.stringify(arr.body.deep) === '{"a":{"b":{"c":3}}}', 'deeply nested operators stripped', JSON.stringify(arr.body.deep));
  ok(form.body.name === 'ok' && !hasOperatorKey(form.body) && (form.body.email === undefined || JSON.stringify(form.body.email) === '{}'), 'urlencoded bracket operators stripped', JSON.stringify(form.body));
  ok(empty.body && typeof empty.body === 'object' && Object.keys(empty.body).length === 0, 'missing body becomes {}', JSON.stringify(empty));

  console.log('# validated query values are still numbers');
  const l1 = await req('GET', '/api/admin/students?page=1&limit=5', { cookie: admin });
  ok(l1.status === 200 && l1.json.pagination.page === 1 && l1.json.pagination.limit === 5, 'admin students pagination numeric', JSON.stringify(l1.json?.pagination));
  const l2 = await req('GET', `/api/admin/drives/${drive._id}/applicants?page=1&limit=5&cgpaMin=7`, { cookie: admin });
  ok(l2.status === 200 && l2.json.pagination.page === 1 && l2.json.pagination.limit === 5 && l2.json.data.length === 1, 'applicants pagination numeric and cgpaMin filter works', JSON.stringify(l2.json?.pagination));
  const l3 = await req('GET', `/api/admin/drives/${drive._id}/applicants?cgpaMin=9`, { cookie: admin });
  ok(l3.status === 200 && l3.json.data.length === 0, 'cgpaMin=9 excludes the 8.0 applicant', JSON.stringify(l3.json).slice(0, 120));
  const l4 = await req('GET', '/api/drives?status=Upcoming,Ongoing&sort=closing_soon&page=1&limit=5');
  ok(l4.status === 200 && l4.json.data.length <= 5 && l4.json.data.every((d) => ['Upcoming', 'Ongoing'].includes(d.status)), 'multi-status + closing_soon + paging');
  const l5 = await req('GET', '/api/admin/students?page=0', { cookie: admin });
  ok(l5.status === 400, `invalid page still rejected → ${l5.status}`);
  const l6 = await req('GET', '/api/student/applications?page=1&limit=2', { cookie: student });
  ok(l6.status === 200, 'my applications paging');

  console.log('# routing and errors');
  const n1 = await req('GET', '/api/nope');
  ok(n1.status === 404, `unknown API route → ${n1.status}`);
  const n2 = await req('GET', '/api/auth/session', { cookie: 'tpf_session=garbage' });
  ok(n2.status === 200 && n2.json?.authenticated === false && n2.json?.expired === true, 'session probe with an unknown cookie → logged out, flagged expired');
  const n2b = await req('GET', '/api/auth/session');
  ok(n2b.status === 200 && n2b.json?.authenticated === false, 'admin check without cookie → 200, logged out');
  const n3 = await req('GET', '/api/drives/not-an-id');
  ok(n3.status === 400 && n3.json?.success === false && !/stack|\bat /.test(n3.text), `bad id → ${n3.status} JSON, no stack`, n3.text.slice(0, 100));
  const n4 = await req('GET', `/api/drives/${drive._id}`);
  ok(n4.status === 200 && n4.json.data.company === `${TAG} Corp`, 'drive detail');
  const n5 = await req('GET', '/api/cron/trigger');
  ok([401, 503].includes(n5.status), `cron without secret → ${n5.status}`);
  const n6 = await fetch(API + '/api/cron/trigger', { headers: { Authorization: `Bearer ${TEST.CRON_SECRET}` } });
  ok(n6.status === 200, `cron with secret → ${n6.status}`);
  const log = fs.readFileSync(TEST.SERVER_LOG, 'utf8');
  ok(!/TypeError|Cannot set property|only a getter/.test(log), 'server log has no TypeErrors', (log.match(/.*(TypeError|Cannot set property|only a getter).*/) || [''])[0]);

  await Application.deleteMany({ driveId: drive._id });
  await Placement.deleteOne({ _id: drive._id });
  await Student.deleteMany({ email });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
