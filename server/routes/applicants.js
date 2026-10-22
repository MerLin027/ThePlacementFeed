const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const ExcelJS = require('exceljs');
const Application = require('../models/Application');
const Placement = require('../models/Placement');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const {
  applicantFilterRules,
  applicantListRules,
  applicantUpdateRules,
  applicantBulkRules,
  mongoIdParam,
  validate,
} = require('../middleware/validate');
const { escapeRegex } = require('../utils/escapeRegex');
const { logAdminAction } = require('../utils/auditLog');
const { branchLabel } = require('../constants/branches');
const { APPLICATION_STATUSES } = require('../models/Application');

// Mounted at /api/placements/:driveId/applicants — admin-only
const router = express.Router({ mergeParams: true });

router.use(requireAdmin, mongoIdParam('driveId'), validate);

const EXPORT_ROW_CAP = 5000;

const limiterMessage = (message) => ({ success: false, message });

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: limiterMessage('Too many updates. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Exports are expensive and move a lot of personal data at once
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: limiterMessage('Too many exports. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  cgpa_desc: { 'snapshot.cgpa': -1, createdAt: -1 },
  cgpa_asc: { 'snapshot.cgpa': 1, createdAt: -1 },
  name: { 'snapshot.firstName': 1, 'snapshot.lastName': 1 },
  roll: { 'snapshot.rollNumber': 1 },
};

// Builds the Mongo filter from validated query params (shared by list and export)
const buildFilter = (driveId, q) => {
  const filter = { driveId: new mongoose.Types.ObjectId(driveId) };
  if (q.status) filter.status = q.status;
  if (q.branch) filter['snapshot.branch'] = q.branch;
  if (q.cgpaMin !== undefined || q.cgpaMax !== undefined) {
    filter['snapshot.cgpa'] = {};
    if (q.cgpaMin !== undefined) filter['snapshot.cgpa'].$gte = q.cgpaMin;
    if (q.cgpaMax !== undefined) filter['snapshot.cgpa'].$lte = q.cgpaMax;
  }
  if (q.search) {
    const regex = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [
      { 'snapshot.firstName': regex },
      { 'snapshot.lastName': regex },
      { 'snapshot.email': regex },
      { 'snapshot.rollNumber': regex },
    ];
  }
  return filter;
};

// Accounts deleted by the admin leave a scrubbed snapshot behind
const isDeletedStudent = (snapshot = {}) =>
  snapshot.firstName === 'Deleted' && snapshot.lastName === 'User' && !snapshot.email;

const toApplicantDTO = (app) => ({
  id: app._id.toString(),
  status: app.status,
  adminNote: app.adminNote ?? '',
  submittedAt: app.createdAt,
  updatedAt: app.updatedAt,
  resumeUrl: app.resumeUrl ?? '',
  coverNote: app.coverNote ?? '',
  customAnswers: (app.customAnswers || []).map((a) => ({ question: a.question, answer: a.answer })),
  studentDeleted: isDeletedStudent(app.snapshot),
  snapshot: {
    firstName: app.snapshot?.firstName ?? '',
    lastName: app.snapshot?.lastName ?? '',
    email: app.snapshot?.email ?? '',
    rollNumber: app.snapshot?.rollNumber ?? '',
    branch: app.snapshot?.branch ?? '',
    cgpa: app.snapshot?.cgpa ?? null,
    activeBacklogs: app.snapshot?.activeBacklogs ?? null,
    historyBacklogs: app.snapshot?.historyBacklogs ?? null,
    graduationYear: app.snapshot?.graduationYear ?? null,
    phone: app.snapshot?.phone ?? '',
  },
});

const loadDrive = (driveId) =>
  Placement.findById(driveId).select('company role customPrompts applicationMode').lean();

// GET /api/placements/:driveId/applicants
router.get('/', readLimiter, applicantListRules, validate, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 25;
    const filter = buildFilter(req.params.driveId, req.query);

    const [apps, total, statusCounts] = await Promise.all([
      Application.find(filter)
        .sort(SORTS[req.query.sort] || SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
      // Stats cover the whole drive, independent of the current filters
      Application.aggregate([
        { $match: { driveId: drive._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    statusCounts.forEach(({ _id, count }) => {
      if (_id in stats) stats[_id] = count;
    });

    res.json({
      success: true,
      drive: {
        id: drive._id.toString(),
        company: drive.company,
        role: drive.role,
        applicationMode: drive.applicationMode,
      },
      data: apps.map(toApplicantDTO),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// --- Excel export ---

// Values starting with these characters can be interpreted as formulas by
// spreadsheet apps (CSV/formula injection), so they are prefixed with a quote.
const sanitizeCell = (value) => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

const slugify = (text) =>
  String(text || 'drive')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'drive';

// GET /api/placements/:driveId/applicants/export — xlsx of the filtered list (max 5000 rows)
router.get('/export', exportLimiter, applicantFilterRules, validate, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }

    const filter = buildFilter(req.params.driveId, req.query);
    const prompts = (drive.customPrompts || []).map((p) => p.question);

    const date = new Date().toISOString().slice(0, 10);
    // Filename is built server-side from safe characters only
    const filename = `applicants-${slugify(drive.company)}-${date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    logAdminAction(req, 'applicants.export', {
      driveId: drive._id.toString(),
      filters: {
        status: req.query.status,
        branch: req.query.branch,
        cgpaMin: req.query.cgpaMin,
        cgpaMax: req.query.cgpaMax,
        search: req.query.search ? true : undefined,
      },
    });

    // Streamed straight to the response — no workbook held in memory
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    const sheet = workbook.addWorksheet('Applicants');
    sheet.columns = [
      { header: 'First Name', key: 'firstName', width: 16 },
      { header: 'Last Name', key: 'lastName', width: 16 },
      { header: 'Roll Number', key: 'rollNumber', width: 14 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Branch', key: 'branch', width: 30 },
      { header: 'CGPA', key: 'cgpa', width: 8 },
      { header: 'Active Backlogs', key: 'activeBacklogs', width: 10 },
      { header: 'Backlog History', key: 'historyBacklogs', width: 10 },
      { header: 'Graduation Year', key: 'graduationYear', width: 10 },
      { header: 'Resume Link', key: 'resumeUrl', width: 40 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Applied At', key: 'submittedAt', width: 20, style: { numFmt: 'dd mmm yyyy hh:mm' } },
      { header: 'Note from Student', key: 'coverNote', width: 40 },
      ...prompts.map((q, i) => ({ header: sanitizeCell(q), key: `prompt_${i}`, width: 30 })),
      { header: 'Admin Note', key: 'adminNote', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();

    const cursor = Application.find(filter)
      .sort(SORTS[req.query.sort] || SORTS.newest)
      .limit(EXPORT_ROW_CAP)
      .lean()
      .cursor();

    for await (const app of cursor) {
      const s = app.snapshot || {};
      const answers = new Map((app.customAnswers || []).map((a) => [a.question, a.answer]));
      const row = {
        firstName: s.firstName,
        lastName: s.lastName,
        rollNumber: s.rollNumber,
        email: s.email,
        phone: s.phone,
        branch: branchLabel(s.branch),
        cgpa: s.cgpa,
        activeBacklogs: s.activeBacklogs,
        historyBacklogs: s.historyBacklogs,
        graduationYear: s.graduationYear,
        resumeUrl: app.resumeUrl,
        status: app.status,
        submittedAt: app.createdAt,
        coverNote: app.coverNote,
        adminNote: app.adminNote,
      };
      prompts.forEach((q, i) => {
        row[`prompt_${i}`] = answers.get(q);
      });
      // Every value is a plain string/number/date (never a formula object) and strings are sanitized
      Object.keys(row).forEach((k) => {
        row[k] = row[k] === undefined || row[k] === null ? '' : sanitizeCell(row[k]);
      });
      sheet.addRow(row).commit();
    }

    sheet.commit();
    await workbook.commit();
  } catch (error) {
    // Headers may already be sent mid-stream; then the download just ends early
    if (res.headersSent) {
      console.error('[Export] Failed mid-stream:', error.message);
      res.end();
      return;
    }
    next(error);
  }
});

// PATCH /api/placements/:driveId/applicants/bulk-status — registered before /:appId
router.patch('/bulk-status', updateLimiter, csrfCheck, applicantBulkRules, validate, async (req, res, next) => {
  try {
    const ids = [...new Set(req.body.applicationIds)];
    // Scoped to this drive: ids from another drive are simply not matched
    const result = await Application.updateMany(
      { _id: { $in: ids }, driveId: req.params.driveId },
      { $set: { status: req.body.status } }
    );
    logAdminAction(req, 'applicants.bulkStatus', {
      driveId: req.params.driveId,
      status: req.body.status,
      count: result.modifiedCount,
    });
    res.json({ success: true, matched: result.matchedCount, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/placements/:driveId/applicants/:appId — status and/or admin note
router.patch(
  '/:appId',
  updateLimiter,
  csrfCheck,
  mongoIdParam('appId'),
  applicantUpdateRules,
  validate,
  async (req, res, next) => {
    try {
      const update = {};
      if (req.body.status !== undefined) update.status = req.body.status;
      if (req.body.adminNote !== undefined) update.adminNote = req.body.adminNote;

      const app = await Application.findOneAndUpdate(
        { _id: req.params.appId, driveId: req.params.driveId },
        { $set: update },
        { new: true, runValidators: true }
      ).lean();

      if (!app) {
        return res.status(404).json({ success: false, message: 'Applicant not found for this drive' });
      }
      res.json({ success: true, data: toApplicantDTO(app) });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
