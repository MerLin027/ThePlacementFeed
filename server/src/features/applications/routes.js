const express = require('express');
const mongoose = require('mongoose');
const Application = require('../../models/Application');
const Placement = require('../../models/Placement');
const Student = require('../../models/Student');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail } = require('../../lib/http');
const { requireStudent } = require('../auth/guards');
const { freshStatuses } = require('../drives/freshness');
const { applicationSubmitRules, myApplicationsRules, STATUS_GROUPS } = require('./validators');
const { checkApplicationRules, buildCustomAnswers, buildSnapshot } = require('./rules');
const { toStudentApplicationDTO } = require('./dto');

// A student's own applications: apply, list, and the per-drive summary for button states
const router = express.Router();

const readLimiter = limit('applicationsRead');

// POST / — submit an in-app application
router.post('/', requireStudent, limit('apply'), freshStatuses, applicationSubmitRules, validate, async (req, res, next) => {
  try {
    const { driveId, resumeUrl, coverNote, customAnswers } = req.body;

    const [drive, student] = await Promise.all([
      Placement.findById(driveId),
      Student.findById(req.student.id),
    ]);
    if (!drive) {
      return fail(res, 404, 'Drive not found', { code: 'DRIVE_NOT_FOUND' });
    }
    if (!student) {
      return fail(res, 401, 'Invalid or expired session');
    }

    const rejection = checkApplicationRules({ drive, student });
    if (rejection) {
      const { status, message, ...extra } = rejection;
      return fail(res, status, message, extra);
    }

    const { answers, missingPromptIds } = buildCustomAnswers(drive.customPrompts, customAnswers);
    if (missingPromptIds.length > 0) {
      return fail(res, 400, 'Please answer all required questions.', { code: 'MISSING_ANSWERS', missingPromptIds });
    }

    let application;
    try {
      // status, studentId and snapshot are always server-built, never from the body
      application = await Application.create({
        driveId: drive._id,
        studentId: student._id,
        snapshot: buildSnapshot(student),
        resumeUrl: resumeUrl || student.resumeUrl,
        coverNote: coverNote || undefined,
        customAnswers: answers,
        consentGiven: true,
      });
    } catch (error) {
      if (error.code === 11000) {
        return fail(res, 409, 'You have already applied to this drive.', { code: 'ALREADY_APPLIED' });
      }
      throw error;
    }

    res.status(201).json({ success: true, data: toStudentApplicationDTO(application, drive) });
  } catch (error) {
    next(error);
  }
});

// GET /my/summary — { driveId, status } for every own application (button state)
router.get('/my/summary', readLimiter, requireStudent, async (req, res, next) => {
  try {
    const apps = await Application.find({ studentId: req.student.id })
      .select('driveId status updatedAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('driveId', 'company role')
      .lean();
    res.json({
      success: true,
      // Applications whose drive was deleted are cascade-removed, but skip any orphan defensively
      data: apps
        .filter((a) => a.driveId)
        .map((a) => ({
          driveId: a.driveId._id.toString(),
          status: a.status,
          company: a.driveId.company,
          role: a.driveId.role,
          updatedAt: a.updatedAt,
        })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /my[?group=active|selected|closed] — paginated list of own applications, with counts per
// group for the tabs
router.get('/my', readLimiter, requireStudent, myApplicationsRules, validate, async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const pageSize = req.query.limit || 20;
    const { group } = req.query;
    const studentId = new mongoose.Types.ObjectId(req.student.id);
    const filter = group ? { studentId, status: { $in: STATUS_GROUPS[group] } } : { studentId };

    const [apps, total, byStatus] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('driveId', 'company role type ctc driveDate status isPostponed')
        .lean(),
      Application.countDocuments(filter),
      Application.aggregate([{ $match: { studentId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    const statusCount = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    const sum = (statuses) => statuses.reduce((t, s) => t + (statusCount[s] || 0), 0);
    const counts = {
      all: sum(Object.values(STATUS_GROUPS).flat()),
      active: sum(STATUS_GROUPS.active),
      selected: sum(STATUS_GROUPS.selected),
      closed: sum(STATUS_GROUPS.closed),
    };

    res.json({
      success: true,
      data: apps.map((a) => {
        const drive = a.driveId && typeof a.driveId === 'object' ? a.driveId : null;
        return toStudentApplicationDTO({ ...a, driveId: drive?._id ?? a.driveId }, drive);
      }),
      pagination: { page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
      counts,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
