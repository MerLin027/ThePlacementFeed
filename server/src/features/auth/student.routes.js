const express = require('express');
const Student = require('../../models/Student');
const csrfCheck = require('../../middleware/csrf');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { studentSignupRules, studentLoginRules, studentChangePasswordRules } = require('./validators');
const { requireStudentAllowPending, sessionProbe } = require('./guards');
const { issueSession, endSession } = require('./sessions');
const { hashPassword, verifyPassword } = require('./passwords');

const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with these details already exists. If this is you, try logging in — or ask the CDPC admin for help.';

const invalidSession = (res) => res.status(401).json({ success: false, message: 'Invalid or expired session' });

// The student's session: sign up, log in, log out, "who am I"
const authRouter = express.Router();

// POST …/signup
authRouter.post('/signup', limit('studentSignup'), csrfCheck, studentSignupRules, validate, async (req, res, next) => {
  try {
    const { email, rollNumber, password } = req.body;
    const passwordHash = await hashPassword(password);

    let student;
    try {
      student = await Student.create({ email, rollNumber, passwordHash });
    } catch (error) {
      // Same message for a taken email or roll number
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: DUPLICATE_ACCOUNT_MESSAGE });
      }
      throw error;
    }

    issueSession(res, 'student', student);
    res.status(201).json({
      success: true,
      message: 'Account created',
      mustChangePassword: false,
    });
  } catch (error) {
    next(error);
  }
});

// POST …/login
authRouter.post(
  '/login',
  limit('studentLoginAddress'),
  limit('studentLoginAccount'),
  csrfCheck,
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
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      issueSession(res, 'student', student);
      res.json({
        success: true,
        message: 'Login successful',
        mustChangePassword: student.mustChangePassword,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST …/logout — clearing a cookie needs no session
authRouter.post('/logout', limit('studentSession'), csrfCheck, (req, res) => {
  endSession(res, 'student');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
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
  csrfCheck,
  requireStudentAllowPending,
  limit('studentPassword'),
  studentChangePasswordRules,
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const student = await Student.findById(req.student.id).select('+passwordHash');
      if (!student) return invalidSession(res);

      if (student.mustChangePassword) {
        // Logging in checks the 72 h window, but a restricted session can outlive it
        if (student.tempPasswordExpiresAt && student.tempPasswordExpiresAt < new Date()) {
          endSession(res, 'student');
          return res.status(401).json({
            success: false,
            code: 'TEMP_PASSWORD_EXPIRED',
            message: 'Your temporary password has expired. Ask the CDPC admin to reset it again.',
          });
        }
      } else if (!(await verifyPassword(currentPassword, student.passwordHash))) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
        });
      }

      student.passwordHash = await hashPassword(newPassword);
      student.mustChangePassword = false;
      student.tempPasswordExpiresAt = undefined;
      // Revoke every other session, then hand this one a fresh token
      student.tokenVersion += 1;
      await student.save();

      issueSession(res, 'student', student);
      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = { authRouter, passwordRouter };
