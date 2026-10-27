const crypto = require('crypto');
const net = require('net');
const { config } = require('../config/env');

const SECRET_HEADER = 'x-tpf-proxy-secret';

const sameSecret = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * The site proxies /api through Vercel (client/vercel.json), so every proxied request reaches the
 * API from a Vercel address and the rate limiters would put all visitors in one bucket. Vercel sends
 * the visitor's address in x-real-ip, but anyone calling the API directly could send that header
 * too. So it is believed only when the request also carries the shared PROXY_SECRET, which Vercel
 * adds on its side: then the visitor's address becomes the forwarded-for entry that `req.ip` reads
 * (`trust proxy` 1). Without the secret (unset, missing or wrong), nothing changes and req.ip stays
 * the address that connected, which a client cannot fake.
 *
 * createTrustedProxy(secret) builds it for a given secret (tests); the default export uses the
 * configured PROXY_SECRET.
 */
const createTrustedProxy = (expected) => (req, res, next) => {
  const given = req.headers[SECRET_HEADER];
  // Never passed further down (logs, error reports)
  delete req.headers[SECRET_HEADER];

  const verified = Boolean(expected && typeof given === 'string' && sameSecret(given, expected));
  const visitor = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].trim() : '';
  const visitorKnown = verified && net.isIP(visitor) !== 0;
  if (visitorKnown) req.headers['x-forwarded-for'] = visitor;

  // How the request arrived, as flags only (never the secret or an address): GET /api/health
  // reports it, to check the Vercel set-up from outside
  req.proxyCheck = {
    secret: !expected ? 'not-configured' : verified ? 'verified' : typeof given === 'string' ? 'wrong' : 'missing',
    visitorAddress: visitorKnown ? 'used' : visitor ? 'ignored' : 'absent',
    // Temporary: how many entries each forwarding header carries (counts only)
    entries: Object.fromEntries(
      ['x-forwarded-for', 'x-vercel-forwarded-for', 'x-vercel-proxied-for', 'forwarded'].map((h) => [
        h,
        typeof req.headers[h] === 'string' ? req.headers[h].split(',').length : 0,
      ])
    ),
  };
  next();
};

let configured = null;
const trustedProxy = (req, res, next) => {
  configured ||= createTrustedProxy(config().proxySecret);
  configured(req, res, next);
};

module.exports = trustedProxy;
module.exports.createTrustedProxy = createTrustedProxy;
