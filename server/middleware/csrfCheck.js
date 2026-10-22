/**
 * CSRF protection via Origin/Referer header check.
 * Required because SameSite=None (cross-domain Vercel↔Render) removes
 * the browser's built-in CSRF protection.
 *
 * Applied to all mutating routes (POST/PUT/PATCH/DELETE).
 *
 * The origin is parsed and compared for exact equality. A prefix check
 * would let lookalike hosts through (e.g. https://app.vercel.app.evil.com).
 */
const getOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const csrfCheck = (req, res, next) => {
  const allowedOrigin = getOrigin(process.env.CLIENT_URL);

  // Check Origin header first, fall back to Referer
  const requestOrigin = getOrigin(req.headers.origin || req.headers.referer);

  if (!allowedOrigin || !requestOrigin || requestOrigin !== allowedOrigin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }

  next();
};

module.exports = csrfCheck;
