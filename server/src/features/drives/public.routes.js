const express = require('express');
const Placement = require('../../models/Placement');
const { DRIVE_STATUSES } = require('../../models/Placement');
const { limit } = require('../../middleware/rateLimit');
const { fail } = require('../../lib/http');
const { freshStatuses } = require('./freshness');
const { PUBLIC_SORTS, buildDriveFilter, listDrives, changesSince } = require('./service');

// Public drive data: the list, the change feed for notifications, one drive
const router = express.Router();

// One budget across the public drive endpoints
const publicRead = limit('publicRead');

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 100;
const MAX_BRANCH_FILTERS = 20;

const badRequest = (res, message) => fail(res, 400, message, { code: 'INVALID_QUERY' });

// GET / — paginated, filterable
router.get('/', publicRead, freshStatuses, async (req, res, next) => {
  try {
    const { branch, status, ctcMin, ctcMax, search, sort, page, limit: pageSize } = req.query;

    // Every filter is a plain string. Repeated keys (arrays) and bracket syntax (objects) are rejected
    // up front instead of crashing the handlers below or reaching the query builder.
    if ([branch, status, ctcMin, ctcMax, search, sort, page, pageSize].some((v) => v !== undefined && typeof v !== 'string')) {
      return badRequest(res, 'Invalid query parameter');
    }

    // status may be a single value or a comma-separated list ("Upcoming,Ongoing")
    const statuses = status ? [...new Set(status.split(',').map((s) => s.trim()))] : [];
    if (status !== undefined && statuses.some((s) => !DRIVE_STATUSES.includes(s))) {
      return badRequest(res, `Invalid status. Must be one or more of: ${DRIVE_STATUSES.join(', ')}`);
    }
    if (sort !== undefined && !PUBLIC_SORTS.includes(sort)) {
      return badRequest(res, `Invalid sort. Must be one of: ${PUBLIC_SORTS.join(', ')}`);
    }

    const parsedCtcMin = ctcMin !== undefined ? Number(ctcMin) : undefined;
    const parsedCtcMax = ctcMax !== undefined ? Number(ctcMax) : undefined;
    if (ctcMin !== undefined && Number.isNaN(parsedCtcMin)) return badRequest(res, 'ctcMin must be a valid number');
    if (ctcMax !== undefined && Number.isNaN(parsedCtcMax)) return badRequest(res, 'ctcMax must be a valid number');

    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = pageSize ? parseInt(pageSize, 10) : DEFAULT_PAGE_SIZE;
    if (Number.isNaN(parsedPage) || parsedPage < 1 || parsedPage > MAX_PAGE) return badRequest(res, 'page must be a positive integer');
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) return badRequest(res, 'limit must be a positive integer');
    const effectiveLimit = Math.min(parsedLimit, MAX_PAGE_SIZE);
    if (search && search.length > MAX_SEARCH_LENGTH) return badRequest(res, `search cannot exceed ${MAX_SEARCH_LENGTH} characters`);
    const branches = branch ? branch.split(',').map((b) => b.trim()) : [];
    if (branches.length > MAX_BRANCH_FILTERS) return badRequest(res, 'Too many branches');

    const filter = buildDriveFilter({
      statuses,
      branches,
      ctcMin: parsedCtcMin,
      ctcMax: parsedCtcMax,
      search,
    });
    const { drives, total } = await listDrives(filter, { sort, page: parsedPage, limit: effectiveLimit });

    res.json({
      success: true,
      data: drives,
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

// GET /changes?since=ISO — recent changes, newest first. serverTime is the client's next cursor, so
// device clock skew can't drop changes.
router.get('/changes', publicRead, freshStatuses, async (req, res, next) => {
  try {
    const { since } = req.query;
    if (typeof since !== 'string' || !since) return badRequest(res, 'since timestamp is required');

    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) return badRequest(res, 'Invalid since timestamp');

    res.json({ success: true, data: await changesSince(sinceDate), serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /:id
router.get('/:id', publicRead, freshStatuses, async (req, res, next) => {
  try {
    const drive = await Placement.findById(req.params.id).lean();
    if (!drive) {
      return fail(res, 404, 'Placement not found');
    }
    res.json({ success: true, data: drive });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
