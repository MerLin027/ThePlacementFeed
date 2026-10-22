// Centered card shell shared by the student auth pages (matches AdminLogin).
const AuthCard = ({ icon, title, subtitle, children, footer }) => (
  <div className="min-h-full flex items-center justify-center py-lg px-sm">
    <div className="w-full max-w-md">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
        <div className="px-md pt-md pb-sm text-center">
          <div className="w-14 h-14 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-sm">
            <span className="material-symbols-outlined text-on-primary text-[28px]" aria-hidden="true">{icon}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-base">{title}</h1>
          {subtitle && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        <div className="px-md pb-md">{children}</div>
      </div>
      {footer && (
        <div className="text-center font-body-sm text-body-sm text-on-surface-variant mt-md space-y-xs">
          {footer}
        </div>
      )}
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
      className={`p-sm border rounded-lg font-body-sm text-body-sm flex items-start gap-xs ${styles}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-[1px]" aria-hidden="true">{icon}</span>
      )}
      <div>{children}</div>
    </div>
  );
};

export default AuthCard;
