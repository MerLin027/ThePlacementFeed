const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const requireAdmin = require('../middleware/requireAdmin');
const noSessionShortcut = require('../middleware/noSessionShortcut');
const csrfCheck = require('../middleware/csrfCheck');
const { adminChangePasswordRules, validate } = require('../middleware/validate');
const { getCookieOptions, getClearCookieOptions } = require('../utils/cookies');
const { ADMIN_COOKIE, ADMIN_SESSION_MS, JWT_ALGORITHM, BCRYPT_COST } = require('../constants/auth');

const router = express.Router();

// Signs an admin JWT bound to the current tokenVersion and sets it as the session cookie
const issueAdminSession = (res, admin) => {
  const token = jwt.sign(
    { sub: admin._id.toString(), role: 'admin', username: admin.username, tv: admin.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '3h', algorithm: JWT_ALGORITHM }
  );
  res.cookie(ADMIN_COOKIE, token, getCookieOptions(ADMIN_SESSION_MS));
};

// Rate limit login attempts: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, csrfCheck, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Strings only: an object here (e.g. {"$ne": null}) must be a 400, not a crash or a query operator
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Find admin by username
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    let isMatch = false;
    if (admin) {
      // Compare password
      isMatch = await bcrypt.compare(password, admin.passwordHash);
    } else {
      // Dummy compare to mitigate timing attacks (cost factor 12)
      await bcrypt.compare(password, '$2a$12$GKh7blGTmDJaRLvz9YzfR.mNa5ByAsSvWCpRnGbSpYlJG1.9g0x1u');
    }

    if (!admin || !isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    issueAdminSession(res, admin);

    res.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', csrfCheck, (req, res) => {
  // Must use same options as set (minus maxAge) for browser to clear
  res.clearCookie(ADMIN_COOKIE, getClearCookieOptions());

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/check — verify if current cookie is valid.
// No cookie → 200 { authenticated: false }; a bad cookie → 401.
router.get('/check', noSessionShortcut(ADMIN_COOKIE), requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    username: req.admin.username,
  });
});

// Counts wrong current passwords only: it runs after validation (malformed requests never reach
// bcrypt) and skips successes; keyed by admin (it runs after auth)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.admin.id,
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/password — signs out every other admin session; this one gets a fresh token
router.post('/password', csrfCheck, requireAdmin, adminChangePasswordRules, validate, passwordLimiter, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
      });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();

    issueAdminSession(res, admin);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
