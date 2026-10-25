import AuthNotice from './AuthNotice';

/**
 * Shell for the sign-in style pages (student login and signup, admin login, change password): one
 * flat sheet (thin border, small corners, no shadow) with a plain heading and sentence-case labels.
 * With `drives`, the left half is the notice of upcoming drives and the form sits on the right,
 * split by a rule (on phones the form comes first). `help` goes in a "Trouble logging in?"
 * disclosure (opened by `helpOpen`, e.g. after a failed attempt); `steps` names where the flow leads.
 */
const AuthCard = ({ title, subtitle, children, footer, help, helpLabel = 'Trouble logging in?', helpOpen = false, drives = false, steps, currentStep = 0 }) => (
  <div className="relative isolate min-h-full flex items-center justify-center py-lg px-sm">
    <div
      className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg ${
        drives ? 'max-w-[60rem] grid lg:grid-cols-[minmax(0,1fr)_23rem]' : 'max-w-[25rem]'
      }`}
    >
      {drives && (
        <div className="order-last lg:order-first p-md md:p-lg border-t lg:border-t-0 lg:border-r border-outline-variant">
          <AuthNotice />
        </div>
      )}
      <div className="p-md md:p-lg [&_.label]:normal-case [&_.label]:tracking-normal [&_.label]:text-label-md [&_.label]:font-medium [&_.label]:text-on-surface [&_.input-field]:rounded-md [&_.btn-primary]:rounded-md">
        {steps && (
          <p className="mb-xs font-body-sm text-body-sm text-on-surface-variant">
            Step {currentStep + 1} of {steps.length}: <span className="text-on-surface font-medium">{steps[currentStep]}</span>
            {currentStep < steps.length - 1 && `, then ${steps.slice(currentStep + 1).join(', then ').toLowerCase()}`}
          </p>
        )}
        {/* Same heavy rule as the notice's heading, so both halves read as one printed sheet */}
        <div className="pb-xs border-b-2 border-on-surface">
          <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
          {subtitle && <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>}
        </div>
        <div className="mt-md">{children}</div>
        {help && (
          <details className="group/help mt-xs" open={helpOpen || undefined}>
            <summary className="inline-flex items-center gap-1 min-h-[44px] cursor-pointer list-none rounded-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors [&::-webkit-details-marker]:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              {helpLabel}
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-open/help:rotate-180" aria-hidden="true">
                expand_more
              </span>
            </summary>
            <div className="pb-xs space-y-xs font-body-sm text-body-sm text-on-surface-variant">{help}</div>
          </details>
        )}
        {footer && (
          <div className="mt-sm pt-sm border-t border-outline-variant font-body-sm text-body-sm text-on-surface-variant space-y-xs">{footer}</div>
        )}
      </div>
    </div>
  </div>
);

export const FormAlert = ({ tone = 'error', icon, children }) => {
  const styles =
    tone === 'error'
      ? 'bg-error-container border-error/20 text-on-error-container'
      : tone === 'warning'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-surface-container-low border-outline-variant text-on-surface';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`p-sm border rounded-xl font-body-sm text-body-sm flex items-start gap-xs ${styles}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[18px] shrink-0 mt-px" aria-hidden="true">{icon}</span>
      )}
      <div>{children}</div>
    </div>
  );
};

export default AuthCard;
