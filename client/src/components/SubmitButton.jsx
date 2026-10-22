import Spinner from './Spinner';

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
        <Spinner size="sm" tone="current" />
        {loadingText}
      </span>
    ) : (
      children
    )}
  </button>
);

export default SubmitButton;
