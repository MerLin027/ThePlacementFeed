import AuthNotice from './AuthNotice';
import SheetHeading from './SheetHeading';

const SheetFooter = ({ className = '', children }) => (
  <div className={`pt-sm border-t border-outline-variant/70 font-body-sm text-body-sm text-on-surface-variant space-y-xs ${className}`}>{children}</div>
);

// Form controls inside the card: sentence-case labels
const FORM_SCOPE =
  '[&_.label]:normal-case [&_.label]:tracking-normal [&_.label]:text-label-md [&_.label]:font-medium [&_.label]:text-on-surface';

/**
 * Shell for the sign-in style pages (login, signup, change password): one raised card with a gentle
 * entrance.
 * - `drives`: the left half is the notice of upcoming drives on a tinted panel, the form on the
 *   right (login). Without a `title`, the right half is all `children` (the login page brings its
 *   own heading, because it swaps the form for its help).
 * - `intro`: the left half holds the heading, the intro and the footer; the form sits on the right
 *   under `formTitle` (signup).
 * - neither: one narrow column (change password).
 * On phones the halves stack, form first for `drives`, intro first for `intro`.
 */
const AuthCard = ({ title, kicker, subtitle, children, footer, drives = false, intro, formTitle }) => {
  const layout = drives
    ? 'max-w-[62rem] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_25rem]'
    : intro
      ? 'max-w-[56rem] grid grid-cols-1 lg:grid-cols-2'
      : 'max-w-[26rem]';
  const subtitleLine = subtitle && <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>;

  return (
    <div className="relative isolate min-h-full flex items-center justify-center py-lg px-sm">
      <div
        className={`w-full overflow-hidden bg-surface-container-lowest rounded-[1.75rem] shadow-pop ring-1 ring-outline-variant/60 animate-rise-in ${layout}`}
      >
        {drives && (
          <div className="relative order-last lg:order-first flex flex-col p-md md:p-lg border-t lg:border-t-0 lg:border-r border-outline-variant/60 bg-[linear-gradient(165deg,var(--color-brand-50)_0%,var(--color-surface-container-low)_75%)]">
            {/* The site's dot grid, faintly, so the panel reads as a notice board */}
            <div
              className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_1px_1px,rgb(0_74_198/0.12)_1px,transparent_0)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]"
              aria-hidden="true"
            />
            <AuthNotice />
          </div>
        )}
        {intro && (
          <div className="flex flex-col p-md md:p-lg border-b lg:border-b-0 lg:border-r border-outline-variant/60 bg-[linear-gradient(165deg,var(--color-brand-50)_0%,var(--color-surface-container-low)_75%)]">
            <SheetHeading as="h1" kicker={kicker} title={title} />
            {subtitleLine}
            <div className="mt-sm mb-md flex-1">{intro}</div>
            {footer && <SheetFooter>{footer}</SheetFooter>}
          </div>
        )}
        <div className={`flex flex-col p-md md:p-lg ${FORM_SCOPE}`}>
          {intro ? (
            <SheetHeading title={formTitle} />
          ) : (
            title && (
              <>
                <SheetHeading as="h1" kicker={kicker} title={title} />
                {subtitleLine}
              </>
            )
          )}
          <div className={title || intro ? 'mt-md' : 'flex-1 flex flex-col'}>{children}</div>
          {!intro && footer && <SheetFooter className="mt-sm">{footer}</SheetFooter>}
        </div>
      </div>
    </div>
  );
};

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
