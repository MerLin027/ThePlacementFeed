const express = require('express');
const rateLimit = require('express-rate-limit');
const Placement = require('../models/Placement');
const auth = require('../middleware/auth');
const csrfCheck = require('../middleware/csrfCheck');
const { placementValidationRules, postponeValidationRules, resetStatusValidationRules, validate } = require('../middleware/validate');

const router = express.Router();

// Escape regex special characters to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

// GET /api/placements — public, paginated, filterable
router.get('/', apiLimiter, async (req, res, next) => {

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
router.get('/changes', apiLimiter, async (req, res, next) => {
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
    const effectiveSinceDate = sinceDate < sevenDaysAgo ? sevenDaysAgo : sinceDate;

    const placements = await Placement.find({
      'recentChanges.changedAt': { $gt: effectiveSinceDate },
    }).lean();

    // Flatten recent changes
    let changes = [];
    placements.forEach((placement) => {
      placement.recentChanges.forEach((change) => {
        if (change.changedAt > effectiveSinceDate) {
          changes.push({
            id: `${placement._id}-${change.type}-${change.changedAt.getTime()}`,
            placementId: placement._id,
            company: placement.company,
            role: placement.role,
            type: change.type,
            changedAt: change.changedAt,
          });
        }
      });
    });

    // Sort by changedAt descending (Native Date subtraction is vastly faster)
    changes.sort((a, b) => b.changedAt - a.changedAt);

    // Cap at 50 to prevent massive payloads if a very old timestamp is maliciously provided
    res.json({ success: true, data: changes.slice(0, 50) });
  } catch (error) {
    next(error);
  }
});

// GET /api/placements/:id — public
router.get('/:id', apiLimiter, async (req, res, next) => {
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

// POST /api/placements — auth required
router.post(
  '/',
  auth,
  csrfCheck,
  placementValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const placementData = { ...req.body };
      placementData.recentChanges = [{ type: 'new', changedAt: new Date() }];
      
      const placement = await Placement.create(placementData);
      res.status(201).json({ success: true, data: placement });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/placements/:id — auth required
router.put(
  '/:id',
  auth,
  csrfCheck,
  placementValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const existingPlacement = await Placement.findById(req.params.id);
      if (!existingPlacement) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found',
        });
      }

      const updateData = { ...req.body };
      delete updateData.recentChanges;

      let statusChanged = false;
      if (updateData.status && updateData.status !== existingPlacement.status) {
        statusChanged = true;
        updateData.statusManuallySet = true;
      }

      const changeType = statusChanged ? 'statusChange' : 'edit';

      const placement = await Placement.findByIdAndUpdate(
        req.params.id,
        {
          $set: updateData,
          $push: {
            recentChanges: {
              $each: [{ type: changeType, changedAt: new Date() }],
              $slice: -10,
            },
          },
        },
        { new: true, runValidators: true }
      );
      res.json({ success: true, data: placement });
    } catch (error) {
      next(error);
    }
  }
);

const updatePlacementWithLog = async (id, setFields, changeType) => {
  return await Placement.findByIdAndUpdate(
    id,
    {
      $set: setFields,
      $push: {
        recentChanges: {
          $each: [{ type: changeType, changedAt: new Date() }],
          $slice: -10,
        },
      },
    },
    { new: true, runValidators: true }
  );
};

// PATCH /api/placements/:id/postpone — lightweight toggle, auth required
router.patch(
  '/:id/postpone',
  auth,
  csrfCheck,
  postponeValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const changeType = req.body.isPostponed ? 'postponed' : 'unpostponed';
      const placement = await updatePlacementWithLog(req.params.id, { isPostponed: req.body.isPostponed }, changeType);
      
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
  }
);

// PATCH /api/placements/:id/reset-status-automation — lightweight toggle, auth required
router.patch(
  '/:id/reset-status-automation',
  auth,
  csrfCheck,
  resetStatusValidationRules,
  validate,
  async (req, res, next) => {
    try {
      const placement = await updatePlacementWithLog(req.params.id, { statusManuallySet: req.body.statusManuallySet }, 'automationReset');
      
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
  }
);

// DELETE /api/placements/:id — auth required
router.delete('/:id', auth, csrfCheck, async (req, res, next) => {
  try {
    const placement = await Placement.findByIdAndDelete(req.params.id);
    if (!placement) {
      return res.status(404).json({
        success: false,
        message: 'Placement not found',
      });
    }
    res.json({ success: true, message: 'Placement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
