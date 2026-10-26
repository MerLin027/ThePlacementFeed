const express = require('express');
const Admin = require('../../models/Admin');
const csrfCheck = require('../../middleware/csrf');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { adminChangePasswordRules } = require('./validators');
const { requireAdmin, sessionProbe } = require('./guards');
const { issueSession, endSession } = require('./sessions');
const { hashPassword, verifyPassword } = require('./passwords');

// The admin's session: log in, log out, "who am I"
const authRouter = express.Router();

const issueAdminSession = (res, admin) => issueSession(res, 'admin', admin, { username: admin.username });

// POST …/login
authRouter.post('/login', limit('adminLogin'), csrfCheck, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Strings only: an object here (e.g. {"$ne": null}) must be a 400, not a crash or a query operator
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase() });
    // Runs the full bcrypt work even for an unknown username (no timing difference)
    const isMatch = await verifyPassword(password, admin?.passwordHash);
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

// POST …/logout
authRouter.post('/logout', csrfCheck, (req, res) => {
  endSession(res, 'admin');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET …/check — no cookie → 200 { authenticated: false }; a bad cookie → 401
authRouter.get('/check', sessionProbe('admin'), requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    username: req.admin.username,
  });
});

// The admin's own password (the session guard runs inside)
const passwordRouter = express.Router();

// POST …/password — signs out every other admin session; this one gets a fresh token. The limiter
// runs after validation, so it counts wrong current passwords only (malformed requests never reach
// bcrypt), and skips successes.
passwordRouter.post('/password', csrfCheck, requireAdmin, adminChangePasswordRules, validate, limit('adminPassword'), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
      });
    }

    admin.passwordHash = await hashPassword(newPassword);
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();

    issueAdminSession(res, admin);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

module.exports = { authRouter, passwordRouter };
