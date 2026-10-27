const Admin = require('../../models/Admin');
const { config } = require('../../config/env');
const { hashPassword } = require('./passwords');

/**
 * Startup checks on staff accounts, all idempotent:
 * - First boot: creates the super admin from ADMIN_USERNAME / ADMIN_PASSWORD when there is no staff
 *   account at all. Afterwards passwords are changed in the app (or with scripts/resetAdmin.js).
 * - Older data: accounts without a role become admins; exactly one super admin remains (the oldest
 *   active one, promoted if there is none); admins sign in with their email, so their usernames
 *   are removed once they have one.
 * - Then the indexes (autoIndex is off for Admin, because the old unique username index has to be
 *   replaced before the new ones can be built).
 * A failure is logged, not fatal: the site still serves the public pages.
 */

// Before 2026-10-27 every account had a username, under a plain unique index. Admins no longer
// have one, and a plain unique index allows only one account without it.
const dropOldUsernameIndex = async () => {
  const indexes = await Admin.collection.indexes().catch(() => []);
  if (indexes.some((index) => index.name === 'username_1' && !index.partialFilterExpression)) {
    await Admin.collection.dropIndex('username_1');
    console.log('Replaced the old unique username index.');
  }
};

const oneSuperAdmin = async () => {
  const superAdmins = await Admin.find({ role: 'super_admin' }).sort({ createdAt: 1, _id: 1 }).select('_id active').lean();
  // Keep the oldest active one; any others become admins
  const keep = superAdmins.find((s) => s.active !== false);
  const extra = superAdmins.filter((s) => s !== keep).map((s) => s._id);
  if (extra.length > 0) {
    await Admin.updateMany({ _id: { $in: extra } }, { $set: { role: 'admin' } });
    console.log(`${extra.length} other super admin account(s) became admins (there is one super admin).`);
  }
  if (keep) return;

  const oldest = await Admin.findOne({ active: { $ne: false }, username: { $type: 'string' } })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id username')
    .lean();
  if (oldest) {
    await Admin.updateOne({ _id: oldest._id }, { $set: { role: 'super_admin' } });
    console.log(`"${oldest.username}" is now the super admin.`);
  } else {
    console.warn('Warning: there is no super admin. To restore one, run: node scripts/resetAdmin.js');
  }
};

const seedAdmin = async () => {
  try {
    await dropOldUsernameIndex();

    if (!(await Admin.exists({}))) {
      const { username, password } = config().adminSeed;
      if (!username || !password) {
        console.warn('Warning: ADMIN_USERNAME or ADMIN_PASSWORD not set. Skipping initial admin seed.');
        console.warn('To create an admin, run: node scripts/resetAdmin.js');
      } else {
        await Admin.create({ username: username.toLowerCase(), role: 'super_admin', passwordHash: await hashPassword(password) });
        console.log(`Super admin "${username}" created.`);
      }
    } else {
      await Admin.updateMany({ role: { $exists: false } }, { $set: { role: 'admin' } });
      await oneSuperAdmin();
      const { modifiedCount } = await Admin.updateMany(
        { role: 'admin', username: { $exists: true }, email: { $type: 'string' } },
        { $unset: { username: '' } }
      );
      if (modifiedCount > 0) console.log(`${modifiedCount} admin(s) now sign in with their email instead of a username.`);
    }

    await Admin.createIndexes();
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
