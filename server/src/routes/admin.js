const express = require('express');
const { requireStaff, requirePermission } = require('../features/auth/guards');
const { PERMISSIONS } = require('../features/auth/permissions');
const drives = require('../features/drives/admin.routes');
const students = require('../features/students/admin.routes');
const insights = require('../features/insights/routes');
const catalog = require('../features/catalog/admin.routes');
const staff = require('../features/staff/routes');

/**
 * /api/admin — staff only. Access control for everything below is here:
 *  1. a staff session is required for every route (including ones added later), and a staff account
 *     that must still change its one-time password is refused (it may only use /api/auth);
 *  2. each area then requires its permission (features/auth/permissions.js), so an admin can't
 *     reach Setup or the team, whatever the client sends.
 */
const router = express.Router();

router.use(requireStaff);

router.use('/drives', requirePermission(PERMISSIONS.DRIVES), drives);
router.use('/students', requirePermission(PERMISSIONS.STUDENTS), students);
router.use('/insights', requirePermission(PERMISSIONS.INSIGHTS), insights);
router.use('/catalog', requirePermission(PERMISSIONS.SETUP), catalog);
router.use('/staff', requirePermission(PERMISSIONS.STAFF), staff);

module.exports = router;
