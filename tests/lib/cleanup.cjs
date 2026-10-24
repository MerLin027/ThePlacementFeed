// Removes leftover test data from the LOCAL test database before a run: test students, and drives whose
// company name starts with a suite tag (PE12345 …, P3B12345 …, UP9…, PGBASE …) with their applications.
// Demo drives with real company names are kept.
const path = require('path');
const env = require('./env.cjs');
const mongoose = require(path.join(env.SERVER, 'node_modules/mongoose'));

const TEST_DRIVE = /^(P[A-Z0-9]{1,3}\d{2,6}|UP\d+|PGBASE|CT\d+|DC[MB]\d+|IN[MB]\d+|FZ[MB]\d+|CO\d+)\b/;
const TEST_STUDENT = [
  { rollNumber: { $in: ['21CE001', '21CE004', 'REV0001'] } },
  { email: { $in: ['mass@y.com', 'ratelimit@example.com', 'revoke@example.com'] } },
  { email: /^stu\d+@example\.com$/ },
];

(async () => {
  await mongoose.connect(env.assertLocalDb(), { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const students = await db.collection('students').deleteMany({ $or: TEST_STUDENT });
  const ids = (await db.collection('placements').find({ company: TEST_DRIVE }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  const apps = await db.collection('applications').deleteMany({ driveId: { $in: ids } });
  const drives = await db.collection('placements').deleteMany({ _id: { $in: ids } });
  // Applying needs an institute; suites pick this one (lib/institute.cjs)
  const now = new Date();
  await db.collection('institutes').updateOne(
    { nameKey: 'test institute' },
    { $set: { name: 'Test Institute', active: true, updatedAt: now }, $setOnInsert: { nameKey: 'test institute', createdAt: now } },
    { upsert: true }
  );
  console.log(`cleanup: ${students.deletedCount} students, ${drives.deletedCount} test drives, ${apps.deletedCount} applications removed`);
  await mongoose.disconnect();
})().catch((e) => { console.error('cleanup failed:', e.message); process.exit(1); });
