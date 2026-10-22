const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Student = require('../models/Student');
const csrfCheck = require('../middleware/csrfCheck');
const { requireStudent, requireStudentAllowPending } = require('../middleware/requireStudent');
const { studentProfileRules, changePasswordRules, validate } = require('../middleware/validate');
const { issueStudentSession } = require('../utils/studentSession');
const { BCRYPT_COST } = require('../constants/auth');

const router = express.Router();

// Fields a student may edit. Identity and auth fields are never accepted from the body.
const EDITABLE_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'branch',
  'cgpa',
  'activeBacklogs',
  'historyBacklogs',
  'graduationYear',
  'phone',
  'resumeUrl',
];

const limiterMessage = (message) => ({ success: false, message });

const profileReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Keyed by student (these run after auth) so classmates on one IP don't share a budget
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.student.id,
  message: limiterMessage('Too many updates. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.student.id,
  message: limiterMessage('Too many attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const notFound = (res) =>
  res.status(401).json({ success: false, message: 'Invalid or expired session' });

// GET /api/students/me — allowed while a password change is pending
router.get('/me', profileReadLimiter, requireStudentAllowPending, async (req, res, next) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) return notFound(res);
    res.json({ success: true, data: student.toProfileDTO() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/students/me
router.patch(
  '/me',
  csrfCheck,
  requireStudent,
  profileUpdateLimiter,
  studentProfileRules,
  validate,
  async (req, res, next) => {
    try {
      const student = await Student.findById(req.student.id);
      if (!student) return notFound(res);

      for (const field of EDITABLE_PROFILE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
        const value = req.body[field];
        // Empty string / null clears an optional field
        student.set(field, value === '' || value === null ? undefined : value);
      }

      await student.save();
      res.json({ success: true, data: student.toProfileDTO() });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/students/me/password — also the way out of a restricted (reset) session
router.post(
  '/me/password',
  csrfCheck,
  requireStudentAllowPending,
  passwordLimiter,
  changePasswordRules,
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const student = await Student.findById(req.student.id).select('+passwordHash');
      if (!student) return notFound(res);

      const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
        });
      }

      student.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      student.mustChangePassword = false;
      student.tempPasswordExpiresAt = undefined;
      // Revoke every other session, then hand this one a fresh token
      student.tokenVersion += 1;
      await student.save();

      issueStudentSession(res, student);
      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
