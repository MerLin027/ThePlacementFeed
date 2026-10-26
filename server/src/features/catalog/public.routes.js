const express = require('express');
const catalog = require('./cache');
const { limit } = require('../../middleware/rateLimit');

const router = express.Router();

// GET /api/catalog — public: the university name, branches (archived ones flagged, so old drives
// keep their labels) and the institutes a student can choose. No personal data.
router.get('/', limit('catalogRead'), (req, res) => {
  // Revalidate every time (a cheap 304 via the ETag): admin changes must show up straight away
  res.set('Cache-Control', 'no-cache');
  res.json({ success: true, data: catalog.toPublicCatalog() });
});

module.exports = router;
