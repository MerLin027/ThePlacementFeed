const bcrypt = require('bcryptjs');
const { BCRYPT_COST } = require('./constants');

// A real cost-12 hash of a random string: comparing against it when the account doesn't exist makes
// "unknown email/username" take as long as "wrong password", so timing doesn't reveal accounts
const DUMMY_HASH = '$2a$12$GKh7blGTmDJaRLvz9YzfR.mNa5ByAsSvWCpRnGbSpYlJG1.9g0x1u';

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

// True when `password` matches; always does the full bcrypt work, even without an account
const verifyPassword = async (password, hash) => {
  const matches = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && matches;
};

module.exports = { hashPassword, verifyPassword };
