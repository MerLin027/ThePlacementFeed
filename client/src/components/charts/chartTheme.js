// Chart ink and structure for the admin charts: text in the text tokens (never a series colour),
// a recessive hairline grid, and the two series colours used outside status charts
export const INK = '#434655';
export const GRID = '#e1e3e4';
export const SURFACE = '#ffffff';
export const ACCENT = '#2563eb';
export const SELECTED = '#059669';
export const AXIS = { fill: INK, fontSize: 12 };
export const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));
