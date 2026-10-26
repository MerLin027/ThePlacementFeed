/**
 * One error shape for every API response:
 *   { success: false, code, message, errors?: [{ field, message }], ...extra }
 * `code` is stable and machine-readable (the client branches on it); `message` is for people.
 */

// Default codes per status, for errors that have no more specific one
const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

// Sends an error response. extra: { code, errors, ...anything else the client needs (e.g. usage) }
const fail = (res, status, message, extra = {}) => {
  const { code, ...rest } = extra;
  return res.status(status).json({ success: false, code: code || STATUS_CODES[status] || 'ERROR', message, ...rest });
};

// A 400 for one field, in the same shape as the validators' errors
const fieldError = (res, field, message, code = 'VALIDATION_FAILED') =>
  fail(res, 400, 'Validation failed', { code, errors: [{ field, message }] });

module.exports = { fail, fieldError, STATUS_CODES };
