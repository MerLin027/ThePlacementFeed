const crypto = require('crypto');
const Session = require('../../models/Session');
const { config } = require('../../config/env');
const {
  SESSION_COOKIE_PRODUCTION,
  SESSION_COOKIE_DEVELOPMENT,
  LEGACY_COOKIES,
  SESSION_LIFETIME_MS,
  STAFF_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} = require('./constants');

/**
 * Server-side sessions. The cookie carries a random 256-bit token and nothing else; the server
 * keeps only its SHA-256 (models/Session.js). So a session ends the moment its row is deleted
 * (logout, password change, reset, account disabled or deleted), there is no signing key to leak,
 * and a copy of the database can't be turned into working cookies.
 *
 * Cookie: httpOnly (no script can read it), SameSite=Lax (other sites' requests don't carry it),
 * Secure and __Host- prefixed in production. The site reaches the API through its own domain
 * (Vercel proxies /api), so the cookie is first-party.
 */

const cookieName = () => (config().isProduction ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_DEVELOPMENT);

const cookieOptions = () => ({
  httpOnly: true,
  secure: config().isProduction,
  sameSite: 'Lax',
  path: '/',
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Old JWT cookies from before server-side sessions: cleared when a browser still sends them
const clearLegacyCookies = (req, res) => {
  for (const name of LEGACY_COOKIES) {
    if (req.cookies?.[name]) res.clearCookie(name, cookieOptions());
  }
};

/**
 * Starts a session for an account ({ type: 'student' | 'staff', id }) and sets the cookie. Always a
 * new token: a session id is never carried over from before sign-in (session fixation).
 */
const createSession = async (req, res, { type, id }) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const lifetime = SESSION_LIFETIME_MS[type];
  await Session.create({
    tokenHash: hashToken(token),
    accountType: type,
    accountId: id,
    expiresAt: new Date(now + lifetime),
    lastUsedAt: new Date(now),
  });
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge: lifetime });
  clearLegacyCookies(req, res);
};

const sessionToken = (req) => {
  const token = req.cookies?.[cookieName()];
  return typeof token === 'string' && token.length > 0 && token.length <= 128 ? token : null;
};

/**
 * The session behind the request's cookie: { present, session }. present is false when there is no
 * cookie; session is null when the cookie is unknown, expired or idle too long (staff).
 */
const readSession = async (req) => {
  const token = sessionToken(req);
  if (!token) return { present: false, session: null };

  const session = await Session.findOne({ tokenHash: hashToken(token) }).lean();
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now) return { present: true, session: null };

  if (session.accountType === 'staff' && now - session.lastUsedAt.getTime() > STAFF_IDLE_TIMEOUT_MS) {
    await Session.deleteOne({ _id: session._id });
    return { present: true, session: null };
  }
  if (now - session.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date(now) } });
  }
  return { present: true, session };
};

// Ends the request's own session (if any) and clears the cookie
const endSession = async (req, res) => {
  const token = sessionToken(req);
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(cookieName(), cookieOptions());
  clearLegacyCookies(req, res);
};

// Ends every session of an account (password change or reset, account disabled or deleted)
const endSessionsFor = ({ type, id }) => Session.deleteMany({ accountType: type, accountId: id });

module.exports = { cookieName, createSession, readSession, endSession, endSessionsFor };
