const crypto = require('crypto');

// Letters and digits that can't be confused when read aloud or copied by hand (no 0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

/**
 * A one-time password for an admin reset or a new staff account, e.g. "Xk7m-Qp2r-Hn4t":
 * 12 characters from 54 (about 69 bits of randomness), from the operating system's secure random
 * source. The admin sees it once and passes it on; it only opens the change-password page, for
 * 72 hours.
 */
const generateTempPassword = () =>
  Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_LENGTH }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')
  ).join('-');

module.exports = { generateTempPassword };
