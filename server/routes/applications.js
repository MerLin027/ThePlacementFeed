const express = require('express');
const rateLimit = require('express-rate-limit');
const Application = require('../models/Application');
const Placement = require('../models/Placement');
const Student = require('../models/Student');
const csrfCheck = require('../middleware/csrfCheck');
const { requireStudent } = require('../middleware/requireStudent');
const { applicationSubmitRules, validate } = require('../middleware/validate');
const {
  checkApplicationRules,
  buildCustomAnswers,
  buildSnapshot,
} = require('../services/applicationRules');

const router = express.Router();

const limiterMessage = (message) => ({ success: false, message });

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Keyed per student (runs after auth) so a lab sharing one IP isn't throttled together
const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.student.id,
  message: limiterMessage('Too many applications in a short time. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// What a student sees about their own application — no admin notes
const toStudentApplicationDTO = (app, drive) => ({
  id: app._id.toString(),
  driveId: app.driveId ? app.driveId.toString() : null,
  company: drive?.company ?? null,
  role: drive?.role ?? null,
  status: app.status,
  submittedAt: app.createdAt,
});

// POST /api/applications — submit an in-app application
router.post(
  '/',
  csrfCheck,
  requireStudent,
  applyLimiter,
  applicationSubmitRules,
  validate,
  async (req, res, next) => {
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
  }
);

// GET /api/applications/my/summary — { driveId, status } for every own application (button state)
router.get('/my/summary', readLimiter, requireStudent, async (req, res, next) => {
  try {
    const apps = await Application.find({ studentId: req.student.id })
      .select('driveId status')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({
      success: true,
      data: apps.map((a) => ({ driveId: a.driveId.toString(), status: a.status })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/applications/my — paginated list of own applications
router.get('/my', readLimiter, requireStudent, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const filter = { studentId: req.student.id };

    const [apps, total] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('driveId', 'company role')
        .lean(),
      Application.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: apps.map((a) => {
        const drive = a.driveId && typeof a.driveId === 'object' ? a.driveId : null;
        return toStudentApplicationDTO({ ...a, driveId: drive?._id ?? a.driveId }, drive);
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
