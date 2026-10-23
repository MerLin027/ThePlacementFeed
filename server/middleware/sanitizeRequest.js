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
 */
const isUnsafeKey = (key) => key.startsWith('$') || key.includes('.') || key === '__proto__';

const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (value === null || typeof value !== 'object') return value;
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!isUnsafeKey(key)) result[key] = clean(nested);
  }
  return result;
};

const sanitizeRequest = (req, res, next) => {
  // Express 5's query parser does not expand "a[b]=c", so a bracketed key can only be a
  // malformed or hostile request (e.g. "status[$ne]=x"). The client sends flat params only.
  if (Object.keys(req.query).some((key) => /[[\]]/.test(key))) {
    return res.status(400).json({ success: false, message: 'Invalid query parameter' });
  }
  req.body = req.body === undefined ? {} : clean(req.body);
  Object.defineProperty(req, 'query', {
    value: clean(req.query),
    writable: true,
    enumerable: true,
    configurable: true,
  });
  next();
};

module.exports = sanitizeRequest;
