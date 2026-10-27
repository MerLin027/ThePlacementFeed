const express = require('express');
const publicDrives = require('../features/drives/public.routes');
const publicCatalog = require('../features/catalog/public.routes');
const cron = require('../features/cron/routes');

// Public: no account needed. Nothing here returns personal data.
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', proxy: req.proxyCheck });
});
router.use('/drives', publicDrives);
router.use('/catalog', publicCatalog);
// Machine-to-machine: protected by the CRON_SECRET bearer token instead of a session
router.use('/cron', cron);

module.exports = router;
