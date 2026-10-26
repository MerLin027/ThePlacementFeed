const express = require('express');
const Student = require('../../models/Student');
const Application = require('../../models/Application');
const { hashPassword } = require('../auth/passwords');
const { generateTempPassword } = require('../auth/tempPassword');
const { endSessionsFor } = require('../auth/sessions');
const { TEMP_PASSWORD_TTL_MS } = require('../auth/constants');
const { limit } = require('../../middleware/rateLimit');
const { mongoIdParam, validate } = require('../../middleware/validate');
const { fail } = require('../../lib/http');
const { adminStudentListRules, adminStudentDeleteRules } = require('./validators');
const { buildStudentFilter, STUDENT_SORTS } = require('./filters');
const { toAdminStudentDTO, ADMIN_LIST_SELECT } = require('./dto');
const { record } = require('../audit/service');

// Mounted at /api/admin/students — staff management of student accounts (students:manage)
const router = express.Router();

const listLimiter = limit('studentsRead');
const actionLimiter = limit('studentsWrite');

const studentNotFound = (res) => fail(res, 404, 'Student not found');

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

// POST /:id/reset-password — a random one-time password, returned in this response only (the admin
// passes it on in person). It only opens the change-password page, for 72 hours; every session of
// the account ends now.
router.post('/:id/reset-password', actionLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const temporaryPassword = generateTempPassword();
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
          tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
        },
      },
      { returnDocument: 'after' }
    );
    if (!student) return studentNotFound(res);

    await endSessionsFor({ type: 'student', id: student._id });
    await record(req, 'student.resetPassword', { target: { type: 'student', id: student._id } });
    res.json({
      success: true,
      message: 'Password reset. Give the student this one-time password; they must choose a new one within 72 hours.',
      data: toAdminStudentDTO(student),
      temporaryPassword,
    });
  } catch (error) {
    next(error);
  }
});

// POST /:id/reset-institute — clears the one-time institute choice so the student can pick again
// (they can't apply until they do)
router.post('/:id/reset-institute', actionLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $unset: { instituteId: '', instituteSetAt: '' } },
      { returnDocument: 'after' }
    );
    if (!student) return studentNotFound(res);
    await record(req, 'student.resetInstitute', { target: { type: 'student', id: student._id } });
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
router.delete('/:id', actionLimiter, mongoIdParam('id'), adminStudentDeleteRules, validate, async (req, res, next) => {
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
    await endSessionsFor({ type: 'student', id: student._id });

    await record(req, 'student.delete', { target: { type: 'student', id: student._id }, details: { applications: mode, ...result } });
    res.json({ success: true, message: 'Account deleted', ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
