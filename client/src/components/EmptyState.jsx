// Composed "nothing here" message: what's empty, why, and what to do next.
const EmptyState = ({ icon, title, description, action, className = '' }) => (
  <div className={`bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-lg text-center ${className}`}>
    {icon && (
      <span className="material-symbols-outlined text-[40px] text-outline" aria-hidden="true">{icon}</span>
    )}
    <h2 className="font-headline-sm text-headline-sm text-on-surface mt-xs">{title}</h2>
    {description && (
      <p className="font-body-md text-body-md text-on-surface-variant mt-base max-w-(--container-md) mx-auto">{description}</p>
    )}
    {action && <div className="mt-md flex justify-center gap-xs flex-wrap">{action}</div>}
  </div>
);

export default EmptyState;
