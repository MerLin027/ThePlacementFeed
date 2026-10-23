// Errors caused by the request itself (bad id, invalid data, malformed JSON) — not server faults
const isClientError = (err) =>
  err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000 ||
  (err.statusCode >= 400 && err.statusCode < 500);

// Global error handler — never leak internals to the client
const errorHandler = (err, req, res, _next) => {
  if (isClientError(err)) {
    // One line, no stack: anyone can trigger these, so they must not flood the log
    console.warn(`Client error: ${req.method} ${req.path} → ${err.name}: ${String(err.message).slice(0, 200)}`);
  } else {
    // Log full error details server-side
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry detected',
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }

  // Generic fallback — never expose stack traces
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Something went wrong' : err.message,
  });
};

module.exports = errorHandler;
