const crypto = require('crypto');
const express = require('express');
const { config } = require('../../config/env');
const { limit } = require('../../middleware/rateLimit');
const { fail } = require('../../lib/http');
const { runStatusTransitionJob } = require('../drives/freshness');

const router = express.Router();

// Compare fixed-length digests in constant time so response timing doesn't leak the secret
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();

// GET /api/cron/trigger — lets an external scheduler (cron-job.org, Render cron) run the status job
// over HTTP, for instances that sleep through midnight. Protected by a shared CRON_SECRET bearer
// token; disabled entirely when no secret is configured. The job is idempotent.
router.get('/trigger', limit('cronTrigger'), async (req, res) => {
  const { cronSecret } = config();
  if (!cronSecret) {
    return fail(res, 503, 'Cron endpoint is not configured.', { code: 'NOT_CONFIGURED' });
  }

  const authHeader = req.headers.authorization || '';
  if (!crypto.timingSafeEqual(digest(authHeader), digest(`Bearer ${cronSecret}`))) {
    return fail(res, 401, 'Unauthorized');
  }

  try {
    await runStatusTransitionJob();
    res.json({ success: true, message: 'Status transition job executed successfully.' });
  } catch (err) {
    console.error('[CronTrigger] Error executing status transition job:', err);
    fail(res, 500, 'Status transition job failed.');
  }
});

module.exports = router;
