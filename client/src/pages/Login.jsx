import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/auth';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { parseApiError } from '../utils/formErrors';
import { afterSignIn } from '../utils/accountHome';
import { safeReturnTo } from '../utils/safeReturnTo';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * One sign-in page for everyone: students with their email, CDPC staff with their username or email.
 * The account decides where it goes next (students back to the site, staff to the dashboard).
 */
const Login = () => {
  usePageTitle('Log in');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { account, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const expired = searchParams.get('expired');

  // Already signed in (e.g. the back button): move on
  useEffect(() => {
    if (account) navigate(afterSignIn(account, rawReturnTo), { replace: true });
  }, [account, navigate, rawReturnTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter your email or username and your password');
      return;
    }

    setIsLoading(true);
    try {
      const next = await login(identifier.trim(), password);
      navigate(afterSignIn(next, rawReturnTo), { replace: true });
    } catch (err) {
      setError(parseApiError(err, 'Login failed. Please try again.').message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const signupReturnTo = safeReturnTo(rawReturnTo, null);

  return (
    <AuthCard
      drives
      kicker="Students and staff"
      title="Log in"
      subtitle="Students: the email you signed up with. CDPC staff: your username or email."
      // A failed attempt opens the help (forgot / reset password)
      helpOpen={Boolean(error)}
      help={
        <>
          <p>Forgot your password? Please ask the CDPC admin to reset it.</p>
          <p>
            Password just reset, or a new staff account? Log in with the one-time password you were
            given — you&apos;ll choose your own straight after.
          </p>
        </>
      }
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
      <form onSubmit={handleSubmit} className="space-y-sm" noValidate>
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
        {error && <FormAlert>{error}</FormAlert>}

        <FormField
          id="identifier"
          label="Email or username"
          type="text"
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={72}
        />

        <SubmitButton isLoading={isLoading} loadingText="Logging in...">
          Log in
        </SubmitButton>
      </form>
    </AuthCard>
  );
};

export default Login;
