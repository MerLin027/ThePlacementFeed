const express = require('express');
const mongoose = require('mongoose');
const Application = require('../../models/Application');
const Placement = require('../../models/Placement');
const Student = require('../../models/Student');
const csrfCheck = require('../../middleware/csrf');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { requireStudent } = require('../auth/guards');
const { freshStatuses } = require('../drives/freshness');
const { applicationSubmitRules } = require('./validators');
const { checkApplicationRules, buildCustomAnswers, buildSnapshot } = require('./rules');
const { toStudentApplicationDTO } = require('./dto');

// A student's own applications: apply, list, and the per-drive summary for button states
const router = express.Router();

const readLimiter = limit('applicationsRead');

// Tabs on the My Applications page
const STATUS_GROUPS = {
  active: ['Applied', 'Shortlisted', 'Interviewing'],
  selected: ['Offered'],
  closed: ['Rejected'],
};

// POST / — submit an in-app application
router.post('/', csrfCheck, requireStudent, limit('apply'), freshStatuses, applicationSubmitRules, validate, async (req, res, next) => {
  try {
    const { driveId, resumeUrl, coverNote, customAnswers } = req.body;

    const [drive, student] = await Promise.all([
      Placement.findById(driveId),
      Student.findById(req.student.id),
    ]);
    if (!drive) {
      return res.status(404).json({ success: false, code: 'DRIVE_NOT_FOUND', message: 'Drive not found' });
    }
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }

    const rejection = checkApplicationRules({ drive, student });
    if (rejection) {
      const { status, ...body } = rejection;
      return res.status(status).json({ success: false, ...body });
    }

    const { answers, missingPromptIds } = buildCustomAnswers(drive.customPrompts, customAnswers);
    if (missingPromptIds.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_ANSWERS',
        message: 'Please answer all required questions.',
        missingPromptIds,
      });
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
        return res.status(409).json({
          success: false,
          code: 'ALREADY_APPLIED',
          message: 'You have already applied to this drive.',
        });
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
router.get('/my', readLimiter, requireStudent, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { group } = req.query;
    if (group !== undefined && !(typeof group === 'string' && Object.hasOwn(STATUS_GROUPS, group))) {
      return res.status(400).json({ success: false, message: 'group must be active, selected or closed' });
    }
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
