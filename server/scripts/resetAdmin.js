require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

const resetAdmin = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('FATAL: MONGODB_URI is not defined in .env');
      process.exit(1);
    }

    console.log('\n--- Admin Credential Rotation ---');
    const newUsername = await askQuestion('Enter new admin username: ');
    
    // Note: Node's basic readline doesn't hide input natively without extra code,
    // but the prompt specified to just use built-in readline keeping it minimal.
    const newPassword = await askQuestion('Enter new admin password: ');

    if (!newUsername || !newPassword) {
      console.error('Error: Username and password cannot be empty.');
      process.exit(1);
    }

    console.log('\nConnecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Removing existing admin records...');
    await Admin.deleteMany({});
    
    console.log('Hashing password and saving new admin...');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await Admin.create({ 
      username: newUsername.toLowerCase(), 
      passwordHash 
    });

    console.log(`\nSUCCESS: Admin credentials updated successfully.`);
    console.log('You can now log in with the new credentials.');
    
  } catch (error) {
    console.error('\nError resetting admin:', error.message);
  } finally {
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
};

resetAdmin();
