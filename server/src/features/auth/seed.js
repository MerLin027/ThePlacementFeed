const Admin = require('../../models/Admin');
const { config } = require('../../config/env');
const { hashPassword } = require('./passwords');

// First boot only: creates the admin account from ADMIN_USERNAME / ADMIN_PASSWORD when there is
// none. Afterwards the admin changes the password in the app, or an operator runs
// scripts/resetAdmin.js. A failure is logged, not fatal: the site still serves the public pages.
const seedAdmin = async () => {
  try {
    if (await Admin.exists({})) {
      console.log('Admin already exists, skipping seed.');
      return;
    }

    const { username, password } = config().adminSeed;
    if (!username || !password) {
      console.warn('Warning: ADMIN_USERNAME or ADMIN_PASSWORD not set. Skipping initial admin seed.');
      console.warn('To create an admin, run: node scripts/resetAdmin.js');
      return;
    }

    await Admin.create({ username: username.toLowerCase(), passwordHash: await hashPassword(password) });
    console.log(`Admin user "${username}" created successfully.`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
