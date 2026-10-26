const crypto = require('crypto');

// A fresh id per request, returned as X-Request-Id and attached to error logs and audit events, so a
// report from a user ("it failed at 10:42") can be matched to the server's records. Ids sent by the
// client are ignored: they could be used to forge or confuse log entries.
const requestId = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
