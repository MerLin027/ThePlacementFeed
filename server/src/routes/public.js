const express = require('express');
const publicDrives = require('../features/drives/public.routes');
const publicCatalog = require('../features/catalog/public.routes');
const cron = require('../features/cron/routes');

// Public: no account needed. Nothing here returns personal data.
const router = express.Router();

router.get('/health', (req, res) => {
  // `via` says whether this request came through the website's proxy (the secret checked out)
  res.json({ success: true, message: 'Server is running', via: req.viaWebsite ? 'website' : 'direct' });
});
router.use('/drives', publicDrives);
router.use('/catalog', publicCatalog);
// Machine-to-machine: protected by the CRON_SECRET bearer token instead of a session
router.use('/cron', cron);

module.exports = router;
