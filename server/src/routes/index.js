const express = require('express');
const legacy = require('./legacy');
const publicRoutes = require('./public');
const studentRoutes = require('./student');
const adminRoutes = require('./admin');
const auth = require('../features/auth/routes');

/**
 * The API by audience. Access control lives in the namespace files, applied once at the top, so a
 * route added later is covered automatically:
 *   /api/health, /drives, /catalog, /cron  public (routes/public.js)
 *   /api/auth                              signing in, out and up; one's own password
 *   /api/student/*                         a signed-in student (routes/student.js)
 *   /api/admin/*                           a signed-in staff account, plus a permission per area
 *                                          (routes/admin.js)
 */
const api = express.Router();

// TEMPORARY: old addresses for the website version that is being replaced (see legacy.js)
api.use(legacy);

api.use(publicRoutes);
api.use('/auth', auth);
api.use('/student', studentRoutes);
api.use('/admin', adminRoutes);

module.exports = api;
