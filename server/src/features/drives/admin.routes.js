const express = require('express');
const Placement = require('../../models/Placement');
const Application = require('../../models/Application');
const { requirePermission } = require('../auth/guards');
const { PERMISSIONS } = require('../auth/permissions');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail } = require('../../lib/http');
const { record } = require('../audit/service');
const { driveRules, postponeRules, statusAutomationRules } = require('./validators');
const { applyAutoStatus } = require('./status');
const { parseListQuery, listDrives, pickEditable, resolveStatusMode, applyStatusMode, logChange } = require('./service');
const { freshStatuses } = require('./freshness');
const { toAdminDrive } = require('./dto');
const applicantRoutes = require('../applicants/routes');

// Mounted at /api/admin/drives (staff, drives:manage; routes/admin.js applies the guards): list,
// create, edit, postpone, pin/unpin the status, delete
const router = express.Router();

// One drive's applicants
router.use('/:driveId/applicants', requirePermission(PERMISSIONS.APPLICANTS), applicantRoutes);

const driveWrite = limit('driveWrite');
const driveRead = limit('applicantsRead');

const notFound = (res) => fail(res, 404, 'Placement not found');

// GET / — the drive list with staff fields (same filters as the public list)
router.get('/', driveRead, freshStatuses, async (req, res, next) => {
  try {
    const query = parseListQuery(req.query);
    if (query.error) return fail(res, 400, query.error, { code: 'INVALID_QUERY' });
    const { drives, total } = await listDrives(query.filter, query);
    res.json({
      success: true,
      data: drives.map(toAdminDrive),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /
router.post('/', driveWrite, driveRules, validate, async (req, res, next) => {
  try {
    const doc = new Placement(pickEditable(req.body));
    applyStatusMode(doc, resolveStatusMode(req.body.status, true));
    logChange(doc, 'new');
    // save() runs full schema validation, including deadline <= driveDate
    await doc.save();
    await record(req, 'drive.create', { target: { type: 'drive', id: doc._id } });
    res.status(201).json({ success: true, data: toAdminDrive(doc) });
  } catch (error) {
    next(error);
  }
});

// PUT /:id
router.put('/:id', driveWrite, driveRules, validate, async (req, res, next) => {
  try {
    const doc = await Placement.findById(req.params.id);
    if (!doc) return notFound(res);

    const previousStatus = doc.status;
    const wasPostponed = Boolean(doc.isPostponed);
    doc.set(pickEditable(req.body));
    applyStatusMode(doc, resolveStatusMode(req.body.status, false));

    // One log entry per save, describing the most meaningful change
    let changeType = 'edit';
    if (Boolean(doc.isPostponed) !== wasPostponed) changeType = doc.isPostponed ? 'postponed' : 'unpostponed';
    else if (doc.status !== previousStatus) changeType = 'statusChange';
    logChange(doc, changeType);
    await doc.save();
    await record(req, 'drive.update', { target: { type: 'drive', id: doc._id }, details: { change: changeType } });
    res.json({ success: true, data: toAdminDrive(doc) });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/postpone — quick toggle
router.patch('/:id/postpone', driveWrite, postponeRules, validate, async (req, res, next) => {
  try {
    const doc = await Placement.findById(req.params.id);
    if (!doc) return notFound(res);

    doc.isPostponed = req.body.isPostponed;
    // Un-postponing hands the drive back to automation, which may have moved on
    applyAutoStatus(doc);
    logChange(doc, req.body.isPostponed ? 'postponed' : 'unpostponed');
    await doc.save();
    await record(req, 'drive.postpone', { target: { type: 'drive', id: doc._id }, details: { postponed: doc.isPostponed } });
    res.json({ success: true, data: toAdminDrive(doc) });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/status-automation — restore automation (false) or pin the status (true)
router.patch('/:id/status-automation', driveWrite, statusAutomationRules, validate, async (req, res, next) => {
  try {
    const doc = await Placement.findById(req.params.id);
    if (!doc) return notFound(res);

    doc.statusManuallySet = req.body.statusManuallySet;
    // Restoring automation takes effect immediately, not at the next cron run.
    // Students only hear about it if the visible status actually changed.
    if (applyAutoStatus(doc)) logChange(doc, 'statusChange');
    await doc.save();
    await record(req, 'drive.statusAutomation', { target: { type: 'drive', id: doc._id }, details: { pinned: doc.statusManuallySet } });
    res.json({ success: true, data: toAdminDrive(doc) });
  } catch (error) {
    next(error);
  }
});

// GET /:id/application-count — shown before deleting a drive
router.get('/:id/application-count', driveRead, async (req, res, next) => {
  try {
    const count = await Application.countDocuments({ driveId: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — also deletes the drive's applications
router.delete('/:id', driveWrite, async (req, res, next) => {
  try {
    const drive = await Placement.findByIdAndDelete(req.params.id);
    if (!drive) return notFound(res);
    // Drive first, then applications: a crash in between leaves harmless orphans
    // rather than a drive whose applications are gone
    const { deletedCount } = await Application.deleteMany({ driveId: drive._id });
    await record(req, 'drive.delete', { target: { type: 'drive', id: drive._id }, details: { deletedApplications: deletedCount } });
    res.json({
      success: true,
      message: 'Placement deleted successfully',
      deletedApplications: deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
