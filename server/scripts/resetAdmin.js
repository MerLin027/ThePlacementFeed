const path = require('path');
// Load server/.env by absolute path so the script works from any folder
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Session = require('../src/models/Session');
const { hashPassword } = require('../src/features/auth/passwords');
const { passwordProblem } = require('../src/features/auth/passwordPolicy');
const { USERNAME_PATTERN } = require('../src/models/Admin');

/**
 * Break-glass access to the one super admin account, for when nobody can sign in as it any more:
 * sets a new password typed here (and optionally a new username), re-enables the account and ends
 * its sessions. When there is no super admin at all, it creates one. It never makes a second one.
 * Admin accounts are left alone (manage them in the website afterwards).
 *
 *   node server/scripts/resetAdmin.js
 *
 * The password is not shown while it is typed. Rules: 12–72 characters, not a common password,
 * not containing the username or email name.
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

  // Everything is typed first; the database is contacted only afterwards
  console.log('\n--- Restore super admin access ---');
  console.log('Leave the username empty to keep the super admin\'s current one.');
  const typed = (await ask('Username: ')).trim().toLowerCase();
  if (typed && !USERNAME_PATTERN.test(typed)) {
    throw new Error('A username is 3–32 letters, digits, dots, hyphens or underscores, starting with a letter or digit.');
  }
  console.log('Password rules: 12–72 characters, not a common password, not containing the username or email name.');
  const password = await askHidden('New password (not shown): ');
  if ((await askHidden('Repeat it: ')) !== password) throw new Error("The passwords don't match.");

  await mongoose.connect(process.env.MONGODB_URI);
  const current = await Admin.findOne({ role: 'super_admin' }).select('username email').lean();
  const username = typed || current?.username;
  if (!username) throw new Error('There is no super admin yet: type a username to create one.');
  if (await Admin.exists({ username, ...(current && { _id: { $ne: current._id } }) })) {
    throw new Error(`"${username}" is used by another account.`);
  }
  const problem = passwordProblem(password, { username, email: current?.email, staff: true });
  if (problem) throw new Error(problem);

  const fields = { username, active: true, passwordHash: await hashPassword(password), mustChangePassword: false };
  const staff = current
    ? await Admin.findByIdAndUpdate(current._id, { $set: fields, $unset: { tempPasswordExpiresAt: '' } }, { returnDocument: 'after' })
    : await Admin.create({ ...fields, role: 'super_admin' });
  await Session.deleteMany({ accountType: 'staff', accountId: staff._id });
  console.log(`\nDone: the super admin signs in as "${username}" with the new password. Its old sessions were ended.`);
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
