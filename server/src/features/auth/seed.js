const Admin = require('../../models/Admin');
const { config } = require('../../config/env');
const { hashPassword } = require('./passwords');

/**
 * Startup checks on staff accounts:
 * - First boot: creates the super admin from ADMIN_USERNAME / ADMIN_PASSWORD when there is no staff
 *   account at all. Afterwards passwords are changed in the app (or with scripts/resetAdmin.js).
 * - Upgrade from the single-admin version: accounts without a role become admins, and when no super
 *   admin exists the oldest account becomes one, so there is always someone who can manage Setup
 *   and the team. Idempotent.
 * A failure is logged, not fatal: the site still serves the public pages.
 */
const seedAdmin = async () => {
  try {
    if (!(await Admin.exists({}))) {
      const { username, password } = config().adminSeed;
      if (!username || !password) {
        console.warn('Warning: ADMIN_USERNAME or ADMIN_PASSWORD not set. Skipping initial admin seed.');
        console.warn('To create an admin, run: node scripts/resetAdmin.js');
        return;
      }
      await Admin.create({
        username: username.toLowerCase(),
        name: 'Super admin',
        role: 'super_admin',
        passwordHash: await hashPassword(password),
      });
      console.log(`Super admin "${username}" created.`);
      return;
    }

    await Admin.updateMany({ role: { $exists: false } }, { $set: { role: 'admin' } });
    if (!(await Admin.exists({ role: 'super_admin', active: { $ne: false } }))) {
      const oldest = await Admin.findOne({ active: { $ne: false } }).sort({ createdAt: 1, _id: 1 }).select('_id username').lean();
      if (oldest) {
        await Admin.updateOne({ _id: oldest._id }, { $set: { role: 'super_admin' } });
        console.log(`"${oldest.username}" is now the super admin.`);
      }
    } else {
      console.log('Admin already exists, skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
