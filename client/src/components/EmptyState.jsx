// Composed "nothing here" message: what's empty, why, and what to do next.
const EmptyState = ({ icon, title, description, action, className = '' }) => (
  <div className={`bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-soft px-md py-lg text-center motion-safe:animate-rise-in ${className}`}>
    {icon && (
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-container-low" aria-hidden="true">
        <span className="material-symbols-outlined text-[32px] text-outline">{icon}</span>
      </span>
    )}
    <h2 className="font-headline-sm text-headline-sm text-on-surface mt-xs">{title}</h2>
    {description && (
      <p className="font-body-md text-body-md text-on-surface-variant mt-base max-w-(--container-md) mx-auto">{description}</p>
    )}
    {action && <div className="mt-md flex justify-center gap-xs flex-wrap">{action}</div>}
  </div>
);

// Shown when the drive list could not be fetched, so a failure never reads as "no drives"
export const LoadError = ({ onRetry, className = '' }) => (
  <EmptyState
    icon="cloud_off"
    title="Couldn't load the drives"
    description="We couldn't reach the server. Check your connection and try again."
    action={
      <button type="button" onClick={onRetry} className="btn-primary">
        Try again
      </button>
    }
    className={className}
  />
);

export default EmptyState;
