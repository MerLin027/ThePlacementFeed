import AuthNotice from './AuthNotice';
import SheetHeading from './SheetHeading';

const SheetFooter = ({ className = '', children }) => (
  <div className={`pt-sm border-t border-outline-variant font-body-sm text-body-sm text-on-surface-variant space-y-xs ${className}`}>{children}</div>
);

// Form controls inside the sheet: sentence-case labels, small corners
const FORM_SCOPE =
  '[&_.label]:normal-case [&_.label]:tracking-normal [&_.label]:text-label-md [&_.label]:font-medium [&_.label]:text-on-surface [&_.input-field]:rounded-md [&_.btn-primary]:rounded-md';

/**
 * Shell for the sign-in style pages (student login and signup, admin login, change password): one
 * flat sheet (thin border, small corners, no shadow), halves split by a rule.
 * - `drives`: the left half is the notice of upcoming drives, the form on the right (login).
 * - `intro`: the left half holds the heading, the intro and the footer; the form sits on the right
 *   under `formTitle` (signup).
 * - neither: one narrow column (admin login, change password).
 * On phones the halves stack, form first for `drives`, intro first for `intro`. `help` goes in a
 * "Trouble logging in?" disclosure, opened by `helpOpen` (e.g. after a failed attempt).
 */
const AuthCard = ({
  title,
  kicker,
  subtitle,
  children,
  footer,
  help,
  helpLabel = 'Trouble logging in?',
  helpOpen = false,
  drives = false,
  intro,
  formTitle,
}) => {
  const layout = drives
    ? 'max-w-[60rem] grid lg:grid-cols-[minmax(0,1fr)_23rem]'
    : intro
      ? 'max-w-[56rem] grid lg:grid-cols-2'
      : 'max-w-[25rem]';
  const subtitleLine = subtitle && <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>;

  return (
    <div className="relative isolate min-h-full flex items-center justify-center py-lg px-sm">
      <div className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg ${layout}`}>
        {drives && (
          <div className="order-last lg:order-first flex flex-col p-md md:p-lg border-t lg:border-t-0 lg:border-r border-outline-variant">
            <AuthNotice />
          </div>
        )}
        {intro && (
          <div className="flex flex-col p-md md:p-lg border-b lg:border-b-0 lg:border-r border-outline-variant">
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
            <>
              <SheetHeading as="h1" kicker={kicker} title={title} />
              {subtitleLine}
            </>
          )}
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
