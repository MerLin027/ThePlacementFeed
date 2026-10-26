const express = require('express');
const { describeAccount, loadAccountDoc } = require('../features/auth/accounts');

/**
 * TEMPORARY (one release): the API's old addresses, so a browser still running the previous version
 * of the website keeps working while the new one deploys. Requests are rewritten to the new routes,
 * which apply all the usual guards; nothing here grants access by itself. Delete this file (and its
 * line in routes/index.js) once the new website is live.
 */
const router = express.Router();

// [method or '*', old path pattern, new path] — first match wins
const REWRITES = [
  ['POST', /^\/students\/auth\/signup$/, '/auth/signup'],
  ['POST', /^\/(students\/)?auth\/login$/, '/auth/login'],
  ['POST', /^\/(students\/)?auth\/logout$/, '/auth/logout'],
  ['POST', /^\/auth\/password$/, '/auth/password'],
  ['POST', /^\/students\/me\/password$/, '/auth/password'],
  ['*', /^\/students\/me\/institute$/, '/student/profile/institute'],
  ['*', /^\/students\/me$/, '/student/profile'],
  ['GET', /^\/applications\/my\/summary$/, '/student/applications/summary'],
  ['GET', /^\/applications\/my$/, '/student/applications'],
  ['POST', /^\/applications$/, '/student/applications'],
  ['GET', /^\/placements\/changes$/, '/drives/changes'],
  ['*', /^\/placements\/([^/]+)\/applicants(\/.*)?$/, '/admin/drives/$1/applicants$2'],
  ['*', /^\/placements\/([^/]+)\/reset-status-automation$/, '/admin/drives/$1/status-automation'],
  ['*', /^\/placements\/([^/]+)\/(postpone|application-count)$/, '/admin/drives/$1/$2'],
];

router.use((req, res, next) => {
  const [path, query = ''] = req.url.split(/\?(.*)/s);
  const qs = query ? `?${query}` : '';

  // Old login bodies named the identifier after the account kind
  if (req.method === 'POST' && /^\/(students\/)?auth\/login$/.test(path) && req.body && req.body.identifier === undefined) {
    req.body.identifier = req.body.username ?? req.body.email;
  }

  for (const [method, pattern, target] of REWRITES) {
    if ((method === '*' || method === req.method) && pattern.test(path)) {
      req.url = path.replace(pattern, target) + qs;
      return next();
    }
  }

  // The drive list and one drive: staff (the old dashboard) read them with staff fields
  if (/^\/placements(\/[^/]+)?$/.test(path)) {
    const staffRead = req.method === 'GET' && req.account?.type === 'staff';
    const toAdmin = req.method !== 'GET' || (staffRead && path === '/placements');
    req.url = path.replace(/^\/placements/, toAdmin ? '/admin/drives' : '/drives') + qs;
  }
  next();
});

// The old "who am I" probes, one per account kind
router.get('/auth/check', async (req, res, next) => {
  try {
    if (req.account?.type !== 'staff') return res.json({ success: true, authenticated: false });
    res.json({ success: true, authenticated: true, username: req.account.username });
  } catch (error) {
    next(error);
  }
});

router.get('/students/auth/check', async (req, res, next) => {
  try {
    if (req.account?.type !== 'student') return res.json({ success: true, authenticated: false });
    const doc = await loadAccountDoc('student', req.account.id);
    if (!doc) return res.json({ success: true, authenticated: false });
    res.json({ success: true, authenticated: true, student: describeAccount('student', doc) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
