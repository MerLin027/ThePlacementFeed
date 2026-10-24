import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/auth';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { parseApiError } from '../utils/formErrors';
import { safeReturnTo } from '../utils/safeReturnTo';
import { usePageTitle } from '../hooks/usePageTitle';

const StudentLogin = () => {
  usePageTitle('Student login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { student, loginStudent } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo = safeReturnTo(rawReturnTo, '/');
  const expired = searchParams.get('expired');

  // Already logged in (e.g. back button) — move on
  useEffect(() => {
    if (student) {
      navigate(student.mustChangePassword ? '/change-password' : returnTo, { replace: true });
    }
  }, [student, navigate, returnTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginStudent(email.trim(), password);
      navigate(result.mustChangePassword ? '/change-password' : returnTo, { replace: true });
    } catch (err) {
      setError(parseApiError(err, 'Login failed. Please try again.').message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      icon="login"
      title="Student login"
      subtitle="Log in to apply to drives and manage your profile"
      footer={
        <>
          <p>
            New here?{' '}
            <Link
              to={`/signup${rawReturnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="text-primary font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
            >
              Create an account
            </Link>
          </p>
          <p>Forgot your password? Please ask the CDPC admin to reset it.</p>
          <p>
            Password just reset? Log in with the temporary password the admin gave you — you&apos;ll
            choose a new one straight after.
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-sm" noValidate>
        {expired === 'temp' && !error && (
          <FormAlert tone="warning" icon="lock_reset">
            Your temporary password has expired. Ask the CDPC admin to reset your password again.
          </FormAlert>
        )}
        {expired === 'true' && !error && (
          <FormAlert tone="warning" icon="schedule">
            Your session has expired. Please log in again.
          </FormAlert>
        )}
        {error && <FormAlert>{error}</FormAlert>}

        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
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

export default StudentLogin;
