const express = require('express');
const Admin = require('../../models/Admin');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { record } = require('../audit/service');
const { adminLoginRules, adminChangePasswordRules } = require('./validators');
const { requireAdmin, sessionProbe } = require('./guards');
const { issueSession, endSession } = require('./sessions');
const { hashPassword, verifyPassword } = require('./passwords');
const { passwordProblem } = require('./passwordPolicy');

// The admin's session: log in, log out, "who am I"
const authRouter = express.Router();

const issueAdminSession = (res, admin) => issueSession(res, 'admin', admin, { username: admin.username });

// POST …/login
authRouter.post('/login', limit('adminLogin'), adminLoginRules, validate, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username }).select('+passwordHash');
    // Runs the full bcrypt work even for an unknown username (no timing difference)
    const isMatch = await verifyPassword(password, admin?.passwordHash);
    if (!admin || !isMatch) {
      // The attempted username is not recorded (it may be a mistyped password)
      await record(req, 'admin.login', { outcome: 'failure', ...(admin && { actor: { type: 'admin', id: admin._id } }) });
      return fail(res, 401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
    }

    issueAdminSession(res, admin);
    await record(req, 'admin.login', { actor: { type: 'admin', id: admin._id } });
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
});

// POST …/logout
authRouter.post('/logout', (req, res) => {
  endSession(res, 'admin');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET …/check — no cookie → 200 { authenticated: false }; a bad cookie → 401
authRouter.get('/check', sessionProbe('admin'), requireAdmin, (req, res) => {
  res.json({ success: true, authenticated: true, username: req.admin.username });
});

// The admin's own password (the session guard runs inside)
const passwordRouter = express.Router();

// POST …/password — signs out every other admin session; this one gets a fresh token. The limiter
// counts wrong current passwords only (see rateLimit.js); malformed requests never reach bcrypt.
passwordRouter.post('/password', requireAdmin, adminChangePasswordRules, validate, limit('adminPassword'), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id).select('+passwordHash');
    if (!admin) return fail(res, 401, 'Invalid or expired token');

    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      res.locals.wrongPassword = true;
      await record(req, 'admin.password.change', { outcome: 'failure', target: { type: 'admin', id: admin._id } });
      return fieldError(res, 'currentPassword', 'Current password is incorrect');
    }
    const problem = passwordProblem(newPassword, { username: admin.username, admin: true });
    if (problem) return fieldError(res, 'newPassword', problem);

    admin.passwordHash = await hashPassword(newPassword);
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    await admin.save();

    issueAdminSession(res, admin);
    await record(req, 'admin.password.change', { target: { type: 'admin', id: admin._id } });
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

module.exports = { authRouter, passwordRouter };
