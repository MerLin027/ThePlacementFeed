// Audit 2026-10-28, Phase 2: the access-control matrix. Every API route (collected from the real
// routers at runtime, so a new route is covered automatically) is called by every kind of caller,
// and the answer must match who may use it:
//   guest, student, pending student (password reset), admin, pending admin (new account), super admin.
// "Let in" means the route's own handler answered (validation, 404 for the random ids used here,
// or success); "kept out" means the guards answered with their codes. Random ids and empty bodies,
// so nothing real is changed; logout is left out (it would end the caller's session).
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Admin = require(path.join(SERVER, 'src/models/Admin'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Session = require(path.join(SERVER, 'src/models/Session'));

const API = TEST.API;
const ORIGIN = TEST.APP;
const TAG = `mx${Date.now() % 1000000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const cookieOf = (res) => (res.headers.getSetCookie().find((c) => c.startsWith('tpf_session=') && !c.startsWith('tpf_session=;')) || '').split(';')[0];
const post = (url, body, cookie) => fetch(API + url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie && { Cookie: cookie }) }, body: JSON.stringify(body) });

// Every route, as the routers register them (same technique as the audit's route walk)
const collectRoutes = () => {
  const Router = require(path.join(SERVER, 'node_modules/router'));
  const children = new Map();
  const add = (r, e) => { if (!children.has(r)) children.set(r, []); children.get(r).push(e); };
  const origUse = Router.prototype.use;
  Router.prototype.use = function (...args) {
    const p = typeof args[0] === 'string' ? args[0] : '';
    (typeof args[0] === 'string' ? args.slice(1) : args).flat().forEach((h) => { if (typeof h === 'function' && h.stack) add(this, { kind: 'mount', path: p, target: h }); });
    return origUse.apply(this, args);
  };
  const originals = {};
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    originals[m] = Router.prototype[m];
    Router.prototype[m] = function (p, ...rest) { if (typeof p === 'string') add(this, { kind: 'route', path: p, method: m.toUpperCase() }); return originals[m].call(this, p, ...rest); };
  }
  // The route modules aren't loaded yet in this process, so they register through the recording prototype
  process.env.MONGODB_URI ||= TEST.MONGODB_URI;
  process.env.CLIENT_URL ||= ORIGIN;
  const api = require(path.join(SERVER, 'src/routes'));
  Router.prototype.use = origUse;
  for (const m of Object.keys(originals)) Router.prototype[m] = originals[m];
  const routes = [];
  const walk = (r, prefix) => (children.get(r) || []).forEach((e) => (e.kind === 'route' ? routes.push([e.method, (prefix + e.path).replace(/\/$/, '')]) : walk(e.target, prefix + e.path)));
  walk(api, '/api');
  return [...new Map(routes.map((r) => [r.join(' '), r])).values()];
};

// Who may use a route, from its namespace and the permission table (API.md)
const SUPER_ONLY = ['/api/admin/catalog', '/api/admin/staff', '/api/admin/profile'];
const expected = (method, url) => {
  if (url === '/api/auth/password') return { guest: 'out', student: 'in', pendingStudent: 'in', admin: 'in', pendingAdmin: 'in', superAdmin: 'in' };
  if (url.startsWith('/api/student/')) {
    const pendingOk = method === 'GET' && url === '/api/student/profile';
    return { guest: 'out', student: 'in', pendingStudent: pendingOk ? 'in' : 'out', admin: 'out', pendingAdmin: 'out', superAdmin: 'out' };
  }
  if (url.startsWith('/api/admin/')) {
    const superOnly = SUPER_ONLY.some((p) => url === p || url.startsWith(p + '/'));
    return { guest: 'out', student: 'out', pendingStudent: 'out', admin: superOnly ? 'out' : 'in', pendingAdmin: 'out', superAdmin: 'in' };
  }
  // Public and the rest of /api/auth: everyone
  return { guest: 'in', student: 'in', pendingStudent: 'in', admin: 'in', pendingAdmin: 'in', superAdmin: 'in' };
};
const DENIED = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED', 'FORBIDDEN', 'PASSWORD_CHANGE_REQUIRED']);

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  try {
    // The callers
    const callers = { guest: '' };
    callers.student = cookieOf(await post('/api/auth/signup', { email: `${TAG}s@example.com`, rollNumber: `${TAG}S1`.toUpperCase(), password: 'matrix-student-1' }));
    callers.pendingStudent = cookieOf(await post('/api/auth/signup', { email: `${TAG}p@example.com`, rollNumber: `${TAG}P1`.toUpperCase(), password: 'matrix-student-2' }));
    await Student.updateOne({ email: `${TAG}p@example.com` }, { $set: { mustChangePassword: true, tempPasswordExpiresAt: new Date(Date.now() + 3600e3) } });
    callers.superAdmin = cookieOf(await post('/api/auth/login', { identifier: 'testadmin', password: 'testadminpass' }));
    const created = await (await post('/api/admin/staff', { name: 'Matrix Admin', email: `${TAG}a@example.com` }, callers.superAdmin)).json();
    const pendingAdminLogin = await post('/api/auth/login', { identifier: `${TAG}a@example.com`, password: created.temporaryPassword });
    callers.pendingAdmin = cookieOf(pendingAdminLogin);
    const changed = await post('/api/auth/password', { newPassword: 'matrix-admin-pass-1' }, callers.pendingAdmin);
    callers.admin = cookieOf(changed);
    // A second admin account stays pending for the pendingAdmin caller
    const created2 = await (await post('/api/admin/staff', { name: 'Matrix Pending', email: `${TAG}b@example.com` }, callers.superAdmin)).json();
    callers.pendingAdmin = cookieOf(await post('/api/auth/login', { identifier: `${TAG}b@example.com`, password: created2.temporaryPassword }));
    ok(Object.entries(callers).every(([k, v]) => k === 'guest' || Boolean(v)), 'six kinds of caller ready');

    // Left out: logout (it would end the caller's session) and the cron trigger (machine-to-machine,
    // its own bearer token; tested in phase4/upgrade suites)
    const routes = collectRoutes().filter(([m, u]) => !(m === 'POST' && u === '/api/auth/logout') && u !== '/api/cron/trigger');
    ok(routes.length >= 50, `${routes.length} routes collected from the routers`);
    const fakeId = new mongoose.Types.ObjectId().toString();
    const problems = [];
    for (const [method, pattern] of routes) {
      const url = pattern.replace(/:\w+/g, fakeId);
      const want = expected(method, pattern);
      for (const [who, cookie] of Object.entries(callers)) {
        const res = await fetch(API + url, {
          method,
          headers: { Origin: ORIGIN, ...(cookie && { Cookie: cookie }), ...(method !== 'GET' && { 'Content-Type': 'application/json' }) },
          ...(method !== 'GET' && { body: '{}' }),
        });
        let code = '';
        try { code = (await res.json()).code || ''; } catch { /* a file or plain answer: the handler ran */ }
        // A 429 comes from the route's own limiter, which runs after the guards: the caller got in
        const got = (res.status === 401 || res.status === 403) && DENIED.has(code) ? 'out' : 'in';
        if (got !== want[who]) problems.push(`${who} ${method} ${pattern}: ${res.status} ${code} (expected ${want[who]})`);
      }
    }
    ok(problems.length === 0, `every route answers every caller as the permission table says (${routes.length} routes × 6 callers)`, `\n    ${problems.join('\n    ')}`);
  } finally {
    const staff = await Admin.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: [...staff, ...studs].map((x) => x._id) } });
    await Admin.deleteMany({ email: new RegExp(`^${TAG}`) });
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
