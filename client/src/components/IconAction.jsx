import { Link } from 'react-router';

/**
 * A round icon-only action for table rows: a 44px tap area with a 36px circle on hover, and a small
 * tooltip that fades in above it after a moment (hover or keyboard focus). `label` is the accessible
 * name (e.g. "Delete Acme"); `tooltip` is the short visible text (defaults to the label).
 * Renders a router Link when `to` is given, a button otherwise.
 */
const IconAction = ({ icon, label, tooltip, to, onClick, disabled = false, danger = false }) => {
  const className = `group/act relative isolate inline-flex items-center justify-center w-[44px] h-[44px] rounded-full transition-colors duration-200 before:absolute before:inset-1 before:-z-10 before:rounded-full before:transition-[background-color,scale] before:duration-200 active:before:scale-90 focus-visible:outline-hidden focus-visible:before:ring-2 focus-visible:before:ring-primary disabled:opacity-40 disabled:cursor-not-allowed ${
    danger
      ? 'text-on-surface-variant hover:text-error hover:before:bg-error-container'
      : 'text-on-surface-variant hover:text-primary hover:before:bg-primary/8'
  }`;
  const content = (
    <>
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-inverse-surface px-2 py-1 font-label-sm text-label-sm text-inverse-on-surface opacity-0 shadow-pop transition-[opacity,translate] duration-150 group-hover/act:translate-y-0 group-hover/act:opacity-100 group-hover/act:delay-300 group-focus-visible/act:translate-y-0 group-focus-visible/act:opacity-100 group-disabled/act:hidden"
        aria-hidden="true"
      >
        {tooltip || label}
      </span>
    </>
  );
  return to ? (
    <Link to={to} aria-label={label} className={className}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={className}>{content}</button>
  );
};

export default IconAction;
