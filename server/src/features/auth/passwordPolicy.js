const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, STAFF_PASSWORD_MIN_LENGTH } = require('./constants');

/**
 * What makes a new password acceptable (NIST SP 800-63B: length and a blocklist, no composition
 * rules): 8–72 characters (12+ for staff), not a well-known password, and not built from the
 * account's own email name or roll number. Applied when a password is set, never when one is used.
 */

// Common passwords of 8+ characters (shorter ones fail the length rule anyway), including local ones
// an attacker would try first here. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'pass1234', 'pass@123', 'passpass', '12345678', '123456789', '1234567890', '0123456789', '87654321',
  '987654321', '9876543210', '11111111', '00000000', '88888888', '12341234', '11223344', '12121212',
  '123123123', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'q1w2e3r4', 'a1b2c3d4', '1234qwer', 'qwer1234',
  'asdf1234', '123qwe123', 'qwertyui', 'qwerty12', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'asdfasdf',
  'zxcvbnm1', 'qazwsxedc', 'aaaaaaaa', 'abcdefgh', 'abc12345', 'abcd1234', 'iloveyou', 'iloveyou1',
  'sunshine', 'princess', 'football', 'baseball', 'superman', 'batman123', 'starwars', 'whatever',
  'computer', 'internet', 'freedom1', 'welcome1', 'welcome123', 'welcome@123', 'letmein1', 'letmein123',
  'trustno1', 'monkey123', 'dragon123', 'master123', 'shadow123', 'michael1', 'jennifer', 'liverpool',
  'chelsea1', 'arsenal1', 'cricket1', 'admin123', 'admin1234', 'admin@123', 'administrator', 'changeme',
  'changeme1', 'default1', 'test1234', 'testtest', 'demo1234', 'hello123', 'helloworld', 'user1234',
  'login123', 'secret123', 'google123', 'samsung1', 'nokia123', 'india123', 'india@123', 'bharat123',
  'mumbai123', 'delhi123', 'gujarat123', 'ahmedabad', 'ganesh123', 'krishna123', 'omsairam', 'sairam123',
  'jaishreeram', 'charusat', 'charusat123', 'college123', 'student123', 'students', 'placement',
  'placement123', 'placements',
]);

/**
 * Why `password` can't be used, or null when it can.
 * account: { email, rollNumber, username } — whichever the account has; staff: true for staff accounts.
 */
const passwordProblem = (password, { email, rollNumber, username, staff = false } = {}) => {
  if (typeof password !== 'string') return 'Password is required';
  const min = staff ? STAFF_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;
  if (password.length < min || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${min}–${PASSWORD_MAX_LENGTH} characters`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'This password is too common. Please choose another.';

  // Built from the account's own identifiers (only when they are long enough to mean something)
  const own = [email?.split('@')[0], rollNumber, username]
    .filter((v) => typeof v === 'string' && v.length >= 4)
    .map((v) => v.toLowerCase());
  if (own.some((v) => lower.includes(v))) return "Your password can't contain your email name, roll number or username.";
  return null;
};

module.exports = { passwordProblem, COMMON_PASSWORDS };
