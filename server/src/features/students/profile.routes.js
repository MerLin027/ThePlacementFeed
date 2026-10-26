const express = require('express');
const Student = require('../../models/Student');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { requireStudent, requireStudentAllowPending } = require('../auth/guards');
const catalog = require('../catalog/cache');
const { profileRules, chooseInstituteRules } = require('./validators');
const { toProfileDTO } = require('./dto');

// The signed-in student's own profile
const router = express.Router();

// Fields a student may edit. Identity and auth fields are never accepted from the body.
const EDITABLE_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'branch',
  'cgpa',
  'activeBacklogs',
  'graduationYear',
  'phone',
  'resumeUrl',
];

const profileUpdate = limit('profileUpdate');

const invalidSession = (res) => fail(res, 401, 'Invalid or expired session');

// GET /me — allowed while a password change is pending
router.get('/me', limit('profileRead'), requireStudentAllowPending, async (req, res, next) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) return invalidSession(res);
    res.json({ success: true, data: toProfileDTO(student) });
  } catch (error) {
    next(error);
  }
});

// PATCH /me
router.patch('/me', requireStudent, profileUpdate, profileRules, validate, async (req, res, next) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) return invalidSession(res);

    // An archived branch can be kept, but not newly chosen
    const { branch } = req.body;
    if (branch && branch !== student.branch && !catalog.isBranchCode(branch, { activeOnly: true })) {
      return fieldError(res, 'branch', 'Please choose a branch from the list');
    }

    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      const value = req.body[field];
      // Empty string / null clears an optional field
      student.set(field, value === '' || value === null ? undefined : value);
    }

    await student.save();
    res.json({ success: true, data: toProfileDTO(student) });
  } catch (error) {
    next(error);
  }
});

// PUT /me/institute — a one-time choice. The update only matches while no institute is set, so a
// second (or concurrent) request can't change it; only the admin can clear it.
router.put('/me/institute', requireStudent, profileUpdate, chooseInstituteRules, validate, async (req, res, next) => {
  try {
    const institute = catalog.getInstitute(req.body.instituteId);
    if (!institute || !institute.active) {
      return fieldError(res, 'instituteId', 'Please choose an institute from the list');
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.student.id, instituteId: null },
      { $set: { instituteId: institute.id, instituteSetAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!student) {
      if (!(await Student.exists({ _id: req.student.id }))) return invalidSession(res);
      return fail(res, 409, 'Your institute is already set. Ask the CDPC admin if it needs to change.', { code: 'INSTITUTE_LOCKED' });
    }
    res.json({ success: true, data: toProfileDTO(student) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
