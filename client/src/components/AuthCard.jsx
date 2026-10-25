import AuthDrivesPanel from './AuthDrivesPanel';

// "1 Account — 2 Profile — 3 Apply": where signing up leads
const AuthSteps = ({ steps, current }) => (
  <ol className="flex flex-wrap items-center gap-x-xs gap-y-1 mb-sm" aria-label="Getting started">
    {steps.map((step, i) => (
      <li key={step} className="flex items-center gap-xs">
        <span
          className={`inline-flex items-center gap-1.5 font-label-sm text-label-sm ${i === current ? 'text-primary' : 'text-on-surface-variant'}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold tabular-nums ${
              i === current ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          {step}
        </span>
        {i < steps.length - 1 && <span className="w-6 h-px bg-outline-variant" aria-hidden="true" />}
      </li>
    ))}
  </ol>
);

/**
 * Shell for the sign-in style pages (student login and signup, admin login, change password): a
 * left-aligned form panel with sentence-case labels. With `drives`, the navy panel of upcoming drives
 * sits beside it (below it on phones, so the form comes first). `help` goes in a "Trouble logging
 * in?" disclosure (opened by `helpOpen`, e.g. after a failed attempt); `steps` shows where the flow leads.
 */
const AuthCard = ({ title, subtitle, children, footer, help, helpLabel = 'Trouble logging in?', helpOpen = false, drives = false, steps, currentStep = 0 }) => (
  <div className="relative isolate min-h-full flex items-center justify-center py-lg px-sm">
    <div
      className={`w-full ${
        drives ? 'max-w-[62rem] grid lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] gap-md lg:gap-xl items-center lg:items-stretch' : 'max-w-[27rem]'
      }`}
    >
      {drives && (
        <div className="order-last lg:order-first lg:h-full">
          <AuthDrivesPanel />
        </div>
      )}
      <div className="w-full p-md md:p-lg rounded-3xl bg-surface-container-lowest/90 backdrop-blur-sm ring-1 ring-[rgb(3_21_54/0.06)] shadow-[0_1px_2px_rgb(3_21_54/0.04),0_18px_44px_-22px_rgb(3_21_54/0.28)] motion-safe:animate-rise-in [&_.label]:normal-case [&_.label]:tracking-normal [&_.label]:text-label-md [&_.label]:font-medium [&_.label]:text-on-surface">
        {steps && <AuthSteps steps={steps} current={currentStep} />}
        <h1 className="font-display-lg text-[2rem] leading-tight font-bold tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{subtitle}</p>}
        <div className="mt-md">{children}</div>
        {help && (
          <details className="group/help mt-xs" open={helpOpen || undefined}>
            <summary className="inline-flex items-center gap-1 min-h-[44px] cursor-pointer list-none rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors [&::-webkit-details-marker]:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              {helpLabel}
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-open/help:rotate-180" aria-hidden="true">
                expand_more
              </span>
            </summary>
            <div className="pb-xs space-y-xs font-body-sm text-body-sm text-on-surface-variant animate-pop-in">{help}</div>
          </details>
        )}
        {footer && (
          <div className="mt-sm pt-sm border-t border-outline-variant/70 font-body-sm text-body-sm text-on-surface-variant space-y-xs">{footer}</div>
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
