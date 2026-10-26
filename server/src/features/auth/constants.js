// Shared auth constants for student and staff (admin) accounts.

// One session cookie per browser. In production the __Host- prefix makes the browser insist on
// Secure, Path=/ and no Domain, so no other site or subdomain can set or overwrite it.
const SESSION_COOKIE_PRODUCTION = '__Host-tpf_session';
const SESSION_COOKIE_DEVELOPMENT = 'tpf_session';
// Cookies from before server-side sessions; cleared when seen
const LEGACY_COOKIES = ['admin_token', 'student_token'];

// How long a session lasts: an absolute limit, and for staff an idle limit too
const SESSION_LIFETIME_MS = {
  student: 7 * 24 * 60 * 60 * 1000, // 7 days
  staff: 3 * 60 * 60 * 1000, // 3 hours
};
const STAFF_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour without a request
// lastUsedAt is written at most this often (it only matters for the idle limit)
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

// bcrypt silently truncates input beyond 72 bytes, so cap it explicitly
const PASSWORD_MIN_LENGTH = 8;
// Staff accounts can see every student's details: a longer minimum
const STAFF_PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 72;
const BCRYPT_COST = 12;

// How long a one-time password (admin reset, new staff account) can be used. It only grants access
// to the change-password flow (see guards.js).
const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

module.exports = {
  SESSION_COOKIE_PRODUCTION,
  SESSION_COOKIE_DEVELOPMENT,
  LEGACY_COOKIES,
  SESSION_LIFETIME_MS,
  STAFF_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  PASSWORD_MIN_LENGTH,
  STAFF_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  BCRYPT_COST,
  TEMP_PASSWORD_TTL_MS,
};
