const { config } = require('../config/env');
const { fail } = require('../lib/http');

/**
 * Cross-site request forgery protection for every state-changing request (POST, PUT, PATCH,
 * DELETE) on the API, applied once in app.js so no route can be left out. Three independent layers:
 *
 *  1. Origin check (here): the request must come from the website's own origin (Origin header,
 *     or Referer when a browser leaves Origin out). Parsed and compared for exact equality; a prefix
 *     check would let lookalike hosts through (e.g. https://app.vercel.app.evil.com).
 *  2. JSON only (jsonOnly below): a request with a body must be application/json. HTML forms can't
 *     send that cross-site without a CORS preflight, which CORS refuses for other origins.
 *  3. SameSite=Lax session cookies (features/auth/sessions.js): other sites' requests don't carry them.
 *
 * Safe methods (GET, HEAD, OPTIONS) must not change anything and are not checked.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const allowed = config().clientOrigin;
  const origin = originOf(req.headers.origin || req.headers.referer);
  if (!allowed || !origin || origin !== allowed) {
    return fail(res, 403, 'Forbidden', { code: 'CSRF_REJECTED' });
  }
  next();
};

// A body is present when the client says so (Content-Length > 0 or a chunked transfer)
const hasBody = (req) =>
  req.headers['transfer-encoding'] !== undefined || (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0');

const jsonOnly = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || !hasBody(req) || req.is('application/json')) return next();
  return fail(res, 415, 'Requests must be sent as JSON (Content-Type: application/json).');
};

module.exports = { csrfProtection, jsonOnly };
