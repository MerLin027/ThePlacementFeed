// Truth table for computeAutoStatus / applyAutoStatus (pure functions, no DB).
const TEST = require('../lib/env.cjs');
const path = require('path');
const { computeAutoStatus, applyAutoStatus } = require(path.join(TEST.SERVER, 'src/features/drives/status'));
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

const today = new Date(Date.UTC(2026, 9, 22)); // 22 Oct 2026, IST day as UTC midnight
const d = (n) => new Date(today.getTime() + n * 86400e3);
const cases = [
  // [label, deadline, driveDate, expected]
  ['no dates', null, null, null],
  ['deadline future, drive future', d(2), d(5), 'Upcoming'],
  ['deadline today (still open)', d(0), d(5), 'Upcoming'],
  ['deadline yesterday', d(-1), d(5), 'Ongoing'],
  ['deadline passed, drive day today', d(-3), d(0), 'Ongoing'],
  ['drive day today, no deadline', null, d(0), 'Ongoing'],
  ['deadline today == drive day today', d(0), d(0), 'Ongoing'],
  ['drive yesterday', d(-5), d(-1), 'Completed'],
  ['drive yesterday, no deadline', null, d(-1), 'Completed'],
  ['only deadline, future', d(3), null, 'Upcoming'],
  ['only deadline, passed', d(-3), null, 'Ongoing'],
  ['only drive, future', null, d(9), 'Upcoming'],
  ['ISO string input', d(-1).toISOString(), d(4).toISOString().slice(0, 10), 'Ongoing'],
  ['empty strings', '', '', null],
  ['garbage date ignored', 'not-a-date', d(-2), 'Completed'],
];
for (const [label, deadline, driveDate, expected] of cases) {
  const got = computeAutoStatus({ deadline, driveDate }, today);
  ok(got === expected, `${label} -> ${expected}`, `got ${got}`);
}

// Real "today" path: a deadline 1 hour ago in IST terms is still "today"
const nowDrive = { deadline: new Date(), driveDate: new Date(Date.now() + 5 * 86400e3) };
ok(computeAutoStatus(nowDrive) === 'Upcoming' || computeAutoStatus(nowDrive) === 'Ongoing', 'works with real clock');

console.log('# applyAutoStatus');
let drive = { status: 'Ongoing', deadline: d(5), driveDate: d(8), statusManuallySet: false, isPostponed: false };
ok(applyAutoStatus(drive, today) === true && drive.status === 'Upcoming', 'moves backwards when deadline extended');
ok(applyAutoStatus(drive, today) === false, 'idempotent');
drive = { status: 'Upcoming', deadline: d(-5), driveDate: d(-2), statusManuallySet: true, isPostponed: false };
ok(applyAutoStatus(drive, today) === false && drive.status === 'Upcoming', 'manual status untouched');
drive = { status: 'Upcoming', deadline: d(-5), driveDate: d(-2), statusManuallySet: false, isPostponed: true };
ok(applyAutoStatus(drive, today) === false && drive.status === 'Upcoming', 'postponed drive untouched');
drive = { status: 'Ongoing', statusManuallySet: false, isPostponed: false };
ok(applyAutoStatus(drive, today) === false && drive.status === 'Ongoing', 'no dates: keeps current status');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
