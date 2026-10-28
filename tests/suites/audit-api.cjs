// Audit 2026-10-28: regression tests for the findings fixed during the audit.
// - PERF-1: rate limits count signed-in visitors per account (a campus shares one address), with
//   campus-sized ceilings for anonymous visitors, and the change feed has its own budget.
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Session = require(path.join(SERVER, 'src/models/Session'));

const API = TEST.API;
const ORIGIN = TEST.APP;
const TAG = `aud${Date.now() % 1000000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const call = async (method, url, { body, cookie } = {}) => {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return {
    status: res.status,
    json,
    limit: Number(res.headers.get('ratelimit-limit')),
    remaining: Number(res.headers.get('ratelimit-remaining')),
    cookie: (res.headers.getSetCookie().find((c) => c.startsWith('tpf_session=') && !c.startsWith('tpf_session=;')) || '').split(';')[0],
  };
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  try {
    console.log('# PERF-1: campus-sized rate limits');
    const students = [];
    for (const n of [1, 2]) {
      const r = await call('POST', '/api/auth/signup', { body: { email: `${TAG}s${n}@example.com`, rollNumber: `${TAG}R${n}`.toUpperCase(), password: `campus-pass-${n}x` } });
      students.push(r.cookie);
    }
    ok(students.every(Boolean), 'two students signed up from the same address');

    const anon = await call('GET', '/api/drives?limit=1');
    ok(anon.limit === 3000, `an anonymous visitor's address gets a campus-sized ceiling (${anon.limit})`);
    const a1 = await call('GET', '/api/drives?limit=1', { cookie: students[0] });
    const a2 = await call('GET', '/api/drives?limit=1', { cookie: students[0] });
    const b1 = await call('GET', '/api/drives?limit=1', { cookie: students[1] });
    ok(a1.limit === 600 && a2.remaining === a1.remaining - 1, 'a signed-in student is counted on their own account', JSON.stringify([a1.limit, a1.remaining, a2.remaining]));
    ok(b1.remaining === 599, 'a second student on the same address starts with a full budget', String(b1.remaining));

    const feed1 = await call('GET', `/api/drives/changes?since=${encodeURIComponent(new Date().toISOString())}`, { cookie: students[0] });
    ok(feed1.status === 200 && feed1.limit === 300 && feed1.remaining === 299, 'the change feed has its own budget (browsing did not use it)', JSON.stringify([feed1.limit, feed1.remaining]));
    const browse = await call('GET', '/api/drives?limit=1', { cookie: students[0] });
    ok(browse.remaining === a2.remaining - 1, '…and polling does not use up browsing', JSON.stringify([a2.remaining, browse.remaining]));

    const s1 = await call('GET', '/api/student/applications/summary', { cookie: students[0] });
    const s2 = await call('GET', '/api/student/applications/summary', { cookie: students[1] });
    ok(s1.remaining === 299 && s2.remaining === 299, 'application polling is per student, not per address', JSON.stringify([s1.remaining, s2.remaining]));
    const p1 = await call('GET', '/api/student/profile', { cookie: students[0] });
    const p2 = await call('GET', '/api/student/profile', { cookie: students[1] });
    ok(p1.remaining === p2.remaining, 'profile reads are per student', JSON.stringify([p1.remaining, p2.remaining]));

    // The login route also carries the failures-only guard, whose headers win: read the ceilings
    const { POLICIES } = require(path.join(SERVER, 'src/middleware/rateLimit'));
    ok(POLICIES.login.limit >= 600 && POLICIES.studentSignup.limit >= 300, 'a campus can sign in and sign up from one address', JSON.stringify([POLICIES.login.limit, POLICIES.studentSignup.limit]));
    ok(POLICIES.loginAccount.limit === 5 && POLICIES.loginAccount.skipSuccessfulRequests, 'password guessing is still limited to 5 failures per address and identifier');
  } finally {
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: studs.map((x) => x._id) } });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
