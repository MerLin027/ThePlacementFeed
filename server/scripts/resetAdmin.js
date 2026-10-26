const path = require('path');
// Load server/.env by absolute path so the script works from any folder
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Session = require('../src/models/Session');
const { hashPassword } = require('../src/features/auth/passwords');
const { passwordProblem } = require('../src/features/auth/passwordPolicy');

/**
 * Break-glass access: makes one staff account an active super admin with a password typed here, and
 * ends its sessions. For when nobody can sign in as a super admin any more. Other staff accounts
 * are left alone (manage them in the website afterwards).
 *
 *   node server/scripts/resetAdmin.js
 *
 * The username is created if it doesn't exist. The password is not shown while it is typed.
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// Like ask(), but nothing typed is echoed
const askHidden = (question) =>
  new Promise((resolve) => {
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (text.includes(question)) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl._writeToOutput = write;
      process.stdout.write('\n');
      resolve(answer);
    });
  });

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(`MONGODB_URI is not defined in ${path.join(__dirname, '..', '.env')}`);
  }

  console.log('\n--- Restore super admin access ---');
  const username = (await ask('Username: ')).trim().toLowerCase();
  if (!username) throw new Error('A username is required.');
  const password = await askHidden('New password (not shown): ');
  const problem = passwordProblem(password, { username, staff: true });
  if (problem) throw new Error(problem);
  if ((await askHidden('Repeat it: ')) !== password) throw new Error("The passwords don't match.");

  await mongoose.connect(process.env.MONGODB_URI);
  const staff = await Admin.findOneAndUpdate(
    { username },
    {
      $set: { role: 'super_admin', active: true, passwordHash: await hashPassword(password), mustChangePassword: false },
      $unset: { tempPasswordExpiresAt: '' },
      $setOnInsert: { username, name: 'Super admin', createdAt: new Date() },
    },
    { upsert: true, returnDocument: 'after' }
  );
  await Session.deleteMany({ accountType: 'staff', accountId: staff._id });
  console.log(`\nDone: "${username}" is an active super admin with the new password. Its old sessions were ended.`);
};

main()
  .then(() => 0, (error) => {
    console.error(`\nError: ${error.message}`);
    return 1;
  })
  .then(async (exitCode) => {
    rl.close();
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    process.exit(exitCode);
  });
