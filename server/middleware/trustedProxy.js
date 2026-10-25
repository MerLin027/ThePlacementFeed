const crypto = require('crypto');
const net = require('net');

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
 */
const trustedProxy = (req, res, next) => {
  const expected = process.env.PROXY_SECRET;
  const given = req.headers[SECRET_HEADER];
  // Never passed further down (logs, error reports)
  delete req.headers[SECRET_HEADER];

  if (expected && typeof given === 'string' && sameSecret(given, expected)) {
    const visitor = req.headers['x-real-ip'];
    if (typeof visitor === 'string' && net.isIP(visitor.trim())) {
      req.headers['x-forwarded-for'] = visitor.trim();
    }
  }
  next();
};

module.exports = trustedProxy;
