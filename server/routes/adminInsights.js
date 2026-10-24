const express = require('express');
const { query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Application = require('../models/Application');
const Placement = require('../models/Placement');
const Student = require('../models/Student');
const requireAdmin = require('../middleware/requireAdmin');
const { validate } = require('../middleware/validate');
const { REQUIRED_PROFILE_FIELDS } = require('../models/Student');
const { APPLICATION_STATUSES } = require('../models/Application');

// Mounted at /api/admin/insights — numbers for the dashboard charts, admin-only
const router = express.Router();

router.use(requireAdmin);

const insightsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const TEXT_FIELDS = new Set(['firstName', 'lastName', 'branch', 'phone', 'resumeUrl']);
const completeProfile = {
  $and: REQUIRED_PROFILE_FIELDS.map((f) => ({ [f]: { $nin: TEXT_FIELDS.has(f) ? [null, ''] : [null] } })),
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Monday 00:00 IST of the week containing `date`, as a UTC Date
const istWeekStart = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const mondayIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday);
  return new Date(mondayIst - IST_OFFSET_MS);
};

// GET /api/admin/insights?weeks=12
router.get(
  '/',
  insightsLimiter,
  query('weeks').optional().isInt({ min: 4, max: 52 }).withMessage('weeks must be from 4 to 52').toInt(),
  validate,
  async (req, res, next) => {
    try {
      const weeks = req.query.weeks || 12;
      const now = new Date();
      const firstWeek = new Date(istWeekStart(now).getTime() - (weeks - 1) * 7 * DAY_MS);

      const [
        activeDrives,
        students,
        studentsComplete,
        applications,
        applicationsLast7,
        byStatus,
        placed,
        weekly,
        perDrive,
        perBranch,
        drivesByStatus,
      ] = await Promise.all([
        Placement.countDocuments({ status: { $in: ['Upcoming', 'Ongoing'] }, isPostponed: { $ne: true } }),
        Student.countDocuments(),
        Student.countDocuments(completeProfile),
        Application.countDocuments(),
        Application.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
        Application.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        Application.distinct('studentId', { status: 'Offered' }),
        // Bucketed by IST week in code rather than with $dateTrunc, which needs MongoDB 5+
        Application.find({ createdAt: { $gte: firstWeek } }).select('createdAt').lean(),
        Application.aggregate([
          { $group: { _id: { drive: '$driveId', status: '$status' }, n: { $sum: 1 } } },
          { $group: { _id: '$_id.drive', total: { $sum: '$n' }, statuses: { $push: { k: '$_id.status', v: '$n' } } } },
          { $sort: { total: -1 } },
          { $limit: 8 },
          // Plain $lookup (localField together with a pipeline needs MongoDB 5+)
          { $lookup: { from: 'placements', localField: '_id', foreignField: '_id', as: 'drive' } },
          { $unwind: '$drive' },
          { $project: { total: 1, statuses: 1, 'drive.company': 1, 'drive.role': 1 } },
        ]),
        Application.aggregate([
          { $match: { 'snapshot.branch': { $type: 'string', $ne: '' } } },
          {
            $group: {
              _id: '$snapshot.branch',
              applications: { $sum: 1 },
              selected: { $sum: { $cond: [{ $eq: ['$status', 'Offered'] }, 1, 0] } },
            },
          },
          { $sort: { applications: -1 } },
          { $limit: 10 },
        ]),
        Placement.aggregate([
          { $group: { _id: { $cond: [{ $eq: ['$isPostponed', true] }, 'Postponed', '$status'] }, n: { $sum: 1 } } },
        ]),
      ]);

      const pipeline = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
      byStatus.forEach(({ _id, n }) => {
        if (_id in pipeline) pipeline[_id] = n;
      });

      const weekStarts = Array.from({ length: weeks }, (_, i) => new Date(firstWeek.getTime() + i * 7 * DAY_MS));
      const weekCounts = new Array(weeks).fill(0);
      weekly.forEach(({ createdAt }) => {
        const i = Math.floor((createdAt.getTime() - firstWeek.getTime()) / (7 * DAY_MS));
        if (i >= 0 && i < weeks) weekCounts[i] += 1;
      });

      const drives = Object.fromEntries(['Upcoming', 'Ongoing', 'Completed', 'Postponed'].map((s) => [s, 0]));
      drivesByStatus.forEach(({ _id, n }) => {
        if (_id in drives) drives[_id] = n;
      });

      res.json({
        success: true,
        data: {
          kpis: {
            activeDrives,
            students,
            studentsComplete,
            applications,
            applicationsLast7,
            selected: pipeline.Offered,
            studentsPlaced: placed.length,
          },
          pipeline,
          // weekStart: Monday of each IST week (YYYY-MM-DD, IST)
          weekly: weekStarts.map((d, i) => ({
            weekStart: new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10),
            applications: weekCounts[i],
          })),
          topDrives: perDrive.map((d) => ({
            id: d._id.toString(),
            company: d.drive.company,
            role: d.drive.role,
            total: d.total,
            statuses: Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, d.statuses.find((x) => x.k === s)?.v || 0])),
          })),
          branches: perBranch.map((b) => ({ code: b._id, applications: b.applications, selected: b.selected })),
          drives,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
