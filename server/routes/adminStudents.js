const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Student = require('../models/Student');
const Application = require('../models/Application');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const { adminStudentListRules, mongoIdParam, validate } = require('../middleware/validate');
const { escapeRegex } = require('../utils/escapeRegex');
const { logAdminAction } = require('../utils/auditLog');
const {
  BCRYPT_COST,
  DEFAULT_STUDENT_PASSWORD,
  TEMP_PASSWORD_TTL_MS,
} = require('../constants/auth');

const router = express.Router();

// Every route here is admin-only
router.use(requireAdmin);

const limiterMessage = (message) => ({ success: false, message });

const listLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: limiterMessage('Too many account changes. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { firstName: 1, lastName: 1, createdAt: -1 },
  roll: { rollNumber: 1 },
};

// Only what the admin needs to identify an account — no phone, CGPA or resume here
const toAdminStudentDTO = (s) => ({
  id: s._id.toString(),
  email: s.email,
  rollNumber: s.rollNumber,
  institute: s.institute,
  firstName: s.firstName ?? '',
  lastName: s.lastName ?? '',
  branch: s.branch ?? '',
  graduationYear: s.graduationYear ?? null,
  createdAt: s.createdAt,
  mustChangePassword: Boolean(s.mustChangePassword),
});

// GET /api/admin/students
router.get('/', listLimiter, adminStudentListRules, validate, async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 25;
    const filter = {};

    if (req.query.branch) filter.branch = req.query.branch;

    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [
        { email: regex },
        { rollNumber: regex },
        { firstName: regex },
        { lastName: regex },
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .select('email rollNumber institute firstName lastName branch graduationYear createdAt mustChangePassword')
        .sort(SORTS[req.query.sort] || SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: students.map(toAdminStudentDTO),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/students/:id/reset-password — sets the temporary default password
router.post(
  '/:id/reset-password',
  actionLimiter,
  csrfCheck,
  mongoIdParam('id'),
  validate,
  async (req, res, next) => {
    try {
      const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, BCRYPT_COST);
      const student = await Student.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            passwordHash,
            mustChangePassword: true,
            tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
          },
          // Ends every existing session for this account
          $inc: { tokenVersion: 1 },
        },
        { new: true }
      );

      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      logAdminAction(req, 'student.resetPassword', { studentId: student._id.toString() });
      // The password itself is never returned
      res.json({
        success: true,
        message: 'Password reset to the default. The student must choose a new one within 72 hours.',
        data: toAdminStudentDTO(student),
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/students/:id
// Applications are kept for the drive's records but stripped of personal details,
// then the account is removed (freeing its email and roll number). Both steps are
// idempotent, so retrying after a failure finishes the job.
router.delete('/:id', actionLimiter, csrfCheck, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).select('_id').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { modifiedCount } = await Application.updateMany(
      { studentId: student._id },
      {
        $set: {
          'snapshot.firstName': 'Deleted',
          'snapshot.lastName': 'User',
          'snapshot.email': '',
          'snapshot.phone': '',
          'snapshot.rollNumber': '',
          customAnswers: [],
        },
        $unset: { resumeUrl: '', coverNote: '' },
      }
    );

    await Student.deleteOne({ _id: student._id });

    logAdminAction(req, 'student.delete', { studentId: student._id.toString() });
    res.json({
      success: true,
      message: 'Account deleted',
      anonymizedApplications: modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
