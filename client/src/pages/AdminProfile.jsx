import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/auth';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import PasswordRules from '../components/PasswordRules';
import { FormAlert } from '../components/AuthCard';
import { passwordRulesFor } from '../constants/passwords';
import { parseApiError } from '../utils/formErrors';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * The super admin's own account: name, username and email (none of it has to be filled in beyond the
 * username), the password, and the College/University the site is for. Changing the username or
 * email asks for the current password and signs out other devices (the server enforces both).
 */

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_MIN = passwordRulesFor('staff').min;

const initialsOf = (name, fallback) => {
  const words = (name || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return (fallback || '?').slice(0, 1).toUpperCase();
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
};

const Section = ({ id, title, description, children }) => (
  <section aria-labelledby={id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm md:p-md">
    <h2 id={id} className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
    {description && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{description}</p>}
    <div className="mt-sm">{children}</div>
  </section>
);

const DetailsForm = ({ profile, onSaved }) => {
  const [form, setForm] = useState({ name: profile.name, username: profile.username, email: profile.email, currentPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, errors);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const next = { name: form.name.trim(), username: form.username.trim().toLowerCase(), email: form.email.trim().toLowerCase() };
  const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== profile[key]));
  const dirty = Object.keys(changes).length > 0;
  const signInChanging = 'username' in changes || 'email' in changes;

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (next.name && (next.name.length < 2 || next.name.length > 100)) found.name = 'Use 2–100 characters, or leave it empty';
    if (!USERNAME_PATTERN.test(next.username)) found.username = '3–32 letters, digits, dots, hyphens or underscores, starting with a letter or digit';
    if (next.email && !EMAIL_PATTERN.test(next.email)) found.email = 'Enter a valid email address, or leave it empty';
    if (signInChanging && !form.currentPassword) found.currentPassword = 'Enter your current password to change how you sign in';
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0 || !dirty) return;

    setSaving(true);
    try {
      const res = await api.patch('/api/admin/profile', { ...changes, ...(signInChanging && { currentPassword: form.currentPassword }) });
      setForm((f) => ({ ...f, currentPassword: '' }));
      await onSaved(res.data);
      toast.success(signInChanging ? 'Saved. Other devices were signed out.' : 'Profile updated');
    } catch (err) {
      const parsed = parseApiError(err, 'Could not save your profile. Please try again.');
      setErrors(parsed.fieldErrors);
      setFormError(Object.keys(parsed.fieldErrors).length > 0 ? '' : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm({ name: profile.name, username: profile.username, email: profile.email, currentPassword: '' });
    setErrors({});
    setFormError('');
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-sm">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField
        id="profile-name"
        label="Name"
        icon="person"
        value={form.name}
        onChange={set('name')}
        maxLength={100}
        autoComplete="name"
        helper="Optional. Shown in the account menu and on the Team page."
        error={errors.name}
      />
      <div className="grid gap-sm sm:grid-cols-2">
        <FormField
          id="profile-username"
          label="Username"
          icon="alternate_email"
          value={form.username}
          onChange={set('username')}
          maxLength={32}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          helper="You can sign in with this."
          error={errors.username}
        />
        <FormField
          id="profile-email"
          label="Email"
          icon="mail"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={set('email')}
          maxLength={254}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          helper="Optional. You can sign in with this too."
          error={errors.email}
        />
      </div>

      {/* Only when the sign-in changes: the password confirms it's really you */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out-soft ${signInChanging ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden" inert={!signInChanging || undefined}>
          <div className="rounded-xl border border-primary-30 bg-primary-fixed-20 p-sm">
            <FormField
              id="profile-current-password"
              label="Current password"
              type="password"
              icon="lock"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              maxLength={72}
              autoComplete="current-password"
              helper="Needed to change your username or email. Your other devices will be signed out."
              error={errors.currentPassword}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-xs">
        {dirty && (
          <button type="button" onClick={discard} className="btn-secondary">Discard changes</button>
        )}
        <SubmitButton isLoading={saving} loadingText="Saving..." className="sm:w-auto sm:min-w-[10rem]">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
};

const PasswordForm = ({ profile, onChanged }) => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, errors);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.currentPassword) found.currentPassword = 'Enter your current password';
    if (form.newPassword.length < STAFF_MIN) found.newPassword = `Use at least ${STAFF_MIN} characters`;
    if (form.confirmPassword !== form.newPassword) found.confirmPassword = "Passwords don't match";
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await api.post('/api/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await onChanged();
      toast.success('Password updated. Other devices were signed out.');
    } catch (err) {
      const parsed = parseApiError(err, 'Could not update your password. Please try again.');
      setErrors(parsed.fieldErrors);
      setFormError(Object.keys(parsed.fieldErrors).length > 0 ? '' : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-sm">
      {formError && <FormAlert>{formError}</FormAlert>}
      {/* Lets password managers file the new password under the right account */}
      <input type="text" name="username" autoComplete="username" value={profile.username} readOnly hidden />
      <FormField
        id="currentPassword"
        label="Current password"
        type="password"
        icon="lock"
        value={form.currentPassword}
        onChange={set('currentPassword')}
        maxLength={72}
        autoComplete="current-password"
        error={errors.currentPassword}
      />
      <div className="grid gap-sm sm:grid-cols-2">
        <FormField
          id="newPassword"
          label="New password"
          type="password"
          icon="password"
          value={form.newPassword}
          onChange={set('newPassword')}
          maxLength={72}
          autoComplete="new-password"
          helper={<PasswordRules password={form.newPassword} kind="staff" own={[profile.username, profile.email]} />}
          error={errors.newPassword}
        />
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          icon="password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          maxLength={72}
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
      </div>
      <div className="flex sm:justify-end">
        <SubmitButton isLoading={saving} loadingText="Updating..." className="sm:w-auto sm:min-w-[10rem]">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
};

const AdminProfile = () => {
  usePageTitle('Profile');
  const { refresh } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', profile: null, university: '' });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/admin/profile', { signal: controller.signal })
      .then((res) => setState({ loading: false, error: '', profile: res.data.data, university: res.data.university || '' }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setState({ loading: false, error: parseApiError(err, 'Could not load your profile.').message, profile: null, university: '' });
      });
    return () => controller.abort();
  }, []);

  const { loading, error, profile, university } = state;

  const saved = async (data) => {
    setState((s) => ({ ...s, profile: data.data, university: data.university ?? s.university }));
    // The account menu shows the name and sign-in
    await refresh();
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-sm md:px-lg py-sm md:py-lg">
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Profile</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Your account, and the college this site is for.</p>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {loading && (
        <div className="space-y-sm" aria-busy="true" aria-label="Loading your profile">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      )}

      {profile && (
        <div className="space-y-sm animate-rise-in">
          {/* Who you are, and the college the site is for */}
          <section aria-label="Account" className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-soft">
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(120deg,var(--color-primary-fixed),var(--color-brand-50)_55%,var(--color-secondary-fixed))]" aria-hidden="true" />
            <div className="relative px-sm md:px-md pt-sm md:pt-md pb-sm md:pb-md flex flex-col sm:flex-row sm:items-end gap-sm">
              <span
                className="w-20 h-20 shrink-0 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-headline-md text-headline-md shadow-lift ring-4 ring-surface-container-lowest select-none"
                aria-hidden="true"
              >
                {initialsOf(profile.name, profile.username)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-headline-md text-headline-md text-on-surface truncate">{profile.name || 'Super Admin'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1">
                  <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified_user</span>
                    Super Admin
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {profile.email ? `${profile.username} · ${profile.email}` : profile.username}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative border-t border-outline-variant/70 bg-surface-container-low/60 px-sm md:px-md py-sm flex flex-wrap items-center justify-between gap-xs">
              <p className="flex items-center gap-xs min-w-0">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-primary" aria-hidden="true">
                  <span className="material-symbols-outlined text-[20px]">school</span>
                </span>
                <span className="min-w-0">
                  <span className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">College / University</span>
                  <span className="block font-label-md text-label-md text-on-surface truncate">
                    {university || <span className="font-normal italic text-on-surface-variant">Not set yet</span>}
                  </span>
                </span>
              </p>
              <Link
                to="/admin/settings"
                className="inline-flex items-center gap-1 min-h-[44px] px-xs rounded-lg font-label-md text-label-md text-primary hover:underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                {university ? 'Change in Setup' : 'Set it in Setup'}
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
              </Link>
            </div>
          </section>

          <Section id="details-heading" title="Account Details" description="Only the username is required. You sign in with your username or your email.">
            <DetailsForm key={`${profile.username}|${profile.email}|${profile.name}`} profile={profile} onSaved={saved} />
          </Section>

          <Section id="password-heading" title="Password" description="Your other devices are signed out when you change it.">
            <PasswordForm profile={profile} onChanged={refresh} />
          </Section>

        </div>
      )}
    </div>
  );
};

export default AdminProfile;
