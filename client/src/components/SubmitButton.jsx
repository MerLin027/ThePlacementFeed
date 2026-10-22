// Primary submit button with the same spinner used on the admin login form.
// Disabled while loading so a slow (cold-start) request can't be sent twice.
const SubmitButton = ({ isLoading, loadingText, children, className = '' }) => (
  <button
    type="submit"
    disabled={isLoading}
    aria-busy={isLoading}
    className={`btn-primary w-full min-h-[44px] py-3 ${className}`}
  >
    {isLoading ? (
      <span className="flex items-center justify-center gap-xs">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {loadingText}
      </span>
    ) : (
      children
    )}
  </button>
);

export default SubmitButton;
