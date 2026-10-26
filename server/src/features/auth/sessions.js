const jwt = require('jsonwebtoken');
const { config } = require('../../config/env');
const {
  ADMIN_COOKIE,
  STUDENT_COOKIE,
  ADMIN_SESSION_MS,
  STUDENT_SESSION_MS,
  JWT_ALGORITHM,
} = require('./constants');

/**
 * Session cookies for both roles. The site reaches the API through its own domain (Vercel proxies
 * /api to Render), so the cookies are first-party: SameSite=Lax keeps other sites' requests from
 * carrying them, on top of the Origin check (middleware/csrf.js). Secure in production.
 * Clearing a cookie requires the same options it was set with (minus maxAge).
 */
const clearCookieOptions = () => ({
  httpOnly: true,
  secure: config().isProduction,
  sameSite: 'Lax',
  path: '/',
});

const ROLES = {
  admin: { cookie: ADMIN_COOKIE, maxAge: ADMIN_SESSION_MS, expiresIn: '3h' },
  student: { cookie: STUDENT_COOKIE, maxAge: STUDENT_SESSION_MS, expiresIn: '7d' },
};

// Signs a token bound to the account's current tokenVersion and sets it as the session cookie.
// Bumping tokenVersion in the database revokes every token issued before it.
const issueSession = (res, role, account, extraClaims = {}) => {
  const { cookie, maxAge, expiresIn } = ROLES[role];
  const token = jwt.sign(
    { sub: account._id.toString(), role, tv: account.tokenVersion ?? 0, ...extraClaims },
    config().jwtSecret,
    { expiresIn, algorithm: JWT_ALGORITHM }
  );
  res.cookie(cookie, token, { ...clearCookieOptions(), maxAge });
};

const endSession = (res, role) => {
  res.clearCookie(ROLES[role].cookie, clearCookieOptions());
};

// The verified claims of a role's session cookie, or null when missing, expired, forged or another role's
const readSession = (req, role) => {
  const token = req.cookies?.[ROLES[role].cookie];
  if (!token) return { present: false, claims: null };
  try {
    const claims = jwt.verify(token, config().jwtSecret, { algorithms: [JWT_ALGORITHM] });
    return { present: true, claims: claims.role === role ? claims : null };
  } catch {
    return { present: true, claims: null };
  }
};

module.exports = { issueSession, endSession, readSession, clearCookieOptions };
