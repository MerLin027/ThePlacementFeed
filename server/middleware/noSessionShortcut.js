// For the session probes (GET /api/auth/check, /api/students/auth/check): with no session cookie at
// all, the visitor is simply logged out, so answer 200 { authenticated: false } instead of 401.
// Every page asks both probes on load, and a 401 there showed up as a console error for every guest
// (and for students on the admin probe, the admin on the student one). A cookie that is present but
// expired, forged, revoked or of the wrong role still reaches the real guard and gets its 401.
const noSessionShortcut = (cookieName) => (req, res, next) => {
  if (!req.cookies?.[cookieName]) {
    return res.json({ success: true, authenticated: false });
  }
  next();
};

module.exports = noSessionShortcut;
