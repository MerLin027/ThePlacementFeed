// Turns filter values (from the URL, so possibly hand-edited) into API query params. Anything the
// server would reject is left out instead, so a bad link shows an unfiltered list rather than an error.

export const addNumber = (params, key, value, { min, max, int = false }) => {
  if (value === '' || value === undefined) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) return;
  params[key] = n;
};

export const addDay = (params, key, value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value))) params[key] = value;
};

// Multi-value filters go comma-joined, keeping only known values
export const addList = (params, key, values, allowed) => {
  const kept = (values || []).filter((v) => !allowed || allowed.includes(v));
  if (kept.length > 0) params[key] = kept.join(',');
};

export const addOne = (params, key, value, allowed) => {
  if (value && (!allowed || allowed.includes(value))) params[key] = value;
};

// Graduation years offered in the filters: last year to four years ahead
export const gradYearOptions = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(now - 1 + i));
};
