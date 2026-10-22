const express = require('express');
const rateLimit = require('express-rate-limit');
const Placement = require('../models/Placement');
const Application = require('../models/Application');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const { placementValidationRules, postponeValidationRules, resetStatusValidationRules, validate } = require('../middleware/validate');

const router = express.Router();

const { escapeRegex } = require('../utils/escapeRegex');
const { applyAutoStatus } = require('../utils/driveStatus');
const { freshStatuses } = require('../jobs/statusCron');
const applicantRoutes = require('./applicants');

// Admin applicant management for a drive (auth enforced inside the sub-router)
router.use('/:driveId/applicants', applicantRoutes);

const VALID_STATUSES = ['Upcoming', 'Ongoing', 'Completed'];

// Rate limit public GET endpoints: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit mutating endpoints: 50 requests per 15 minutes per IP
const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many updates. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/placements — public, paginated, filterable
router.get('/', apiLimiter, freshStatuses, async (req, res, next) => {

  try {
    const { branch, status, ctcMin, ctcMax, search, sort, page, limit } =
      req.query;

    // --- Query param validation ---
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const parsedCtcMin = ctcMin !== undefined ? Number(ctcMin) : undefined;
    const parsedCtcMax = ctcMax !== undefined ? Number(ctcMax) : undefined;
    if (ctcMin !== undefined && isNaN(parsedCtcMin)) {
      return res.status(400).json({
        success: false,
        message: 'ctcMin must be a valid number',
      });
    }
    if (ctcMax !== undefined && isNaN(parsedCtcMax)) {
      return res.status(400).json({
        success: false,
        message: 'ctcMax must be a valid number',
      });
    }

    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 12;
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'page must be a positive integer',
      });
    }
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        success: false,
        message: 'limit must be a positive integer',
      });
    }
    const effectiveLimit = Math.min(parsedLimit, 50); // Max 50 per page

    // --- Build query ---
    const query = {};

    if (status) {
      query.status = status;
    }

    if (branch) {
      // Support comma-separated branches
      const branches = branch.split(',').map((b) => b.trim());
      query['eligibility.branches'] = { $in: branches };
    }

    if (parsedCtcMin !== undefined || parsedCtcMax !== undefined) {
      query.ctc = {};
      if (parsedCtcMin !== undefined) query.ctc.$gte = parsedCtcMin;
      if (parsedCtcMax !== undefined) query.ctc.$lte = parsedCtcMax;
    }

    if (search) {
      const escapedSearch = escapeRegex(search.trim());
      if (escapedSearch) {
        const searchRegex = new RegExp(escapedSearch, 'i');
        query.$or = [{ company: searchRegex }, { role: searchRegex }];
      }
    }

    // --- Sort ---
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'date_asc') sortOption = { driveDate: 1 };
    else if (sort === 'date_desc') sortOption = { driveDate: -1 };
    else if (sort === 'ctc_asc') sortOption = { ctc: 1 };
    else if (sort === 'ctc_desc') sortOption = { ctc: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'oldest') sortOption = { createdAt: 1 };

    // --- Execute query with pagination ---
    const skip = (parsedPage - 1) * effectiveLimit;
    const [placements, total] = await Promise.all([
      Placement.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(effectiveLimit)
        .lean(),
      Placement.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: placements,
      pagination: {
        page: parsedPage,
        limit: effectiveLimit,
        total,
        totalPages: Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/placements/changes — public, get recent changes since a timestamp
router.get('/changes', apiLimiter, freshStatuses, async (req, res, next) => {
  try {
    const { since } = req.query;
    if (!since) {
      return res.status(400).json({ success: false, message: 'since timestamp is required' });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid since timestamp' });
    }

    // Security: Enforce a maximum lookback window of 7 days to prevent memory exhaustion DoS
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const parsedSince = sinceDate < sevenDaysAgo ? sevenDaysAgo : sinceDate;
    
    // Add a 10 second overlap buffer to catch race conditions where a slow DB write 
    // was committed after a poll but had a timestamp generated before the poll.
    const effectiveSinceDate = new Date(parsedSince.getTime() - 10000);

    const placements = await Placement.find({
      'recentChanges.changedAt': { $gt: effectiveSinceDate },
    }).lean();

    // Flatten recent changes
    let changes = [];
    placements.forEach((placement) => {
      placement.recentChanges.forEach((change) => {
        // automationReset entries are admin bookkeeping from before statuses were logged
        if (change.changedAt > effectiveSinceDate && change.type !== 'automationReset') {
          changes.push({
            id: `${placement._id}-${change.type}-${change.changedAt.getTime()}`,
            placementId: placement._id,
            company: placement.company,
            role: placement.role,
            type: change.type,
            status: change.status,
            changedAt: change.changedAt,
          });
        }
      });
    });

    // Sort by changedAt descending (Native Date subtraction is vastly faster)
    changes.sort((a, b) => b.changedAt - a.changedAt);

    // Cap at 50 to prevent massive payloads if a very old timestamp is maliciously provided.
    // serverTime is the client's next cursor, so device clock skew can't drop changes.
    res.json({ success: true, data: changes.slice(0, 50), serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/placements/:id — public
router.get('/:id', apiLimiter, freshStatuses, async (req, res, next) => {
  try {
    const placement = await Placement.findById(req.params.id).lean();
    if (!placement) {
      return res.status(404).json({
        success: false,
        message: 'Placement not found',
      });
    }
    res.json({ success: true, data: placement });
  } catch (error) {
    next(error);
  }
});

// --- Writes ---

// Fields an admin may set through the drive form. Everything else (status
// automation flag, change log, timestamps) is server-managed.
const EDITABLE_FIELDS = [
  'company', 'role', 'type', 'ctc', 'eligibility', 'driveDate', 'deadline',
  'isPostponed', 'jdDescription', 'tags', 'formUrl', 'selectionRounds',
  'applicationMode', 'customPrompts',
];

const pickEditable = (body) => {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
  }
  return data;
};

/**
 * Status mode from the form: "auto" (or omitted on create) means the status
 * follows the dates; one of the real statuses pins it manually.
 * Returns { manual, status } or null to keep the current mode (edit without a status).
 */
const resolveStatusMode = (status, isCreate) => {
  if (status === undefined || status === null || status === '') {
    return isCreate ? { manual: false } : null;
  }
  if (status === 'auto') return { manual: false };
  return { manual: true, status };
};

const MAX_RECENT_CHANGES = 10;

const logChange = (doc, type) => {
  doc.recentChanges.push({ type, status: doc.status, changedAt: new Date() });
  if (doc.recentChanges.length > MAX_RECENT_CHANGES) {
    doc.recentChanges.splice(0, doc.recentChanges.length - MAX_RECENT_CHANGES);
  }
};

// Applies the status mode, then recomputes the automatic status from the dates
const applyStatusMode = (doc, mode) => {
  if (mode?.manual) {
    doc.statusManuallySet = true;
    doc.status = mode.status;
  } else if (mode) {
    doc.statusManuallySet = false;
  }
  applyAutoStatus(doc);
};

// POST /api/placements — auth required
router.post(
  '/',
  mutateLimiter,
  requireAdmin,
  csrfCheck,
  placementValidationRules,
  validate,
  async (req, res, next) => {
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
  }
);

// PUT /api/placements/:id — auth required
router.put(
  '/:id',
  mutateLimiter,
  requireAdmin,
  csrfCheck,
  placementValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const doc = await Placement.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found',
        });
      }

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
  }
);

// PATCH /api/placements/:id/postpone — lightweight toggle, auth required
router.patch(
  '/:id/postpone',
  mutateLimiter,
  requireAdmin,
  csrfCheck,
  postponeValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const doc = await Placement.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found',
        });
      }

      doc.isPostponed = req.body.isPostponed;
      // Un-postponing hands the drive back to automation, which may have moved on
      applyAutoStatus(doc);
      logChange(doc, req.body.isPostponed ? 'postponed' : 'unpostponed');
      await doc.save();
      res.json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/placements/:id/reset-status-automation — restore (false) or pin (true), auth required
router.patch(
  '/:id/reset-status-automation',
  mutateLimiter,
  requireAdmin,
  csrfCheck,
  resetStatusValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const doc = await Placement.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found',
        });
      }

      doc.statusManuallySet = req.body.statusManuallySet;
      // Restoring automation takes effect immediately, not at the next cron run.
      // Students only hear about it if the visible status actually changed.
      if (applyAutoStatus(doc)) logChange(doc, 'statusChange');
      await doc.save();
      res.json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/placements/:id/application-count — admin only, shown before deleting a drive
router.get('/:id/application-count', apiLimiter, requireAdmin, async (req, res, next) => {
  try {
    const count = await Application.countDocuments({ driveId: req.params.id });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/placements/:id — auth required; also deletes the drive's applications
router.delete('/:id', mutateLimiter, requireAdmin, csrfCheck, async (req, res, next) => {
  try {
    const placement = await Placement.findByIdAndDelete(req.params.id);
    if (!placement) {
      return res.status(404).json({
        success: false,
        message: 'Placement not found',
      });
    }
    // Drive first, then applications: a crash in between leaves harmless orphans
    // rather than a drive whose applications are gone
    const { deletedCount } = await Application.deleteMany({ driveId: placement._id });
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
