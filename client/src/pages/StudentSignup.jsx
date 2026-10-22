import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { parseApiError } from '../utils/formErrors';
import { safeReturnTo } from '../utils/safeReturnTo';

const StudentSignup = () => {
  const [form, setForm] = useState({ email: '', rollNumber: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { student, signupStudent } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/profile');

  useEffect(() => {
    if (student) navigate(returnTo, { replace: true });
  }, [student, navigate, returnTo]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validateForm = () => {
    const errors = {};
    if (!form.email.trim()) errors.email = 'Please enter your email';
    if (!form.rollNumber.trim()) errors.rollNumber = 'Please enter your roll number';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await signupStudent({
        email: form.email.trim(),
        rollNumber: form.rollNumber.trim(),
        password: form.password,
      });
      navigate(returnTo, { replace: true });
    } catch (err) {
      const parsed = parseApiError(err, 'Sign up failed. Please try again.');
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      icon="person_add"
      title="Create your account"
      subtitle="Apply to campus drives in a few clicks"
      footer={
        <p>
          Already have an account?{' '}
          <Link
            to={`/login${searchParams.get('returnTo') ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-sm" noValidate>
        {error && <FormAlert icon="info">{error}</FormAlert>}

        <FormAlert tone="info" icon="info">
          <p className="font-semibold mb-[2px]">A quick heads-up</p>
          <p>
            Your email and roll number are used only once and can&apos;t be changed later, and each
            can belong to just one account. Please double-check them before you sign up. If you ever
            make a mistake, the CDPC admin can help you out.
          </p>
        </FormAlert>

        <FormField
          id="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update('email')}
          autoComplete="email"
          maxLength={254}
          helper="This becomes your login. It can't be changed later."
          error={fieldErrors.email}
          autoFocus
        />

        <FormField
          id="rollNumber"
          label="Roll number"
          type="text"
          value={form.rollNumber}
          onChange={update('rollNumber')}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          helper="Please enter it exactly as on your ID card. One account per roll number."
          error={fieldErrors.rollNumber}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          value={form.password}
          onChange={update('password')}
          autoComplete="new-password"
          maxLength={72}
          helper="At least 8 characters."
          error={fieldErrors.password}
        />

        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          autoComplete="new-password"
          maxLength={72}
          error={fieldErrors.confirmPassword}
        />

        <SubmitButton isLoading={isLoading} loadingText="Creating account...">
          Sign Up
        </SubmitButton>
      </form>
    </AuthCard>
  );
};

export default StudentSignup;
