const express = require('express');
const Placement = require('../../models/Placement');
const Application = require('../../models/Application');
const { requireAdmin } = require('../auth/guards');
const csrfCheck = require('../../middleware/csrf');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { driveRules, postponeRules, statusAutomationRules } = require('./validators');
const { applyAutoStatus } = require('./status');
const { pickEditable, resolveStatusMode, applyStatusMode, logChange } = require('./service');
const applicantRoutes = require('../applicants/routes');

// Admin drive management: create, edit, postpone, pin/unpin the status, delete
const router = express.Router();

// One drive's applicants (admin-only; the guard runs inside)
router.use('/:driveId/applicants', applicantRoutes);

const driveWrite = limit('driveWrite');
const countRead = limit('publicRead');

const notFound = (res) => res.status(404).json({ success: false, message: 'Placement not found' });

// POST /
router.post('/', driveWrite, requireAdmin, csrfCheck, driveRules, validate, async (req, res, next) => {
  try {
    const doc = new Placement(pickEditable(req.body));
    applyStatusMode(doc, resolveStatusMode(req.body.status, true));
    logChange(doc, 'new');
    // save() runs full schema validation, including deadline <= driveDate
    await doc.save();
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
});

// PUT /:id
router.put('/:id', driveWrite, requireAdmin, csrfCheck, driveRules, validate, async (req, res, next) => {
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
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/postpone — quick toggle
router.patch('/:id/postpone', driveWrite, requireAdmin, csrfCheck, postponeRules, validate, async (req, res, next) => {
  try {
    const doc = await Placement.findById(req.params.id);
    if (!doc) return notFound(res);

    doc.isPostponed = req.body.isPostponed;
    // Un-postponing hands the drive back to automation, which may have moved on
    applyAutoStatus(doc);
    logChange(doc, req.body.isPostponed ? 'postponed' : 'unpostponed');
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id/reset-status-automation — restore automation (false) or pin the status (true)
router.patch('/:id/reset-status-automation', driveWrite, requireAdmin, csrfCheck, statusAutomationRules, validate, async (req, res, next) => {
  try {
    const doc = await Placement.findById(req.params.id);
    if (!doc) return notFound(res);

    doc.statusManuallySet = req.body.statusManuallySet;
    // Restoring automation takes effect immediately, not at the next cron run.
    // Students only hear about it if the visible status actually changed.
    if (applyAutoStatus(doc)) logChange(doc, 'statusChange');
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
});

// GET /:id/application-count — shown before deleting a drive
router.get('/:id/application-count', countRead, requireAdmin, async (req, res, next) => {
  try {
    const count = await Application.countDocuments({ driveId: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — also deletes the drive's applications
router.delete('/:id', driveWrite, requireAdmin, csrfCheck, async (req, res, next) => {
  try {
    const drive = await Placement.findByIdAndDelete(req.params.id);
    if (!drive) return notFound(res);
    // Drive first, then applications: a crash in between leaves harmless orphans
    // rather than a drive whose applications are gone
    const { deletedCount } = await Application.deleteMany({ driveId: drive._id });
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
