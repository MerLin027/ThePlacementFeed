const path = require('path');
// Load server/.env by absolute path so the script works from any folder (an already-set
// MONGODB_URI wins, which is how the tests point it at a local database)
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

/**
 * One-off data migration for the site upgrade (institutes, branches in the database, backlog
 * history removed, two-step account delete). Safe to run more than once.
 *
 *   node server/scripts/migrateSiteUpgrade.js                  dry run: prints what would change
 *   node server/scripts/migrateSiteUpgrade.js --apply          applies it (local database)
 *   node server/scripts/migrateSiteUpgrade.js --apply --confirm-production
 *                                                              applies it to a non-local database
 *
 * Take an Atlas snapshot or mongodump first. The legacy Student.institute field and its old
 * { institute, rollNumber } index are left in place so the previous release still runs.
 */
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

const isLocal = (uri) => {
  const host = (uri.match(/^mongodb:\/\/(?:[^@/]*@)?([^:/?]+)/) || [])[1];
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host) && !/\+srv/.test(uri);
};

const SCRUBBED = { 'snapshot.firstName': 'Deleted', 'snapshot.lastName': 'User', 'snapshot.email': '' };

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is not defined in ${path.join(__dirname, '..', '.env')}`);
  if (APPLY && !isLocal(uri) && !args.has('--confirm-production')) {
    throw new Error('Refusing to write to a non-local database without --confirm-production');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const students = db.collection('students');
  const applications = db.collection('applications');
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} · ${isLocal(uri) ? 'local database' : 'NON-LOCAL database'}`);

  // 1. Roll numbers become unique on their own (they already are while every account is CHARUSAT)
  const dupes = await students
    .aggregate([{ $group: { _id: '$rollNumber', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
    .toArray();
  if (dupes.length > 0) {
    throw new Error(`Duplicate roll numbers, fix these first: ${dupes.map((d) => d._id).join(', ')}`);
  }
  const indexes = await students.indexes();
  const hasRollIndex = indexes.some((i) => i.unique && JSON.stringify(i.key) === '{"rollNumber":1}');
  console.log(`1. unique { rollNumber } index: ${hasRollIndex ? 'already there' : 'to create'}`);
  if (APPLY && !hasRollIndex) await students.createIndex({ rollNumber: 1 }, { unique: true });

  // 2. Branches move into the database (the API also does this on boot)
  const branchCount = await db.collection('branches').countDocuments();
  console.log(`2. branches in the database: ${branchCount}${branchCount === 0 ? ' (seeded from the built-in list)' : ''}`);
  if (APPLY && branchCount === 0) await require('../src/features/catalog/cache').init();

  // 3. Backlog history is no longer part of the profile
  const withHistory = await students.countDocuments({ historyBacklogs: { $exists: true } });
  console.log(`3. students with historyBacklogs to remove: ${withHistory}`);
  if (APPLY && withHistory > 0) await students.updateMany({ historyBacklogs: { $exists: true } }, { $unset: { historyBacklogs: '' } });

  // 4. Old snapshots stored the university in `institute`; it now means the constituent institute
  const oldSnapshots = { 'snapshot.university': { $exists: false }, 'snapshot.institute': { $exists: true } };
  const toMove = await applications.countDocuments(oldSnapshots);
  console.log(`4. application snapshots to move institute -> university: ${toMove}`);
  if (APPLY && toMove > 0) {
    await applications.updateMany(oldSnapshots, [
      { $set: { 'snapshot.university': '$snapshot.institute' } },
      { $unset: 'snapshot.institute' },
    ]);
  }

  // 5. Applications kept from deleted accounts get the explicit flag
  const toFlag = await applications.countDocuments({ ...SCRUBBED, studentDeleted: { $ne: true } });
  console.log(`5. scrubbed applications to flag studentDeleted: ${toFlag}`);
  if (APPLY && toFlag > 0) {
    await applications.updateMany({ ...SCRUBBED, studentDeleted: { $ne: true } }, { $set: { studentDeleted: true } });
  }

  console.log(APPLY ? 'Done.' : 'Nothing was changed. Run again with --apply to apply.');
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(`FAILED: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  });
