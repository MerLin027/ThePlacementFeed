const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { config } = require('./config/env');
const requestId = require('./middleware/requestId');
const trustedProxy = require('./middleware/trustedProxy');
const { csrfProtection, jsonOnly } = require('./middleware/csrf');
const sanitizeRequest = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const api = require('./routes');

// The largest real payload (a drive with a long description and its questions) is about 25 KB
const BODY_LIMIT = '100kb';

/**
 * Builds the Express app (index.js starts it). The middleware order is the security model, top to
 * bottom: identify the request, find the real client address, security headers and CORS, refuse
 * cross-site and non-JSON writes, parse and sanitise the body, log, then the routes, a JSON 404 and
 * the error handler.
 */
const createApp = () => {
  const { clientUrl, isProduction } = config();
  const app = express();

  // Render sits behind one reverse proxy
  app.set('trust proxy', 1);
  app.use(requestId);
  // Requests proxied by Vercel: the visitor's address, when the shared secret proves where it came from
  app.use(trustedProxy);

  app.use(helmet());
  app.use(cors({ origin: clientUrl, credentials: true }));

  // Every state-changing API request, before anything reads its body
  app.use('/api', csrfProtection, jsonOnly);

  // JSON only: no form-encoded parser, so an HTML form can't post to the API
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // API responses are per-user or live: never stored by the Vercel proxy or the browser, unless a
  // route says otherwise
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', api);
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
