const crypto = require('crypto');
const net = require('net');
const { config } = require('../config/env');
const { fail } = require('../lib/http');

const SECRET_HEADER = 'x-tpf-proxy-secret';
// The visitor's address as Vercel saw it. Vercel sets this header itself: a value a visitor sends
// is replaced (checked on production, 2026-10-27). Not x-forwarded-for, whose first entries carry
// whatever the visitor put there, and not x-real-ip, which Vercel doesn't send to the API.
const VISITOR_HEADER = 'x-vercel-forwarded-for';
// Reachable without the proxy: Render's health check calls the API directly
const OPEN_PATHS = new Set(['/api/health']);

const sameSecret = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * The website proxies /api through Vercel (client/vercel.json), which adds the shared PROXY_SECRET
 * to every request it forwards; visitors never see it. This middleware:
 * - checks the secret (in constant time) and removes it, so it never reaches logs or handlers;
 * - with the right secret, makes the visitor's address (VISITOR_HEADER) the request's address
 *   (`req.ip`, with `trust proxy` 1), so rate limits and the audit trail see each visitor rather
 *   than Vercel's or Render's machines;
 * - `required` (production): refuses every request without the right secret, so nobody can reach
 *   the API around the website (and around Vercel's protections), except OPEN_PATHS;
 * - sets req.viaWebsite, which GET /api/health reports.
 *
 * createTrustedProxy(secret, options) builds it (tests); the default export uses the configuration.
 */
const createTrustedProxy = (expected, { required = false } = {}) => (req, res, next) => {
  const given = req.headers[SECRET_HEADER];
  delete req.headers[SECRET_HEADER];

  const verified = Boolean(expected && typeof given === 'string' && sameSecret(given, expected));
  req.viaWebsite = verified;

  if (verified) {
    const visitor = typeof req.headers[VISITOR_HEADER] === 'string' ? req.headers[VISITOR_HEADER].trim() : '';
    if (net.isIP(visitor)) req.headers['x-forwarded-for'] = visitor;
    return next();
  }
  if (required && !OPEN_PATHS.has(req.path)) {
    return fail(res, 403, 'This API is only available through the website.', { code: 'DIRECT_ACCESS' });
  }
  next();
};

let configured = null;
const trustedProxy = (req, res, next) => {
  if (!configured) {
    const { proxySecret, requireProxy } = config();
    configured = createTrustedProxy(proxySecret, { required: requireProxy });
  }
  configured(req, res, next);
};

module.exports = trustedProxy;
module.exports.createTrustedProxy = createTrustedProxy;
