import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/auth';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { homeFor } from '../utils/accountHome';
import { parseApiError } from '../utils/formErrors';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * Change your own password: one page for students and staff. After an admin reset (or for a new
 * staff account) the one-time password isn't asked for again: setting a new one is the only thing
 * such an account can do.
 */
const ChangePassword = () => {
  usePageTitle('Change password');
  const { account, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, fieldErrors);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isStaff = account?.type === 'staff';
  const isPending = Boolean(account?.mustChangePassword);
  // Staff accounts can see every student's details: a longer minimum (the server enforces both)
  const minLength = isStaff ? 12 : 8;
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {};
    if (!isPending && !form.currentPassword) errors.currentPassword = 'Please enter your current password';
    if (form.newPassword.length < minLength) errors.newPassword = `Password must be at least ${minLength} characters`;
    if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "Passwords don't match";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await api.post(
        '/api/auth/password',
        isPending ? { newPassword: form.newPassword } : { currentPassword: form.currentPassword, newPassword: form.newPassword }
      );
      const next = await refresh();
      toast.success('Password updated');
      navigate(next?.type === 'student' ? '/profile' : homeFor(next), { replace: true });
    } catch (err) {
      const parsed = parseApiError(err, 'Could not update your password. Please try again.');
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title={isPending ? 'Set a new password to continue' : 'Change password'}
      subtitle={isPending ? 'Required before you can use your account' : "You'll stay logged in here; other devices will be signed out"}
      footer={
        isPending ? (
          <p>
            Not you?{' '}
            <button
              type="button"
              onClick={logout}
              className="text-primary font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
            >
              Log out
            </button>
          </p>
        ) : null
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-sm" noValidate>
        {isPending && (
          <FormAlert tone="warning" icon="lock_reset">
            <p className="font-semibold">
              {isStaff ? 'You signed in with a one-time password.' : 'Your password was reset by the CDPC admin.'}
            </p>
            <p className="mt-[2px]">
              Choose a password that only you know before you continue. You won&apos;t need the one-time
              password again.
            </p>
          </FormAlert>
        )}
        {error && <FormAlert>{error}</FormAlert>}

        {!isPending && (
          <FormField
            id="currentPassword"
            label="Current password"
            type="password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            autoComplete="current-password"
            maxLength={72}
            error={fieldErrors.currentPassword}
            autoFocus
          />
        )}

        <FormField
          id="newPassword"
          label="New password"
          type="password"
          value={form.newPassword}
          onChange={update('newPassword')}
          autoComplete="new-password"
          maxLength={72}
          helper={`At least ${minLength} characters. Avoid common passwords and your own name, email or roll number.`}
          error={fieldErrors.newPassword}
          autoFocus={isPending}
        />

        <FormField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          autoComplete="new-password"
          maxLength={72}
          error={fieldErrors.confirmPassword}
        />

        <SubmitButton isLoading={isLoading} loadingText="Saving...">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
};

export default ChangePassword;
