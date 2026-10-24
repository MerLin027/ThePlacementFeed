const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Student = require('../models/Student');
const Application = require('../models/Application');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const { adminStudentListRules, adminStudentDeleteRules, mongoIdParam, validate } = require('../middleware/validate');
const { buildStudentFilter, STUDENT_SORTS } = require('../services/adminFilters');
const { REQUIRED_PROFILE_FIELDS } = require('../models/Student');
const { logAdminAction } = require('../utils/auditLog');
const { instituteRef } = require('../models/Student');
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
  limit: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: limiterMessage('Too many account changes. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Only what the admin needs to identify an account — no phone, CGPA or resume here (those fields
// are read only to tell whether the profile is complete)
const toAdminStudentDTO = (s, counts) => ({
  id: s._id.toString(),
  email: s.email,
  rollNumber: s.rollNumber,
  institute: instituteRef(s.instituteId),
  firstName: s.firstName ?? '',
  lastName: s.lastName ?? '',
  branch: s.branch ?? '',
  graduationYear: s.graduationYear ?? null,
  createdAt: s.createdAt,
  mustChangePassword: Boolean(s.mustChangePassword),
  profileComplete: REQUIRED_PROFILE_FIELDS.every((f) => s[f] !== undefined && s[f] !== null && s[f] !== ''),
  ...(counts && { applications: counts.applications, selected: counts.selected }),
});

const PROFILE_SELECT = `email rollNumber firstName lastName createdAt mustChangePassword ${REQUIRED_PROFILE_FIELDS.join(' ')}`;

// GET /api/admin/students
router.get('/', listLimiter, adminStudentListRules, validate, async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 25;
    const filter = await buildStudentFilter(req.query);

    const [students, total] = await Promise.all([
      Student.find(filter)
        .select(PROFILE_SELECT)
        .sort(STUDENT_SORTS[req.query.sort] || STUDENT_SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter),
    ]);

    // Applications per student on this page only
    const perStudent = await Application.aggregate([
      { $match: { studentId: { $in: students.map((s) => s._id) } } },
      { $group: { _id: '$studentId', applications: { $sum: 1 }, selected: { $max: { $eq: ['$status', 'Offered'] } } } },
    ]);
    const counts = new Map(perStudent.map((c) => [c._id.toString(), c]));

    res.json({
      success: true,
      data: students.map((s) => {
        const c = counts.get(s._id.toString());
        return toAdminStudentDTO(s, { applications: c?.applications || 0, selected: Boolean(c?.selected) });
      }),
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
        { returnDocument: 'after' }
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

// POST /api/admin/students/:id/reset-institute — clears the student's one-time institute choice
// so they can pick again (they can't apply until they do)
router.post(
  '/:id/reset-institute',
  actionLimiter,
  csrfCheck,
  mongoIdParam('id'),
  validate,
  async (req, res, next) => {
    try {
      const student = await Student.findByIdAndUpdate(
        req.params.id,
        { $unset: { instituteId: '', instituteSetAt: '' } },
        { returnDocument: 'after' }
      );
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }
      logAdminAction(req, 'student.resetInstitute', { studentId: student._id.toString() });
      res.json({ success: true, message: 'Institute reset', data: toAdminStudentDTO(student) });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/students/:id/application-count — shown in the second delete prompt
router.get('/:id/application-count', listLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const count = await Application.countDocuments({ studentId: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/students/:id?applications=retain|delete
// retain (the default, also for older clients): applications stay for the drive's records but
// are stripped of personal details and flagged studentDeleted. delete: they are removed too.
// Applications go first, then the account (freeing its email and roll number); every step is
// idempotent, so retrying after a failure finishes the job.
router.delete('/:id', actionLimiter, csrfCheck, mongoIdParam('id'), adminStudentDeleteRules, validate, async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).select('_id').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const mode = req.query.applications === 'delete' ? 'delete' : 'retain';
    let result;
    if (mode === 'delete') {
      const { deletedCount } = await Application.deleteMany({ studentId: student._id });
      result = { deletedApplications: deletedCount };
    } else {
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
            studentDeleted: true,
            studentDeletedAt: new Date(),
          },
          $unset: { resumeUrl: '', coverNote: '' },
        }
      );
      result = { anonymizedApplications: modifiedCount };
    }

    await Student.deleteOne({ _id: student._id });

    logAdminAction(req, 'student.delete', { studentId: student._id.toString(), applications: mode, ...result });
    res.json({ success: true, message: 'Account deleted', ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
