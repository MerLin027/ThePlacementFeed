// Shared auth constants for admin and student sessions.

const ADMIN_COOKIE = 'admin_token';
const STUDENT_COOKIE = 'student_token';

const ADMIN_SESSION_MS = 3 * 60 * 60 * 1000; // 3 hours
const STUDENT_SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const JWT_ALGORITHM = 'HS256';

// bcrypt silently truncates input beyond 72 bytes, so cap it explicitly
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const BCRYPT_COST = 12;

// How long a temporary password from an admin reset can be used. It only grants access to the
// change-password flow (see guards.js).
const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

module.exports = {
  ADMIN_COOKIE,
  STUDENT_COOKIE,
  ADMIN_SESSION_MS,
  STUDENT_SESSION_MS,
  JWT_ALGORITHM,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  BCRYPT_COST,
  TEMP_PASSWORD_TTL_MS,
};
