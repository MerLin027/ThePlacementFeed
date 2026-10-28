const express = require('express');
const Placement = require('../../models/Placement');
const { limit } = require('../../middleware/rateLimit');
const { fail } = require('../../lib/http');
const { freshStatuses } = require('./freshness');
const { parseListQuery, listDrives, changesSince } = require('./service');
const { toPublicDrive } = require('./dto');

// Mounted at /api/drives — public drive data: the list, the change feed for notifications, one drive
const router = express.Router();

// One budget for browsing (the list and single drives); the change feed, polled by every open tab,
// has its own
const publicRead = limit('publicRead');
const driveChanges = limit('driveChanges');

const badRequest = (res, message) => fail(res, 400, message, { code: 'INVALID_QUERY' });

// GET / — paginated, filterable
router.get('/', publicRead, freshStatuses, async (req, res, next) => {
  try {
    const query = parseListQuery(req.query);
    if (query.error) return badRequest(res, query.error);
    const { drives, total } = await listDrives(query.filter, query);
    res.json({
      success: true,
      data: drives.map(toPublicDrive),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /changes?since=ISO — recent changes, newest first. serverTime is the client's next cursor, so
// device clock skew can't drop changes.
router.get('/changes', driveChanges, freshStatuses, async (req, res, next) => {
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
    if (!drive) return fail(res, 404, 'Placement not found');
    res.json({ success: true, data: toPublicDrive(drive) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
