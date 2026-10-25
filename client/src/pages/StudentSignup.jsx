import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/auth';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { parseApiError } from '../utils/formErrors';
import { safeReturnTo } from '../utils/safeReturnTo';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';
import { usePageTitle } from '../hooks/usePageTitle';

const StudentSignup = () => {
  usePageTitle('Sign up');
  const [form, setForm] = useState({ email: '', rollNumber: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, fieldErrors);
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
      kicker="Students"
      title="Sign up to start applying"
      formTitle="Account details"
      intro={
        <>
          {/* Where signing up leads; this page is step 1 */}
          <ol className="divide-y divide-outline-variant/70 border-b border-outline-variant/70">
            {[
              ['Account', 'Your email, roll number and a password. This page.'],
              ['Profile', 'Your name, branch, CGPA, phone and a resume link.'],
              ['Apply', 'Any drive you\u2019re eligible for, in a couple of clicks.'],
            ].map(([step, text], i) => (
              <li key={step} className="flex gap-sm py-xs" aria-current={i === 0 ? 'step' : undefined}>
                <span className={`w-5 shrink-0 font-label-md text-label-md tabular-nums ${i === 0 ? 'text-primary' : 'text-outline'}`}>{i + 1}</span>
                <span>
                  <span className={`block font-label-md text-label-md ${i === 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}>{step}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-md font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">A quick heads-up: </span>
            your email and roll number can&apos;t be changed later. If something goes wrong, the CDPC admin can help.
          </p>
        </>
      }
      footer={
        <p>
          Already have an account?{' '}
          <Link
            to={`/login${searchParams.get('returnTo') ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="text-primary font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-sm" noValidate>
        {error && <FormAlert icon="info">{error}</FormAlert>}

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
          Sign up
        </SubmitButton>
      </form>
    </AuthCard>
  );
};

export default StudentSignup;
