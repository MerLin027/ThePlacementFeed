const express = require('express');
const rateLimit = require('express-rate-limit');
const Branch = require('../models/Branch');
const Institute = require('../models/Institute');
const Setting = require('../models/Setting');
const Student = require('../models/Student');
const Placement = require('../models/Placement');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const {
  branchCreateRules,
  catalogUpdateRules,
  instituteCreateRules,
  universityRules,
  catalogDeleteRules,
  mongoIdParam,
  validate,
} = require('../middleware/validate');
const catalog = require('../services/catalog');
const { logAdminAction } = require('../utils/auditLog');

// Mounted at /api/admin/catalog — the lists students and drives choose from
const router = express.Router();

// Every route here is admin-only
router.use(requireAdmin);

const limiterMessage = (message) => ({ success: false, message });

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: limiterMessage('Too many changes. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const notFound = (res, what) => res.status(404).json({ success: false, message: `${what} not found` });
const duplicate = (res, message) => res.status(409).json({ success: false, code: 'DUPLICATE', message });

// How many students and drives use each branch code, and how many students each institute has
const usageCounts = async () => {
  const [studentsByBranch, studentsByInstitute, drivesByBranch] = await Promise.all([
    Student.aggregate([{ $match: { branch: { $type: 'string' } } }, { $group: { _id: '$branch', n: { $sum: 1 } } }]),
    Student.aggregate([{ $match: { instituteId: { $type: 'objectId' } } }, { $group: { _id: '$instituteId', n: { $sum: 1 } } }]),
    Placement.aggregate([
      { $unwind: '$eligibility.branches' },
      {
        $group: {
          _id: '$eligibility.branches',
          open: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 0, 1] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        },
      },
    ]),
  ]);
  return {
    branchStudents: new Map(studentsByBranch.map((r) => [r._id, r.n])),
    instituteStudents: new Map(studentsByInstitute.map((r) => [r._id.toString(), r.n])),
    branchDrives: new Map(drivesByBranch.map((r) => [r._id, { open: r.open, completed: r.completed }])),
  };
};

const branchUsage = async (code) => {
  const [students, openDrives, completedDrives, onlyBranchDrives] = await Promise.all([
    Student.countDocuments({ branch: code }),
    Placement.countDocuments({ 'eligibility.branches': code, status: { $ne: 'Completed' } }),
    Placement.countDocuments({ 'eligibility.branches': code, status: 'Completed' }),
    // Removing the only branch would leave an empty list, which means "every branch can apply"
    Placement.find({ 'eligibility.branches': [code], status: { $ne: 'Completed' } })
      .select('company role')
      .limit(20)
      .lean(),
  ]);
  return {
    students,
    openDrives,
    completedDrives,
    onlyBranchDrives: onlyBranchDrives.map((d) => ({ id: d._id.toString(), company: d.company, role: d.role })),
  };
};

// GET /api/admin/catalog — everything the Settings page shows, with usage counts
router.get('/', readLimiter, async (req, res, next) => {
  try {
    await catalog.reload();
    const { branchStudents, instituteStudents, branchDrives } = await usageCounts();
    res.json({
      success: true,
      data: {
        university: catalog.getUniversity(),
        branches: catalog.getBranches().filter((b) => b.id).map((b) => ({
          ...b,
          students: branchStudents.get(b.code) || 0,
          openDrives: branchDrives.get(b.code)?.open || 0,
          completedDrives: branchDrives.get(b.code)?.completed || 0,
        })),
        institutes: catalog.getInstitutes().map((i) => ({ ...i, students: instituteStudents.get(i.id) || 0 })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/catalog/university — the College/University name shown on every profile
router.put('/university', writeLimiter, csrfCheck, universityRules, validate, async (req, res, next) => {
  try {
    await Setting.findOneAndUpdate(
      { key: 'university' },
      { $set: { value: { name: req.body.name } } },
      { upsert: true }
    );
    await catalog.reload();
    logAdminAction(req, 'catalog.university.update');
    res.json({ success: true, data: { university: catalog.getUniversity() } });
  } catch (error) {
    next(error);
  }
});

// --- Branches ---

router.post('/branches', writeLimiter, csrfCheck, branchCreateRules, validate, async (req, res, next) => {
  try {
    const last = await Branch.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const branch = await Branch.create({ code: req.body.code, name: req.body.name, sortOrder: (last?.sortOrder ?? -1) + 1 });
    await catalog.reload();
    logAdminAction(req, 'catalog.branch.create', { branchId: branch._id.toString(), code: branch.code });
    res.status(201).json({ success: true, data: catalog.findBranch(branch.code) });
  } catch (error) {
    if (error.code === 11000) return duplicate(res, 'A branch with this code already exists.');
    next(error);
  }
});

// PATCH /api/admin/catalog/branches/:id — rename and/or archive; the code never changes
router.patch(
  '/branches/:id',
  writeLimiter,
  csrfCheck,
  mongoIdParam('id'),
  catalogUpdateRules('Branch name'),
  validate,
  async (req, res, next) => {
    try {
      const branch = await Branch.findById(req.params.id);
      if (!branch) return notFound(res, 'Branch');
      if (req.body.name !== undefined) branch.name = req.body.name;
      if (req.body.active !== undefined) branch.active = req.body.active;
      await branch.save();
      await catalog.reload();
      logAdminAction(req, 'catalog.branch.update', { branchId: branch._id.toString(), active: branch.active });
      res.json({ success: true, data: catalog.findBranch(branch.code) });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/catalog/branches/:id/usage — what a delete would touch (for the two-step prompt)
router.get('/branches/:id/usage', readLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id).select('code').lean();
    if (!branch) return notFound(res, 'Branch');
    res.json({ success: true, data: await branchUsage(branch.code) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/catalog/branches/:id[?force=true]
// Unused branches are deleted. One in use answers 409 IN_USE with the counts, unless forced: then
// its students choose a branch again, it is removed from open drives (completed drives keep it as
// history), and the branch is deleted. An open drive that lists only this branch blocks the delete.
router.delete(
  '/branches/:id',
  writeLimiter,
  csrfCheck,
  mongoIdParam('id'),
  catalogDeleteRules,
  validate,
  async (req, res, next) => {
    try {
      const branch = await Branch.findById(req.params.id).lean();
      if (!branch) return notFound(res, 'Branch');

      const usage = await branchUsage(branch.code);
      const inUse = usage.students > 0 || usage.openDrives > 0 || usage.completedDrives > 0;
      if (inUse && req.query.force !== 'true') {
        return res.status(409).json({ success: false, code: 'IN_USE', message: 'This branch is in use.', usage });
      }
      if (usage.onlyBranchDrives.length > 0) {
        return res.status(409).json({
          success: false,
          code: 'ONLY_BRANCH',
          message: 'Some open drives are only for this branch. Change their eligible branches first.',
          usage,
        });
      }

      // References first, the branch last: a retry after a failure finishes the job
      const [students, drives] = await Promise.all([
        Student.updateMany({ branch: branch.code }, { $unset: { branch: '' } }),
        Placement.updateMany(
          { 'eligibility.branches': branch.code, status: { $ne: 'Completed' } },
          { $pull: { 'eligibility.branches': branch.code } }
        ),
      ]);
      await Branch.deleteOne({ _id: branch._id });
      await catalog.reload();

      logAdminAction(req, 'catalog.branch.delete', {
        branchId: branch._id.toString(),
        code: branch.code,
        clearedStudents: students.modifiedCount,
        updatedDrives: drives.modifiedCount,
      });
      res.json({
        success: true,
        message: 'Branch deleted',
        clearedStudents: students.modifiedCount,
        updatedDrives: drives.modifiedCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// --- Institutes ---

router.post('/institutes', writeLimiter, csrfCheck, instituteCreateRules, validate, async (req, res, next) => {
  try {
    const institute = await Institute.create({ name: req.body.name });
    await catalog.reload();
    logAdminAction(req, 'catalog.institute.create', { instituteId: institute._id.toString() });
    res.status(201).json({ success: true, data: catalog.getInstitute(institute._id) });
  } catch (error) {
    if (error.code === 11000) return duplicate(res, 'An institute with this name already exists.');
    next(error);
  }
});

router.patch(
  '/institutes/:id',
  writeLimiter,
  csrfCheck,
  mongoIdParam('id'),
  catalogUpdateRules('Institute name'),
  validate,
  async (req, res, next) => {
    try {
      const institute = await Institute.findById(req.params.id);
      if (!institute) return notFound(res, 'Institute');
      if (req.body.name !== undefined) institute.name = req.body.name;
      if (req.body.active !== undefined) institute.active = req.body.active;
      await institute.save();
      await catalog.reload();
      logAdminAction(req, 'catalog.institute.update', { instituteId: institute._id.toString(), active: institute.active });
      res.json({ success: true, data: catalog.getInstitute(institute._id) });
    } catch (error) {
      if (error.code === 11000) return duplicate(res, 'An institute with this name already exists.');
      next(error);
    }
  }
);

// DELETE /api/admin/catalog/institutes/:id[?force=true]
// One in use answers 409 IN_USE unless forced: then its students' choice is cleared (they pick
// again before they can apply) and the institute is deleted. Past applications keep the name.
router.delete(
  '/institutes/:id',
  writeLimiter,
  csrfCheck,
  mongoIdParam('id'),
  catalogDeleteRules,
  validate,
  async (req, res, next) => {
    try {
      const institute = await Institute.findById(req.params.id).lean();
      if (!institute) return notFound(res, 'Institute');

      const students = await Student.countDocuments({ instituteId: institute._id });
      if (students > 0 && req.query.force !== 'true') {
        return res.status(409).json({ success: false, code: 'IN_USE', message: 'This institute is in use.', usage: { students } });
      }

      const cleared = await Student.updateMany(
        { instituteId: institute._id },
        { $unset: { instituteId: '', instituteSetAt: '' } }
      );
      await Institute.deleteOne({ _id: institute._id });
      await catalog.reload();

      logAdminAction(req, 'catalog.institute.delete', {
        instituteId: institute._id.toString(),
        clearedStudents: cleared.modifiedCount,
      });
      res.json({ success: true, message: 'Institute deleted', clearedStudents: cleared.modifiedCount });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
