const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Student = require('../models/Student');
const csrfCheck = require('../middleware/csrfCheck');
const { requireStudent, requireStudentAllowPending } = require('../middleware/requireStudent');
const { studentProfileRules, changePasswordRules, chooseInstituteRules, validate } = require('../middleware/validate');
const catalog = require('../services/catalog');
const { issueStudentSession } = require('../utils/studentSession');
const { getClearCookieOptions } = require('../utils/cookies');
const { BCRYPT_COST, STUDENT_COOKIE } = require('../constants/auth');

const router = express.Router();

// Fields a student may edit. Identity and auth fields are never accepted from the body.
const EDITABLE_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'branch',
  'cgpa',
  'activeBacklogs',
  'graduationYear',
  'phone',
  'resumeUrl',
];

const limiterMessage = (message) => ({ success: false, message });

const profileReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Keyed by student (these run after auth) so classmates on one IP don't share a budget
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.student.id,
  message: limiterMessage('Too many updates. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
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

      // An archived branch can be kept, but not newly chosen
      const { branch } = req.body;
      if (branch && branch !== student.branch && !catalog.isBranchCode(branch, { activeOnly: true })) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'branch', message: 'Please choose a branch from the list' }],
        });
      }

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

// PUT /api/students/me/institute — a one-time choice. The update only matches while no institute
// is set, so a second (or concurrent) request can't change it; only the admin can clear it.
router.put(
  '/me/institute',
  csrfCheck,
  requireStudent,
  profileUpdateLimiter,
  chooseInstituteRules,
  validate,
  async (req, res, next) => {
    try {
      const institute = catalog.getInstitute(req.body.instituteId);
      if (!institute || !institute.active) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'instituteId', message: 'Please choose an institute from the list' }],
        });
      }

      const student = await Student.findOneAndUpdate(
        { _id: req.student.id, instituteId: null },
        { $set: { instituteId: institute.id, instituteSetAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!student) {
        if (!(await Student.exists({ _id: req.student.id }))) return notFound(res);
        return res.status(409).json({
          success: false,
          code: 'INSTITUTE_LOCKED',
          message: 'Your institute is already set. Ask the CDPC admin if it needs to change.',
        });
      }
      res.json({ success: true, data: student.toProfileDTO() });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/students/me/password — also the way out of a restricted (reset) session, where
// the current (temporary) password isn't asked for again
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

      if (student.mustChangePassword) {
        // Logging in checks the 72 h window, but a restricted session can outlive it
        if (student.tempPasswordExpiresAt && student.tempPasswordExpiresAt < new Date()) {
          res.clearCookie(STUDENT_COOKIE, getClearCookieOptions());
          return res.status(401).json({
            success: false,
            code: 'TEMP_PASSWORD_EXPIRED',
            message: 'Your temporary password has expired. Ask the CDPC admin to reset it again.',
          });
        }
      } else {
        const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
          });
        }
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
