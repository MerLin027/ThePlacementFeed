// Site upgrade data migration (server/scripts/migrateSiteUpgrade.js) on old-shaped records, in a
// scratch database. Dry run changes nothing; --apply migrates; a second run is a no-op.
const TEST = require('../lib/env.cjs');
const path = require('path');
const { execFileSync } = require('child_process');
const mongoose = require(path.join(TEST.SERVER, 'node_modules/mongoose'));

let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };

const uri = TEST.dbUri(`tpf_migrate_${Date.now()}`);
const SCRIPT = path.join(TEST.SERVER, 'scripts', 'migrateSiteUpgrade.js');
const runScript = (...args) => execFileSync(process.execPath, [SCRIPT, ...args], {
  env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, MONGODB_URI: uri }, encoding: 'utf8',
});

(async () => {
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;
  const id = () => new mongoose.Types.ObjectId();
  const s1 = id(), s2 = id(), drive = id();
  await db.collection('students').createIndex({ institute: 1, rollNumber: 1 }, { unique: true });
  await db.collection('students').insertMany([
    { _id: s1, email: 'm1@example.com', rollNumber: 'MIG001', institute: 'CHARUSAT', historyBacklogs: 2, activeBacklogs: 0 },
    { _id: s2, email: 'm2@example.com', rollNumber: 'MIG002', institute: 'CHARUSAT', activeBacklogs: 1 },
  ]);
  await db.collection('applications').insertMany([
    { driveId: drive, studentId: s1, snapshot: { firstName: 'Mira', lastName: 'Shah', email: 'm1@example.com', institute: 'CHARUSAT', historyBacklogs: 2 } },
    { driveId: drive, studentId: id(), snapshot: { firstName: 'Deleted', lastName: 'User', email: '', institute: 'CHARUSAT' } },
  ]);

  console.log('# Dry run');
  const dry = runScript();
  ok(/DRY RUN/.test(dry) && /historyBacklogs to remove: 1/.test(dry) && /institute -> university: 2/.test(dry) && /flag studentDeleted: 1/.test(dry), 'dry run reports the counts', dry);
  ok((await db.collection('students').countDocuments({ historyBacklogs: { $exists: true } })) === 1, 'dry run changed nothing');

  console.log('# Apply');
  const out = runScript('--apply');
  ok(/APPLYING/.test(out) && /Done\./.test(out), 'apply finishes', out);
  const idx = await db.collection('students').indexes();
  ok(idx.some((i) => i.unique && JSON.stringify(i.key) === '{"rollNumber":1}'), 'unique rollNumber index created');
  ok(idx.some((i) => JSON.stringify(i.key) === '{"institute":1,"rollNumber":1}'), 'legacy index kept for a rollback');
  ok((await db.collection('branches').countDocuments()) === 12, 'branches seeded');
  ok((await db.collection('students').countDocuments({ historyBacklogs: { $exists: true } })) === 0, 'historyBacklogs removed from students');
  ok((await db.collection('students').countDocuments({ institute: 'CHARUSAT' })) === 2, 'legacy institute field kept on students');
  const apps = await db.collection('applications').find().toArray();
  ok(apps.every((a) => a.snapshot.university === 'CHARUSAT' && a.snapshot.institute === undefined), 'snapshots: institute moved to university');
  ok(apps.find((a) => a.studentId.equals(s1)).snapshot.historyBacklogs === 2, 'old snapshot values are left as they are');
  ok(apps.filter((a) => a.studentDeleted === true).length === 1, 'scrubbed application flagged');

  console.log('# Second run');
  const again = runScript('--apply');
  ok(/already there/.test(again) && /to remove: 0/.test(again) && /university: 0/.test(again) && /studentDeleted: 0/.test(again), 'second run is a no-op', again);

  console.log('# Guard');
  let refused = false;
  try {
    execFileSync(process.execPath, [SCRIPT, '--apply'], { env: { PATH: process.env.PATH, MONGODB_URI: 'mongodb+srv://u:p@example.mongodb.net/x' }, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) { refused = /confirm-production/.test(String(e.stderr)); }
  ok(refused, 'a non-local database needs --confirm-production');

  await db.dropDatabase();
  await conn.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
