const express = require('express');
const Application = require('../../models/Application');
const Placement = require('../../models/Placement');
const { APPLICATION_STATUSES } = require('../../models/Application');
const { requireAdmin } = require('../auth/guards');
const { limit } = require('../../middleware/rateLimit');
const { mongoIdParam, validate } = require('../../middleware/validate');
const { fail } = require('../../lib/http');
const {
  applicantFilterRules,
  applicantListRules,
  applicantUpdateRules,
  applicantBulkStatusRules,
  applicantBulkDeleteRules,
} = require('./validators');
const { buildApplicantFilter, applicantQuery } = require('./filters');
const { toApplicantDTO } = require('./dto');
const { buildApplicantExport } = require('./export');
const { record } = require('../audit/service');

// Mounted at …/:driveId/applicants — admin-only
const router = express.Router({ mergeParams: true });

router.use(requireAdmin, mongoIdParam('driveId'), validate);

const readLimiter = limit('applicantsRead');
const updateLimiter = limit('applicantsWrite');
const exportLimiter = limit('applicantsExport');

const buildFilter = (drive, q) => buildApplicantFilter(drive._id.toString(), q, { promptCount: drive.customPrompts?.length || 0 });

const loadDrive = (driveId) =>
  Placement.findById(driveId).select('company role customPrompts applicationMode').lean();

const driveNotFound = (res) => fail(res, 404, 'Placement not found');

// GET / — one page of applicants, plus whole-drive counts and the filter options
router.get('/', readLimiter, applicantListRules, validate, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) return driveNotFound(res);

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

// GET /insights — CGPA spread and branch split for one drive
router.get('/insights', readLimiter, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) return driveNotFound(res);

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

// GET /export — xlsx of the filtered list
router.get('/export', exportLimiter, applicantFilterRules, validate, async (req, res, next) => {
  try {
    const drive = await loadDrive(req.params.driveId);
    if (!drive) return driveNotFound(res);

    await record(req, 'applicants.export', {
      target: { type: 'drive', id: drive._id },
      // Which filters were used; free text (institute, search) only as "was used"
      details: {
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

    const { file, filename } = await buildApplicantExport(drive, buildFilter(drive, req.query), req.query.sort);
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

// PATCH /bulk-status — registered before /:appId. Scoped to this drive: ids from another drive are
// simply not matched.
router.patch('/bulk-status', updateLimiter, applicantBulkStatusRules, validate, async (req, res, next) => {
  try {
    const ids = [...new Set(req.body.applicationIds)];
    const result = await Application.updateMany(
      { _id: { $in: ids }, driveId: req.params.driveId },
      { $set: { status: req.body.status } }
    );
    await record(req, 'applicants.bulkStatus', {
      target: { type: 'drive', id: req.params.driveId },
      details: { status: req.body.status, count: result.modifiedCount },
    });
    res.json({ success: true, matched: result.matchedCount, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// POST /bulk-delete — removes applications for good (status, note, answers). Scoped to this drive
// like bulk-status; the student may apply again while the drive is open.
router.post('/bulk-delete', updateLimiter, applicantBulkDeleteRules, validate, async (req, res, next) => {
  try {
    const ids = [...new Set(req.body.applicationIds)];
    const { deletedCount } = await Application.deleteMany({ _id: { $in: ids }, driveId: req.params.driveId });
    await record(req, 'applicants.delete', { target: { type: 'drive', id: req.params.driveId }, details: { count: deletedCount } });
    res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /:appId — status and/or admin note
router.patch('/:appId', updateLimiter, mongoIdParam('appId'), applicantUpdateRules, validate, async (req, res, next) => {
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
      return fail(res, 404, 'Applicant not found for this drive');
    }
    await record(req, 'applicant.update', {
      target: { type: 'application', id: app._id },
      details: { ...(update.status && { status: update.status }), noteChanged: update.adminNote !== undefined },
    });
    res.json({ success: true, data: toApplicantDTO(app) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
