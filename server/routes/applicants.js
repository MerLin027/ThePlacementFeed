const express = require('express');
const rateLimit = require('express-rate-limit');
const writeExcelFile = require('write-excel-file/node');
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
const { buildApplicantFilter, applicantQuery } = require('../services/adminFilters');
const { logAdminAction } = require('../utils/auditLog');
const { branchLabel } = require('../services/catalog');
const { APPLICATION_STATUSES } = require('../models/Application');

// Mounted at /api/placements/:driveId/applicants — admin-only
const router = express.Router({ mergeParams: true });

router.use(requireAdmin, mongoIdParam('driveId'), validate);

const EXPORT_ROW_CAP = 5000;

const limiterMessage = (message) => ({ success: false, message });

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: limiterMessage('Too many updates. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Exports are expensive and move a lot of personal data at once
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: limiterMessage('Too many exports. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Filter (shared by list and export) and sorting live in services/adminFilters.js
const buildFilter = (drive, q) => buildApplicantFilter(drive._id.toString(), q, { promptCount: drive.customPrompts?.length || 0 });

// Accounts deleted by the admin leave a scrubbed, flagged application behind. Records scrubbed
// before the flag existed are recognised by the scrubbed name (the migration flags them too).
const isDeletedStudent = (app) =>
  app.studentDeleted === true ||
  (app.snapshot?.firstName === 'Deleted' && app.snapshot?.lastName === 'User' && !app.snapshot?.email);

const toApplicantDTO = (app) => ({
  id: app._id.toString(),
  status: app.status,
  adminNote: app.adminNote ?? '',
  submittedAt: app.createdAt,
  updatedAt: app.updatedAt,
  resumeUrl: app.resumeUrl ?? '',
  coverNote: app.coverNote ?? '',
  customAnswers: (app.customAnswers || []).map((a) => ({ question: a.question, answer: a.answer })),
  studentDeleted: isDeletedStudent(app),
  snapshot: {
    firstName: app.snapshot?.firstName ?? '',
    lastName: app.snapshot?.lastName ?? '',
    email: app.snapshot?.email ?? '',
    rollNumber: app.snapshot?.rollNumber ?? '',
    institute: app.snapshot?.institute ?? '',
    branch: app.snapshot?.branch ?? '',
    cgpa: app.snapshot?.cgpa ?? null,
    activeBacklogs: app.snapshot?.activeBacklogs ?? null,
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
    const filter = buildFilter(drive, req.query);

    const [apps, total, statusCounts, institutes, gradYears] = await Promise.all([
      applicantQuery(filter, req.query.sort, { skip: (page - 1) * limit, limit }),
      Application.countDocuments(filter),
      // Stats cover the whole drive, independent of the current filters
      Application.aggregate([
        { $match: { driveId: drive._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Values present on this drive, for the institute and graduation-year filter options
      Application.distinct('snapshot.institute', { driveId: drive._id }),
      Application.distinct('snapshot.graduationYear', { driveId: drive._id }),
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
        promptCount: drive.customPrompts?.length || 0,
      },
      data: apps.map(toApplicantDTO),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
      facets: {
        institutes: institutes.filter(Boolean).sort(),
        gradYears: gradYears.filter(Boolean).sort((x, y) => x - y),
      },
    });
  } catch (error) {
    next(error);
  }
});

// CGPA buckets for the per-drive histogram: below 6, then half-point steps up to 10
const CGPA_BOUNDARIES = [0, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10.001];
const bucketLabel = (lo, hi) => (lo === 0 ? 'Below 6' : hi > 10 ? '9.5–10' : `${lo}–${hi}`);

// GET /api/placements/:driveId/applicants/insights — CGPA spread and branch split for one drive
router.get('/insights', readLimiter, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }
    const match = { driveId: drive._id };
    const [cgpa, branches] = await Promise.all([
      Application.aggregate([
        { $match: { ...match, 'snapshot.cgpa': { $type: 'number' } } },
        { $bucket: { groupBy: '$snapshot.cgpa', boundaries: CGPA_BOUNDARIES, default: 'other', output: { n: { $sum: 1 } } } },
      ]),
      Application.aggregate([
        { $match: { ...match, 'snapshot.branch': { $type: 'string', $ne: '' } } },
        {
          $group: {
            _id: '$snapshot.branch',
            applications: { $sum: 1 },
            selected: { $sum: { $cond: [{ $eq: ['$status', 'Offered'] }, 1, 0] } },
          },
        },
        { $sort: { applications: -1 } },
      ]),
    ]);
    const counts = new Map(cgpa.map((b) => [b._id, b.n]));
    res.json({
      success: true,
      data: {
        cgpa: CGPA_BOUNDARIES.slice(0, -1).map((lo, i) => ({
          bucket: bucketLabel(lo, CGPA_BOUNDARIES[i + 1]),
          applicants: counts.get(lo) || 0,
        })),
        branches: branches.map((b) => ({ code: b._id, applications: b.applications, selected: b.selected })),
      },
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

// One spreadsheet cell, typed explicitly so text is never read as a number or a formula; empty
// values become empty cells
const toCell = (value, format) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return { value, type: Date, format };
  if (typeof value === 'number') return { value, type: Number };
  return { value: sanitizeCell(String(value)), type: String };
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

    const filter = buildFilter(drive, req.query);
    const prompts = (drive.customPrompts || []).map((p) => p.question);

    logAdminAction(req, 'applicants.export', {
      driveId: drive._id.toString(),
      filters: {
        status: req.query.status,
        branch: req.query.branch,
        cgpaMin: req.query.cgpaMin,
        cgpaMax: req.query.cgpaMax,
        institute: req.query.institute ? true : undefined,
        gradYear: req.query.gradYear,
        backlogsMax: req.query.backlogsMax,
        appliedFrom: req.query.appliedFrom,
        appliedTo: req.query.appliedTo,
        account: req.query.account,
        answers: req.query.answers,
        search: req.query.search ? true : undefined,
      },
    });

    const columns = [
      { header: 'First Name', key: 'firstName', width: 16 },
      { header: 'Last Name', key: 'lastName', width: 16 },
      { header: 'Roll Number', key: 'rollNumber', width: 14 },
      { header: 'Institute', key: 'institute', width: 18 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Branch', key: 'branch', width: 30 },
      { header: 'CGPA', key: 'cgpa', width: 8 },
      { header: 'Active Backlogs', key: 'activeBacklogs', width: 10 },
      { header: 'Graduation Year', key: 'graduationYear', width: 10 },
      { header: 'Resume Link', key: 'resumeUrl', width: 40 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Applied At', key: 'submittedAt', width: 20, format: 'dd mmm yyyy hh:mm' },
      { header: 'Note from Student', key: 'coverNote', width: 40 },
      ...prompts.map((q, i) => ({ header: sanitizeCell(q), key: `prompt_${i}`, width: 30 })),
      { header: 'Admin Note', key: 'adminNote', width: 30 },
    ];
    const rows = [columns.map((c) => ({ value: c.header, type: String, fontWeight: 'bold' }))];

    const cursor = applicantQuery(filter, req.query.sort, { limit: EXPORT_ROW_CAP }).cursor();

    for await (const app of cursor) {
      const s = app.snapshot || {};
      const answers = new Map((app.customAnswers || []).map((a) => [a.question, a.answer]));
      const record = {
        firstName: s.firstName,
        lastName: s.lastName,
        rollNumber: s.rollNumber,
        institute: s.institute,
        email: s.email,
        phone: s.phone,
        branch: branchLabel(s.branch),
        cgpa: s.cgpa,
        activeBacklogs: s.activeBacklogs,
        graduationYear: s.graduationYear,
        resumeUrl: app.resumeUrl,
        status: app.status,
        submittedAt: app.createdAt,
        coverNote: app.coverNote,
        adminNote: app.adminNote,
      };
      prompts.forEach((q, i) => {
        record[`prompt_${i}`] = answers.get(q);
      });
      rows.push(columns.map((c) => toCell(record[c.key], c.format)));
    }

    // Built in full (at most EXPORT_ROW_CAP rows) before anything is sent, so a failure while
    // building still gets a JSON error instead of a truncated download
    const file = writeExcelFile(rows, { sheet: 'Applicants', columns: columns.map((c) => ({ width: c.width })) });

    const date = new Date().toISOString().slice(0, 10);
    // Filename is built server-side from safe characters only
    const filename = `applicants-${slugify(drive.company)}-${date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    await file.toStream(res);
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
        { returnDocument: 'after', runValidators: true }
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
