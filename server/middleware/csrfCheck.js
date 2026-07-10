/**
 * CSRF protection via Origin/Referer header check.
 * Required because SameSite=None (cross-domain Vercel↔Render) removes
 * the browser's built-in CSRF protection.
 *
 * Applied to all mutating routes (POST/PUT/DELETE).
 */
const csrfCheck = (req, res, next) => {
  const allowedOrigin = process.env.CLIENT_URL;

  // Check Origin header first, fall back to Referer
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const requestOrigin = origin || referer;

  if (!requestOrigin || !requestOrigin.startsWith(allowedOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }

  next();
};

module.exports = csrfCheck;
