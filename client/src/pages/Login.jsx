import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/auth';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import SheetHeading from '../components/SheetHeading';
import { PANEL_SUBTITLE_LINES } from '../components/authLayout';
import { passwordRulesFor } from '../constants/passwords';
import { parseApiError } from '../utils/formErrors';
import { afterSignIn } from '../utils/accountHome';
import { safeReturnTo } from '../utils/safeReturnTo';
import { usePageTitle } from '../hooks/usePageTitle';

const HELP = [
  {
    icon: 'key',
    title: 'Forgot your password?',
    text: 'Ask the CDPC admin to reset it. You’ll get a one-time password to log in with.',
  },
  {
    icon: 'lock_reset',
    title: 'Got a one-time password?',
    text: `Log in with it as usual within 72 hours, then choose your own straight away: at least ${passwordRulesFor('student').min} characters for students, ${passwordRulesFor('staff').min} for staff.`,
  },
];

// The two views share one spot: the one not shown fades and slides aside, can't be focused or
// read (inert), and keeps its place in the layout, so the card never changes height. Visibility
// is only animated on the way out (so the view leaving stays visible while it fades); the view
// coming in is visible at once, so focus can move into it straight away.
const view = (shown, from) =>
  `col-start-1 row-start-1 flex flex-col duration-300 ease-out-soft ${
    shown ? 'opacity-100 translate-x-0 visible transition-[opacity,translate]' : `opacity-0 invisible transition-[opacity,translate,visibility] ${from}`
  }`;

/**
 * One sign-in page for everyone: students and admins with their email, the super admin with its
 * username or email. The account decides where it goes next (students back to the site, staff to
 * the dashboard). "Trouble logging in?" swaps the form for a short help view in the same place.
 */
const Login = () => {
  usePageTitle('Log In');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpHeadingRef = useRef(null);
  const helpButtonRef = useRef(null);
  const switched = useRef(false);
  const { account, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const expired = searchParams.get('expired');

  // Already signed in (e.g. the back button): move on
  useEffect(() => {
    if (account) navigate(afterSignIn(account, rawReturnTo), { replace: true });
  }, [account, navigate, rawReturnTo]);

  // Focus follows the swap (not on first render)
  useEffect(() => {
    if (!switched.current) return;
    (helpOpen ? helpHeadingRef : helpButtonRef).current?.focus({ preventScroll: true });
  }, [helpOpen]);
  const showHelp = (open) => {
    switched.current = true;
    setHelpOpen(open);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError({ message: 'Please enter your email or username and your password' });
      return;
    }

    setIsLoading(true);
    try {
      const next = await login(identifier.trim(), password);
      navigate(afterSignIn(next, rawReturnTo), { replace: true });
    } catch (err) {
      const parsed = parseApiError(err, 'Login failed. Please try again.');
      setError({
        message: parsed.message || 'Login failed. Please try again.',
        credentials: err.response?.data?.code === 'INVALID_CREDENTIALS',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signupReturnTo = safeReturnTo(rawReturnTo, null);

  return (
    <AuthCard
      drives
      footer={
        <p>
          New student?{' '}
          <Link
            to={`/signup${signupReturnTo ? `?returnTo=${encodeURIComponent(signupReturnTo)}` : ''}`}
            className="text-primary font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <div className="grid grid-cols-1 flex-1">
        {/* The form */}
        <div className={view(!helpOpen, '-translate-x-6')} inert={helpOpen || undefined}>
          <SheetHeading
            as="h1"
            title="Log In"
            subtitle="Use the email you signed up with. CDPC staff: your email or username."
            subtitleLines={PANEL_SUBTITLE_LINES}
          />

          <form onSubmit={handleSubmit} className="mt-md space-y-sm" noValidate>
            {expired === 'temp' && !error && (
              <FormAlert tone="warning" icon="lock_reset">
                Your one-time password has expired. Ask the CDPC admin to reset your password again.
              </FormAlert>
            )}
            {expired === 'true' && !error && (
              <FormAlert tone="warning" icon="schedule">
                Your session has expired. Please log in again.
              </FormAlert>
            )}
            {error && (
              <FormAlert>
                <p>{error.message}</p>
                {error.credentials && (
                  <p className="mt-0.5">
                    Forgot your password?{' '}
                    <button
                      type="button"
                      onClick={() => showHelp(true)}
                      className="font-semibold underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Here&apos;s what to do
                    </button>
                  </p>
                )}
              </FormAlert>
            )}

            <FormField
              id="identifier"
              label="Email or username"
              type="text"
              icon="person"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              autoFocus
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              icon="lock"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={72}
            />

            <SubmitButton isLoading={isLoading} loadingText="Logging in..." className="mt-xs!">
              Log in
            </SubmitButton>
          </form>

          <button
            ref={helpButtonRef}
            type="button"
            onClick={() => showHelp(true)}
            aria-expanded={helpOpen}
            aria-controls="login-help"
            className="mt-xs self-center inline-flex items-center gap-1.5 min-h-[44px] px-xs rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">help</span>
            Trouble logging in?
          </button>
        </div>

        {/* The help, in the same place */}
        <section id="login-help" aria-labelledby="login-help-heading" className={view(helpOpen, 'translate-x-6')} inert={!helpOpen || undefined}>
          <SheetHeading
            id="login-help-heading"
            title="Trouble Logging In?"
            subtitle="There's no email reset here; the CDPC sorts it out in person."
            subtitleLines={PANEL_SUBTITLE_LINES}
            titleProps={{
              ref: helpHeadingRef,
              tabIndex: -1,
              className: 'rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
            }}
          />

          <ul className="mt-md space-y-xs">
            {HELP.map((item, i) => (
              <li
                key={item.title}
                style={{ transitionDelay: helpOpen ? `${80 + i * 60}ms` : '0ms' }}
                className={`flex items-start gap-sm rounded-2xl bg-surface-container-low/70 ring-1 ring-outline-variant/50 p-sm transition-[opacity,translate] duration-300 ease-out-soft ${
                  helpOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
                }`}
              >
                <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center" aria-hidden="true">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </span>
                <span>
                  <span className="block font-label-md text-label-md text-on-surface">{item.title}</span>
                  <span className="block mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-md">
            <button type="button" onClick={() => showHelp(false)} className="btn-secondary w-full gap-1.5">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              Back to log in
            </button>
          </div>
        </section>
      </div>
    </AuthCard>
  );
};

export default Login;
