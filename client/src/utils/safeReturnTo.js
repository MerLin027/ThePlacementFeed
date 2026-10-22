/**
 * Only allow same-site relative paths as post-login redirect targets.
 * Rejects absolute URLs, protocol-relative URLs (//evil.com) and
 * backslash variants (/\evil.com) that browsers treat as external.
 */
export const safeReturnTo = (value, fallback = '/') => {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
};
