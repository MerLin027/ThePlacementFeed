import { PASSWORD_MAX_LENGTH, passwordRulesFor } from '../constants/passwords';

/**
 * The rules a new password must meet, shown under the field and ticked off as the password is typed
 * (the ones the website can check; whether it is a common password is checked by the server on
 * save). `kind`: 'student' | 'staff'. `own`: the account's own details it must not contain (email,
 * username, roll number). `pending`: the account signed in with a one-time password, which can't be
 * kept.
 */
const containsOwn = (password, own) => {
  const lower = password.toLowerCase();
  return own
    .map((value) => (value?.includes('@') ? value.split('@')[0] : value))
    .filter((value) => typeof value === 'string' && value.length >= 4)
    .some((value) => lower.includes(value.toLowerCase()));
};

const Rule = ({ met, children }) => (
  <li className={`flex items-start gap-1.5 transition-colors duration-200 ${met ? 'text-emerald-800' : ''}`}>
    <span className="relative mt-[3px] w-[14px] h-[14px] shrink-0" aria-hidden="true">
      {met ? (
        <span className="material-symbols-outlined absolute inset-0 text-[14px] leading-[14px] animate-pop-in">check</span>
      ) : (
        <span className="absolute inset-[4px] rounded-full bg-outline/60" />
      )}
    </span>
    <span>
      {children}
      {/* Screen readers hear the state with the rule; the tick is decoration */}
      {met !== undefined && <span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>}
    </span>
  </li>
);

const PasswordRules = ({ password = '', kind = 'student', own = [], pending = false }) => {
  const { min, own: ownLabel } = passwordRulesFor(kind);
  const typed = password.length > 0;
  const longEnough = password.length >= min && password.length <= PASSWORD_MAX_LENGTH;
  return (
    <ul className="space-y-0.5 font-body-sm text-body-sm text-on-surface-variant">
      <Rule met={typed ? longEnough : false}>
        {min}–{PASSWORD_MAX_LENGTH} characters
      </Rule>
      <Rule met={typed ? !containsOwn(password, own) : false}>Doesn&apos;t contain your {ownLabel}</Rule>
      <Rule>Not a common password, like &ldquo;password123&rdquo;</Rule>
      {pending && <Rule>Different from your one-time password</Rule>}
    </ul>
  );
};

export default PasswordRules;
