const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { config } = require('./config/env');
const requestId = require('./middleware/requestId');
const trustedProxy = require('./middleware/trustedProxy');
const sanitizeRequest = require('./middleware/sanitize');
const errorHandler = require('./middleware/errorHandler');
const api = require('./routes');

/**
 * Builds the Express app (index.js starts it). The middleware order is the security model, top to
 * bottom: identify the request, find the real client address, security headers and CORS, parse and
 * sanitise the body, log, then the routes and the error handler.
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

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
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
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
