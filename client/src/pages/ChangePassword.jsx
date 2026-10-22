import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AuthCard, { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import { parseApiError } from '../utils/formErrors';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';
import { usePageTitle } from '../hooks/usePageTitle';

const ChangePassword = () => {
  usePageTitle('Change password');
  const { student, refreshStudent, logoutStudent } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, fieldErrors);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isReset = Boolean(student?.mustChangePassword);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {};
    if (!form.currentPassword) errors.currentPassword = isReset
      ? 'Please enter the temporary password'
      : 'Please enter your current password';
    if (form.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "Passwords don't match";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await api.post('/api/students/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      await refreshStudent();
      toast.success('Password updated');
      navigate('/profile', { replace: true });
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
      icon="key"
      title={isReset ? 'Set a new password to continue' : 'Change password'}
      subtitle={isReset ? 'Required before you can use your account' : "You'll stay logged in here; other devices will be signed out"}
      footer={
        isReset ? (
          <p>
            Not you?{' '}
            <button
              type="button"
              onClick={logoutStudent}
              className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              Log out
            </button>
          </p>
        ) : null
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-sm" noValidate>
        {isReset && (
          <FormAlert tone="warning" icon="lock_reset">
            <p className="font-semibold">Your password was reset by the CDPC admin.</p>
            <p className="mt-[2px]">
              For your security, you need to choose a new password before you can browse, apply or edit
              your profile. Enter the temporary password you were given, then pick one that only you know.
              The temporary password works for 72 hours after the reset.
            </p>
          </FormAlert>
        )}
        {error && <FormAlert>{error}</FormAlert>}

        <FormField
          id="currentPassword"
          label={isReset ? 'Temporary password' : 'Current password'}
          type="password"
          value={form.currentPassword}
          onChange={update('currentPassword')}
          autoComplete="current-password"
          maxLength={72}
          error={fieldErrors.currentPassword}
          autoFocus
        />

        <FormField
          id="newPassword"
          label="New password"
          type="password"
          value={form.newPassword}
          onChange={update('newPassword')}
          autoComplete="new-password"
          maxLength={72}
          helper="At least 8 characters."
          error={fieldErrors.newPassword}
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
