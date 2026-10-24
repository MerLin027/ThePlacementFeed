const express = require('express');
const rateLimit = require('express-rate-limit');
const catalog = require('../services/catalog');

const router = express.Router();

const catalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/catalog — public: the university name, branches (archived ones flagged, so old drives
// keep their labels) and the institutes a student can choose. No personal data.
router.get('/', catalogLimiter, (req, res) => {
  // Revalidate every time (a cheap 304 via the ETag): admin changes must show up straight away
  res.set('Cache-Control', 'no-cache');
  res.json({ success: true, data: catalog.toPublicCatalog() });
});

module.exports = router;
