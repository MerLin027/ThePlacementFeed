const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      console.log('Admin already exists, skipping seed.');
      return;
    }

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      console.warn('Warning: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env. Skipping initial admin seed.');
      console.warn('To create an admin, run: node scripts/resetAdmin.js');
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    await Admin.create({ username: username.toLowerCase(), passwordHash });
    console.log(`Admin user "${username}" created successfully.`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    // Don't crash if seed fails, just log it.
  }
};

module.exports = seedAdmin;
