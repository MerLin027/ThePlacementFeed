/**
 * NoSQL-injection guard: removes keys that start with "$" (query operators),
 * contain "." (nested-path injection) or are "__proto__" from req.body and
 * req.query, at any depth. (Route params are always plain strings.)
 *
 * Replaces express-mongo-sanitize, which assigns to req.query — a read-only
 * getter in Express 5. Express 5 also re-parses the query string on every
 * read of req.query, so changes made by later middleware (express-validator's
 * .toInt()/.toFloat()) would be lost. The sanitised query is therefore pinned
 * onto the request as a plain property that later middleware can update.
 *
 * Also defaults req.body to {} (Express 5 leaves it undefined when there is
 * no body), so handlers can destructure it safely.
 *
 * Rejected with 400: bodies nested deeper than MAX_DEPTH (the app's deepest
 * real payload is 3 levels; without a limit a ~5k-level body overflows the
 * stack), and query strings containing control characters (a NUL byte makes
 * MongoDB reject the search regex).
 */
const MAX_DEPTH = 32;
const TOO_DEEP = Symbol('too deep');
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const isUnsafeKey = (key) => key.startsWith('$') || key.includes('.') || key === '__proto__';

const clean = (value, depth = 0) => {
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) throw TOO_DEEP;
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!isUnsafeKey(key)) result[key] = clean(nested, depth + 1);
  }
  return result;
};

const invalidQuery = (res) => res.status(400).json({ success: false, message: 'Invalid query parameter' });

const sanitizeRequest = (req, res, next) => {
  // Express 5's query parser does not expand "a[b]=c", so a bracketed key can only be a
  // malformed or hostile request (e.g. "status[$ne]=x"). The client sends flat params only.
  const entries = Object.entries(req.query);
  if (entries.some(([key]) => /[[\]]/.test(key))) return invalidQuery(res);
  if (entries.some(([key, value]) => CONTROL_CHARS.test(key) || [].concat(value).some((v) => CONTROL_CHARS.test(String(v))))) {
    return invalidQuery(res);
  }
  try {
    req.body = req.body === undefined ? {} : clean(req.body);
  } catch (error) {
    if (error !== TOO_DEEP) throw error;
    return res.status(400).json({ success: false, message: 'Request body is too deeply nested' });
  }
  Object.defineProperty(req, 'query', {
    value: clean(req.query),
    writable: true,
    enumerable: true,
    configurable: true,
  });
  next();
};

module.exports = sanitizeRequest;
