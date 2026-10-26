const express = require('express');
const Student = require('../../models/Student');
const Application = require('../../models/Application');
const { config } = require('../../config/env');
const { requireAdmin } = require('../auth/guards');
const { hashPassword } = require('../auth/passwords');
const { TEMP_PASSWORD_TTL_MS } = require('../auth/constants');
const csrfCheck = require('../../middleware/csrf');
const { limit } = require('../../middleware/rateLimit');
const { mongoIdParam, validate } = require('../../middleware/validate');
const { adminStudentListRules, adminStudentDeleteRules } = require('./validators');
const { buildStudentFilter, STUDENT_SORTS } = require('./filters');
const { toAdminStudentDTO, ADMIN_LIST_SELECT } = require('./dto');
const { logAdminAction } = require('../audit/service');

// Admin management of student accounts
const router = express.Router();

// Every route here is admin-only
router.use(requireAdmin);

const listLimiter = limit('studentsRead');
const actionLimiter = limit('studentsWrite');

const studentNotFound = (res) => res.status(404).json({ success: false, message: 'Student not found' });

// GET / — one page of accounts with their application counts
router.get('/', listLimiter, adminStudentListRules, validate, async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const pageSize = req.query.limit || 25;
    const filter = await buildStudentFilter(req.query);

    const [students, total] = await Promise.all([
      Student.find(filter)
        .select(ADMIN_LIST_SELECT)
        .sort(STUDENT_SORTS[req.query.sort] || STUDENT_SORTS.newest)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
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
      pagination: { page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /:id/reset-password — sets the temporary default password and ends every session
router.post('/:id/reset-password', actionLimiter, csrfCheck, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          passwordHash: await hashPassword(config().defaultStudentPassword),
          mustChangePassword: true,
          tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
        },
        // Ends every existing session for this account
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' }
    );
    if (!student) return studentNotFound(res);

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
});

// POST /:id/reset-institute — clears the one-time institute choice so the student can pick again
// (they can't apply until they do)
router.post('/:id/reset-institute', actionLimiter, csrfCheck, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $unset: { instituteId: '', instituteSetAt: '' } },
      { returnDocument: 'after' }
    );
    if (!student) return studentNotFound(res);
    logAdminAction(req, 'student.resetInstitute', { studentId: student._id.toString() });
    res.json({ success: true, message: 'Institute reset', data: toAdminStudentDTO(student) });
  } catch (error) {
    next(error);
  }
});

// GET /:id/application-count — shown in the second delete prompt
router.get('/:id/application-count', listLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const count = await Application.countDocuments({ studentId: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id?applications=retain|delete
// retain (the default, also for older clients): applications stay for the drive's records but are
// stripped of personal details and flagged studentDeleted. delete: they are removed too.
// Applications go first, then the account (freeing its email and roll number); every step is
// idempotent, so retrying after a failure finishes the job.
router.delete('/:id', actionLimiter, csrfCheck, mongoIdParam('id'), adminStudentDeleteRules, validate, async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).select('_id').lean();
    if (!student) return studentNotFound(res);

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
