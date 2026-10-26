const express = require('express');
const adminAuth = require('../features/auth/admin.routes');
const studentAuth = require('../features/auth/student.routes');
const publicDrives = require('../features/drives/public.routes');
const adminDrives = require('../features/drives/admin.routes');
const studentProfile = require('../features/students/profile.routes');
const adminStudents = require('../features/students/admin.routes');
const studentApplications = require('../features/applications/routes');
const publicCatalog = require('../features/catalog/public.routes');
const adminCatalog = require('../features/catalog/admin.routes');
const adminInsights = require('../features/insights/routes');
const cron = require('../features/cron/routes');

// Every API route, by URL
const api = express.Router();

api.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

api.use('/auth', adminAuth.authRouter, adminAuth.passwordRouter);
// Public reads first; anything they don't match (writes, admin reads) falls through to the admin
// router, whose routes each require an admin session
api.use('/placements', publicDrives, adminDrives);
api.use('/students/auth', studentAuth.authRouter);
api.use('/students/me', studentAuth.passwordRouter);
api.use('/students', studentProfile);
api.use('/applications', studentApplications);
api.use('/admin/students', adminStudents);
api.use('/catalog', publicCatalog);
api.use('/admin/catalog', adminCatalog);
api.use('/admin/insights', adminInsights);
api.use('/cron', cron);

module.exports = api;
