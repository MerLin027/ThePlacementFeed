const express = require('express');
const { requireStudentAllowPending, requireStudent } = require('../features/auth/guards');
const profile = require('../features/students/profile.routes');
const applications = require('../features/applications/routes');

/**
 * /api/student — the signed-in student's own data. Access control for everything below is here:
 *  1. a student session is required for every route (including ones added later);
 *  2. reading the profile is allowed while a reset password must still be changed;
 *  3. everything after the second guard is refused until it has been changed.
 */
const router = express.Router();

router.use(requireStudentAllowPending);
router.get('/profile', profile.readProfile);

router.use(requireStudent);
router.use('/profile', profile.router);
router.use('/applications', applications);

module.exports = router;
