const express = require('express');
const Admin = require('../../models/Admin');
const Student = require('../../models/Student');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { record } = require('../audit/service');
const { loginRules, signupRules, changePasswordRules } = require('./validators');
const { requireAnyAccountAllowPending } = require('./guards');
const { createSession, endSession, endSessionsFor } = require('./sessions');
const { hashPassword, verifyPassword } = require('./passwords');
const { passwordProblem } = require('./passwordPolicy');
const { findByIdentifier, emailInUse, describeAccount, loadAccountDoc, loadAccountDocWithPassword } = require('./accounts');

// Mounted at /api/auth — one place to sign in, out and up, for students and staff alike
const router = express.Router();

const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with these details already exists. If this is you, try logging in — or ask the CDPC admin for help.';

const invalidCredentials = (res) => fail(res, 401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });

const tempPasswordExpired = (doc) =>
  Boolean(doc.mustChangePassword && doc.tempPasswordExpiresAt && doc.tempPasswordExpiresAt < new Date());

const sessionLimiter = limit('session');

// POST /signup — students only; staff accounts are created by a super admin
router.post('/signup', limit('studentSignup'), signupRules, validate, async (req, res, next) => {
  try {
    const { email, rollNumber, password } = req.body;
    const problem = passwordProblem(password, { email, rollNumber });
    if (problem) return fieldError(res, 'password', problem);

    // Same answer whether the email or the roll number is taken, or the email is a staff account's
    if (await Admin.exists({ email })) return fail(res, 409, DUPLICATE_ACCOUNT_MESSAGE, { code: 'ACCOUNT_EXISTS' });
    let student;
    try {
      student = await Student.create({ email, rollNumber, passwordHash: await hashPassword(password) });
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, DUPLICATE_ACCOUNT_MESSAGE, { code: 'ACCOUNT_EXISTS' });
      throw error;
    }

    await createSession(req, res, { type: 'student', id: student._id });
    await record(req, 'auth.signup', { actor: { type: 'student', id: student._id } });
    res.status(201).json({ success: true, message: 'Account created', account: describeAccount('student', student) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /login { identifier, password } — a student's email, or a staff member's username or email.
 * Every failure (unknown, wrong password, disabled, expired one-time password, an identifier that
 * matches two accounts) gets the same answer after the same bcrypt work, so nothing about which
 * accounts exist leaks out.
 */
router.post('/login', limit('login'), limit('loginAccount'), loginRules, validate, async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const { staff, student } = await findByIdentifier(identifier);
    if (staff && student) console.error('[Auth] An email matches a staff and a student account; sign-in refused.');
    const account = staff && student ? null : staff || student;
    const type = staff ? 'staff' : 'student';

    const isMatch = await verifyPassword(password, account?.passwordHash);
    const blocked = account && ((type === 'staff' && account.active === false) || tempPasswordExpired(account));
    if (!account || !isMatch || blocked) {
      // Failures against a real account are recorded with its id; the identifier typed never is
      if (account) await record(req, 'auth.login', { outcome: 'failure', actor: { type, id: account._id } });
      return invalidCredentials(res);
    }

    await createSession(req, res, { type, id: account._id });
    if (type === 'staff') await Admin.updateOne({ _id: account._id }, { $set: { lastLoginAt: new Date() } });
    await record(req, 'auth.login', { actor: { type, id: account._id } });
    res.json({ success: true, message: 'Login successful', account: describeAccount(type, account) });
  } catch (error) {
    next(error);
  }
});

// POST /logout — ends this browser's session (no session needed to call it)
router.post('/logout', sessionLimiter, async (req, res, next) => {
  try {
    if (req.account) await record(req, 'auth.logout');
    await endSession(req, res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /session — who is signed in here. Signed out (or an expired session) is a normal answer, not an
// error: { authenticated: false }; expired: true tells the website to say why.
router.get('/session', sessionLimiter, async (req, res, next) => {
  try {
    if (!req.account) {
      if (req.sessionState === 'invalid') await endSession(req, res);
      return res.json({ success: true, authenticated: false, ...(req.sessionState === 'invalid' && { expired: true }) });
    }
    const doc = await loadAccountDoc(req.account.type, req.account.id);
    if (!doc) return res.json({ success: true, authenticated: false, expired: true });
    res.json({ success: true, authenticated: true, account: describeAccount(req.account.type, doc) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /password — any signed-in account changes its own password. After a reset (or for a new
 * staff account) the one-time password isn't asked for again, and can't be kept. Ends every other
 * session of the account and starts a fresh one here.
 */
router.post('/password', requireAnyAccountAllowPending, limit('password'), changePasswordRules, validate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { type, id } = req.account;
    const doc = await loadAccountDocWithPassword(type, id);
    if (!doc) return fail(res, 401, 'Invalid or expired session', { code: 'SESSION_EXPIRED' });
    const target = { type, id: doc._id };

    if (doc.mustChangePassword) {
      // Signing in checks the 72 h window, but a session can outlive it
      if (tempPasswordExpired(doc)) {
        await endSession(req, res);
        return fail(res, 401, 'Your temporary password has expired. Ask the CDPC admin to reset it again.', { code: 'TEMP_PASSWORD_EXPIRED' });
      }
      // Someone else (the admin) knows the one-time password, so it can't become the real one
      if (await verifyPassword(newPassword, doc.passwordHash)) {
        return fieldError(res, 'newPassword', 'Your new password must be different from the temporary one');
      }
    } else if (!(await verifyPassword(currentPassword, doc.passwordHash))) {
      res.locals.wrongPassword = true;
      await record(req, 'auth.password.change', { outcome: 'failure', target });
      return fieldError(res, 'currentPassword', 'Current password is incorrect');
    }

    const problem = passwordProblem(newPassword, {
      email: doc.email,
      rollNumber: doc.rollNumber,
      username: doc.username,
      staff: type === 'staff',
    });
    if (problem) return fieldError(res, 'newPassword', problem);

    const wasPending = Boolean(doc.mustChangePassword);
    doc.passwordHash = await hashPassword(newPassword);
    doc.mustChangePassword = false;
    doc.tempPasswordExpiresAt = undefined;
    await doc.save();

    // Every other device is signed out; this one gets a new session
    await endSessionsFor({ type, id: doc._id });
    await createSession(req, res, { type, id: doc._id });
    await record(req, 'auth.password.change', { target, details: { afterReset: wasPending } });
    res.json({ success: true, message: 'Password updated', account: describeAccount(type, doc) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
