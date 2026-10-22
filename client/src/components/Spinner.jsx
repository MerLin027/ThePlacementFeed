const SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

/**
 * The one loading spinner used across the app. With `label` it announces
 * itself to screen readers; without it, it's decorative (e.g. inside a button
 * that already says "Saving…"). Under reduced motion it stays still.
 * tone="current" inherits the text colour (for use inside coloured buttons).
 */
const Spinner = ({ size = 'md', label, tone = 'brand', className = '' }) => (
  <span
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={`inline-flex ${className}`}
  >
    <svg
      className={`${SIZES[size]} motion-safe:animate-spin ${tone === 'current' ? '' : 'text-primary-container'}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </span>
);

export default Spinner;
