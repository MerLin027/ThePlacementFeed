const express = require('express');
const Student = require('../../models/Student');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { record } = require('../audit/service');
const { studentSignupRules, studentLoginRules, studentChangePasswordRules } = require('./validators');
const { requireStudentAllowPending, sessionProbe } = require('./guards');
const { issueSession, endSession } = require('./sessions');
const { hashPassword, verifyPassword } = require('./passwords');
const { passwordProblem } = require('./passwordPolicy');

const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with these details already exists. If this is you, try logging in — or ask the CDPC admin for help.';

const invalidSession = (res) => fail(res, 401, 'Invalid or expired session');

// The student's session: sign up, log in, log out, "who am I"
const authRouter = express.Router();

// POST …/signup
authRouter.post('/signup', limit('studentSignup'), studentSignupRules, validate, async (req, res, next) => {
  try {
    const { email, rollNumber, password } = req.body;
    const problem = passwordProblem(password, { email, rollNumber });
    if (problem) return fieldError(res, 'password', problem);

    let student;
    try {
      student = await Student.create({ email, rollNumber, passwordHash: await hashPassword(password) });
    } catch (error) {
      // Same message for a taken email or roll number
      if (error.code === 11000) return fail(res, 409, DUPLICATE_ACCOUNT_MESSAGE, { code: 'ACCOUNT_EXISTS' });
      throw error;
    }

    issueSession(res, 'student', student);
    await record(req, 'student.signup', { actor: { type: 'student', id: student._id } });
    res.status(201).json({ success: true, message: 'Account created', mustChangePassword: false });
  } catch (error) {
    next(error);
  }
});

// POST …/login
authRouter.post(
  '/login',
  limit('studentLoginAddress'),
  limit('studentLoginAccount'),
  studentLoginRules,
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const student = await Student.findOne({ email }).select('+passwordHash');
      // Runs the full bcrypt work even for an unknown email (no timing difference)
      const isMatch = await verifyPassword(password, student?.passwordHash);

      // An expired temporary password is treated exactly like a wrong password
      const tempPasswordExpired =
        student?.mustChangePassword &&
        student.tempPasswordExpiresAt &&
        student.tempPasswordExpiresAt < new Date();

      if (!student || !isMatch || tempPasswordExpired) {
        // Failures against a real account are recorded with its id; the attempted email never is
        if (student) await record(req, 'student.login', { outcome: 'failure', actor: { type: 'student', id: student._id } });
        return fail(res, 401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
      }

      issueSession(res, 'student', student);
      res.json({ success: true, message: 'Login successful', mustChangePassword: student.mustChangePassword });
    } catch (error) {
      next(error);
    }
  }
);

// POST …/logout — clearing a cookie needs no session
authRouter.post('/logout', limit('studentSession'), (req, res) => {
  endSession(res, 'student');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET …/check — allowed while a password change is pending.
// No cookie → 200 { authenticated: false } (still rate-limited); a bad cookie → 401.
authRouter.get('/check', limit('studentSession'), sessionProbe('student'), requireStudentAllowPending, async (req, res, next) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) return invalidSession(res);

    res.json({
      success: true,
      authenticated: true,
      student: {
        id: student._id.toString(),
        email: student.email,
        firstName: student.firstName ?? '',
        // Academic fields let the UI pre-check drive eligibility (the server re-checks on apply)
        branch: student.branch ?? '',
        cgpa: student.cgpa ?? null,
        activeBacklogs: student.activeBacklogs ?? 0,
        missingFields: student.getMissingFields(),
        mustChangePassword: student.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
});

// The student's own password — also the way out of a restricted (reset) session, where the current
// (temporary) password isn't asked for again
const passwordRouter = express.Router();

passwordRouter.post(
  '/password',
  requireStudentAllowPending,
  limit('studentPassword'),
  studentChangePasswordRules,
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const student = await Student.findById(req.student.id).select('+passwordHash');
      if (!student) return invalidSession(res);
      const target = { type: 'student', id: student._id };

      if (student.mustChangePassword) {
        // Logging in checks the 72 h window, but a restricted session can outlive it
        if (student.tempPasswordExpiresAt && student.tempPasswordExpiresAt < new Date()) {
          endSession(res, 'student');
          return fail(res, 401, 'Your temporary password has expired. Ask the CDPC admin to reset it again.', { code: 'TEMP_PASSWORD_EXPIRED' });
        }
        // Someone else (the admin) knows the temporary password, so it can't become the real one
        if (await verifyPassword(newPassword, student.passwordHash)) {
          return fieldError(res, 'newPassword', 'Your new password must be different from the temporary one');
        }
      } else if (!(await verifyPassword(currentPassword, student.passwordHash))) {
        res.locals.wrongPassword = true;
        await record(req, 'student.password.change', { outcome: 'failure', target });
        return fieldError(res, 'currentPassword', 'Current password is incorrect');
      }

      const problem = passwordProblem(newPassword, { email: student.email, rollNumber: student.rollNumber });
      if (problem) return fieldError(res, 'newPassword', problem);

      const wasReset = student.mustChangePassword;
      student.passwordHash = await hashPassword(newPassword);
      student.mustChangePassword = false;
      student.tempPasswordExpiresAt = undefined;
      // Revoke every other session, then hand this one a fresh token
      student.tokenVersion += 1;
      await student.save();

      issueSession(res, 'student', student);
      await record(req, 'student.password.change', { target, details: { afterReset: wasReset } });
      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = { authRouter, passwordRouter };
