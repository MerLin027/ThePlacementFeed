const { fail } = require('../lib/http');

// Unknown /api routes: JSON like every other API answer (not Express's HTML page)
const notFound = (req, res) => fail(res, 404, 'Not found');

// What a client sees for each kind of error. Library messages are never passed through: they can
// describe internals ("Unexpected token } in JSON at position 5").
const describe = (err) => {
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'The request body is not valid JSON.', code: 'INVALID_JSON' };
  if (err.type === 'entity.too.large') return { status: 413, message: 'The request is too large.' };
  if (err.name === 'ValidationError') {
    // Mongoose schema validation: same { field, message } shape as the validators
    const errors = Object.entries(err.errors || {}).map(([field, e]) => ({ field, message: e.message }));
    return { status: 400, message: 'Validation failed', code: 'VALIDATION_FAILED', errors };
  }
  if (err.code === 11000) return { status: 409, message: 'Duplicate entry detected' };
  if (err.name === 'CastError') return { status: 400, message: 'Invalid ID format', code: 'INVALID_ID' };
  const status = Number.isInteger(err.statusCode || err.status) ? err.statusCode || err.status : 500;
  if (status >= 400 && status < 500) return { status, message: 'The request could not be processed.' };
  return { status: 500, message: 'Something went wrong' };
};

// Global error handler: one log line per client error (anyone can trigger those), the full stack
// for server faults, and never internals in the response. The request id ties the two together.
const errorHandler = (err, req, res, _next) => {
  const { status, message, code, errors } = describe(err);
  if (status < 500) {
    console.warn(`Client error [${req.id}]: ${req.method} ${req.path} → ${err.name}: ${String(err.message).slice(0, 200)}`);
  } else {
    console.error('Server Error:', {
      requestId: req.id,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }
  if (res.headersSent) return res.end();
  return fail(res, status, message, { ...(code && { code }), ...(errors && { errors }) });
};

module.exports = { notFound, errorHandler };
