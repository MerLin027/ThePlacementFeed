// Phase A API + cron verification — status automation. Local throwaway stack only (CRON_SECRET_TEST=cron-test-secret).
const TEST = require('../lib/env.cjs');
const path = require('path');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const { runStatusTransitionJob, ensureStatusesFresh } = require(path.join(SERVER, 'src/features/drives/freshness'));

const API = TEST.API;
const ORIGIN = TEST.APP;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const utcDay = (n) => new Date(istDate(n));
const TAG = `PA${Date.now() % 100000}`;

let admin;
const call = async (method, url, body, headers = {}) => {
  const res = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: admin, ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const create = (name, extra) => call('POST', '/api/admin/drives', { company: `${TAG} ${name}`, role: 'SDE', type: 'Full-Time', ctc: 5, ...extra });
const formPayload = (doc, extra) => ({
  company: doc.company, role: doc.role, type: doc.type, ctc: doc.ctc,
  driveDate: doc.driveDate ? doc.driveDate.slice(0, 10) : null,
  deadline: doc.deadline ? doc.deadline.slice(0, 10) : null,
  ...extra,
});

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) });
  admin = login.headers.getSetCookie()[0].split(';')[0];
  // The drive's change log (staff responses don't include it; it feeds student notifications)
  const changesOf = async (id) => (await Placement.findById(id).lean()).recentChanges;

  console.log('# Status computed on create');
  let r = await create('Open', { deadline: istDate(3), driveDate: istDate(6) });
  ok(r.status === 201 && r.json.data.status === 'Upcoming' && r.json.data.statusManuallySet === false, 'future dates -> Upcoming, automatic');
  r = await create('Closed', { deadline: istDate(-1), driveDate: istDate(4) });
  ok(r.json.data.status === 'Ongoing', 'deadline yesterday -> Ongoing immediately (no cron wait)');
  r = await create('DeadlineToday', { deadline: istDate(0), driveDate: istDate(4) });
  ok(r.json.data.status === 'Upcoming', 'deadline today -> still Upcoming');
  r = await create('Past', { deadline: istDate(-9), driveDate: istDate(-2) });
  ok(r.json.data.status === 'Completed', 'drive date passed -> Completed');
  ok((await changesOf(r.json.data._id)).length === 1 && (await changesOf(r.json.data._id))[0].type === 'new', 'one "new" log entry');
  r = await create('NoDates', {});
  ok(r.json.data.status === 'Upcoming' && !r.json.data.statusManuallySet, 'no dates -> Upcoming, automatic');
  r = await create('Pinned', { deadline: istDate(3), driveDate: istDate(6), status: 'Completed' });
  ok(r.json.data.status === 'Completed' && r.json.data.statusManuallySet === true, 'explicit status -> pinned');
  r = await create('Sneaky', { deadline: istDate(3), driveDate: istDate(6), statusManuallySet: true, recentChanges: [{ type: 'edit' }], status: 'auto' });
  ok(r.json.data.statusManuallySet === false && (await changesOf(r.json.data._id)).length === 1, 'statusManuallySet/recentChanges in body ignored');

  console.log('# Date order enforced on create AND edit (S1)');
  r = await create('BadOrder', { deadline: istDate(9), driveDate: istDate(3) });
  ok(r.status === 400, 'create: deadline after drive date -> 400');
  const open = (await create('Edit', { deadline: istDate(-1), driveDate: istDate(4) })).json.data;
  r = await call('PUT', `/api/admin/drives/${open._id}`, formPayload(open, { deadline: istDate(10), status: 'auto' }));
  ok(r.status === 400, 'edit: deadline after drive date -> 400');
  const unchanged = await Placement.findById(open._id).lean();
  ok(unchanged.deadline.toISOString().slice(0, 10) === istDate(-1), 'rejected edit saved nothing');

  console.log('# Status follows edits in both directions (S2/S4)');
  ok(open.status === 'Ongoing', 'starts Ongoing');
  r = await call('PUT', `/api/admin/drives/${open._id}`, formPayload(open, { deadline: istDate(2), status: 'auto' }));
  ok(r.status === 200 && r.json.data.status === 'Upcoming', 'deadline extended -> back to Upcoming');
  const last = (await changesOf(r.json.data._id)).at(-1);
  ok(last.type === 'statusChange' && last.status === 'Upcoming', 'logged statusChange with new status');
  r = await call('PUT', `/api/admin/drives/${open._id}`, formPayload(r.json.data, { role: 'SDE II', status: 'auto' }));
  ok((await changesOf(r.json.data._id)).at(-1).type === 'edit', 'plain edit logs "edit"');
  r = await call('PUT', `/api/admin/drives/${open._id}`, formPayload(r.json.data, { driveDate: null, deadline: null, status: 'auto' }));
  ok(r.status === 200 && r.json.data.driveDate === undefined || r.json.data.driveDate === null, 'dates can be cleared');

  console.log('# Manual pin and restore');
  const m = (await create('Manual', { deadline: istDate(-3), driveDate: istDate(5) })).json.data;
  r = await call('PUT', `/api/admin/drives/${m._id}`, formPayload(m, { status: 'Upcoming' }));
  ok(r.json.data.status === 'Upcoming' && r.json.data.statusManuallySet === true, 'pin Upcoming despite past deadline');
  r = await call('PUT', `/api/admin/drives/${m._id}`, formPayload(r.json.data, { ctc: 6 }));
  ok(r.json.data.status === 'Upcoming' && r.json.data.statusManuallySet === true, 'edit without status keeps the pin');
  let changed = await runStatusTransitionJob();
  ok((await Placement.findById(m._id).lean()).status === 'Upcoming', 'cron leaves pinned drive alone');
  r = await call('PATCH', `/api/admin/drives/${m._id}/status-automation`, { statusManuallySet: false });
  ok(r.json.data.status === 'Ongoing' && r.json.data.statusManuallySet === false, 'restore automation -> recomputed immediately');
  r = await call('PUT', `/api/admin/drives/${m._id}`, formPayload(r.json.data, { status: 'Completed' }));
  r = await call('PUT', `/api/admin/drives/${m._id}`, formPayload(r.json.data, { status: 'auto' }));
  ok(r.json.data.status === 'Ongoing' && !r.json.data.statusManuallySet, "status 'auto' in form restores automation");
  r = await call('PUT', `/api/admin/drives/${m._id}`, formPayload(r.json.data, { status: 'Hired' }));
  ok(r.status === 400, 'invalid status -> 400');

  console.log('# Postponed drives are frozen (S3)');
  const pp = (await create('Postponed', { deadline: istDate(2), driveDate: istDate(4) })).json.data;
  r = await call('PATCH', `/api/admin/drives/${pp._id}/postpone`, { isPostponed: true });
  ok(r.json.data.isPostponed && r.json.data.status === 'Upcoming' && (await changesOf(r.json.data._id)).at(-1).type === 'postponed', 'postpone keeps status, logs postponed');
  await Placement.updateOne({ _id: pp._id }, { deadline: utcDay(-6), driveDate: utcDay(-2) }); // dates pass while postponed
  await runStatusTransitionJob();
  ok((await Placement.findById(pp._id).lean()).status === 'Upcoming', 'cron skips postponed drive');
  r = await call('PATCH', `/api/admin/drives/${pp._id}/postpone`, { isPostponed: false });
  ok(r.json.data.status === 'Completed' && (await changesOf(r.json.data._id)).at(-1).type === 'unpostponed' && (await changesOf(r.json.data._id)).at(-1).status === 'Completed', 'un-postpone -> recomputed, one entry with status');
  const pp2 = (await create('FormPostpone', { deadline: istDate(2), driveDate: istDate(4) })).json.data;
  r = await call('PUT', `/api/admin/drives/${pp2._id}`, formPayload(pp2, { isPostponed: true, status: 'auto' }));
  ok((await changesOf(r.json.data._id)).at(-1).type === 'postponed', 'postponing via the form logs "postponed"');

  console.log('# Cron: both directions, one change each, idempotent');
  const back = (await create('CronBack', { deadline: istDate(-2), driveDate: istDate(5) })).json.data;
  await Placement.updateOne({ _id: back._id }, { deadline: utcDay(3) }); // stale stored status (Ongoing) vs dates
  const fwd = (await create('CronFwd', { driveDate: istDate(3) })).json.data;
  await Placement.updateOne({ _id: fwd._id }, { driveDate: utcDay(-1) }); // no deadline, drive date passed
  changed = await runStatusTransitionJob();
  const backDoc = await Placement.findById(back._id).lean();
  const fwdDoc = await Placement.findById(fwd._id).lean();
  ok(backDoc.status === 'Upcoming', 'cron moves Ongoing back to Upcoming when deadline is in the future');
  ok(fwdDoc.status === 'Completed' && fwdDoc.recentChanges.filter((c) => c.type === 'statusChange').length === 1, 'Upcoming -> Completed in one step, one notification (S5)');
  ok(changed >= 2, `job reported ${changed} change(s)`);
  ok((await runStatusTransitionJob()) === 0, 'second run changes nothing');

  console.log('# Once-per-day refresh');
  await Placement.updateOne({ _id: back._id }, { status: 'Completed' }); // stale again
  await ensureStatusesFresh(); // already ran today in this process -> no-op
  ok((await Placement.findById(back._id).lean()).status === 'Completed', 'ensureStatusesFresh is a no-op within the same IST day');
  await runStatusTransitionJob();
  ok((await Placement.findById(back._id).lean()).status === 'Upcoming', 'explicit run fixes it');

  console.log('# Change feed includes status');
  r = await fetch(`${API}/api/drives/changes?since=${encodeURIComponent(new Date(Date.now() - 600e3).toISOString())}`).then((x) => x.json());
  const sc = r.data.find((c) => c.type === 'statusChange' && c.placementId === back._id);
  ok(sc && sc.status === 'Upcoming', '/changes items carry the new status');

  console.log('# Cron trigger secret');
  r = await fetch(API + '/api/cron/trigger');
  ok(r.status === 401, 'no auth -> 401');
  r = await fetch(API + '/api/cron/trigger', { headers: { Authorization: 'Bearer wrong' } });
  ok(r.status === 401, 'wrong secret -> 401');
  r = await fetch(API + '/api/cron/trigger', { headers: { Authorization: `Bearer ${TEST.CRON_SECRET}` } });
  ok(r.status === 200, 'correct secret -> 200');

  await Placement.deleteMany({ company: { $regex: `^${TAG}` } });
  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
