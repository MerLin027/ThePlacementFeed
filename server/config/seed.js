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

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    await Admin.create({ username: username.toLowerCase(), passwordHash });
    console.log(`Admin user "${username}" created successfully.`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
};

module.exports = seedAdmin;
