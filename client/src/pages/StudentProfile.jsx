import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FormAlert } from '../components/AuthCard';
import FormField from '../components/FormField';
import ProfileCompletionBanner from '../components/ProfileCompletionBanner';
import { PageSpinner } from '../components/RequireRole';
import { BRANCHES } from '../constants/branches';
import { parseApiError } from '../utils/formErrors';
import { safeReturnTo } from '../utils/safeReturnTo';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  branch: '',
  cgpa: '',
  activeBacklogs: '0',
  historyBacklogs: '0',
  graduationYear: '',
  phone: '',
  resumeUrl: '',
};

const toForm = (profile) => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  branch: profile.branch,
  cgpa: profile.cgpa ?? '',
  activeBacklogs: String(profile.activeBacklogs ?? 0),
  historyBacklogs: String(profile.historyBacklogs ?? 0),
  graduationYear: profile.graduationYear ?? '',
  phone: profile.phone,
  resumeUrl: profile.resumeUrl,
});

// Numbers go to the API as numbers (or null to clear), strings as trimmed text
const toPayload = (form) => ({
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  branch: form.branch,
  cgpa: form.cgpa === '' ? null : Number(form.cgpa),
  activeBacklogs: form.activeBacklogs === '' ? 0 : Number(form.activeBacklogs),
  historyBacklogs: form.historyBacklogs === '' ? 0 : Number(form.historyBacklogs),
  graduationYear: form.graduationYear === '' ? null : Number(form.graduationYear),
  phone: form.phone.trim(),
  resumeUrl: form.resumeUrl.trim(),
});

const ReadOnlyRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[2px] py-xs border-b border-surface-variant last:border-b-0">
    <dt className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</dt>
    <dd className="font-body-md text-body-md text-on-surface break-all flex items-center gap-1">
      {value}
      <span className="material-symbols-outlined text-[16px] text-outline" aria-label="Cannot be changed">lock</span>
    </dd>
  </div>
);

const StudentProfile = () => {
  const { refreshStudent } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo = rawReturnTo ? safeReturnTo(rawReturnTo, null) : null;

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/students/me', { signal: controller.signal })
      .then((res) => {
        setProfile(res.data.data);
        setForm(toForm(res.data.data));
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          setLoadError(parseApiError(err, 'Could not load your profile.').message);
        }
      });
    return () => controller.abort();
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSaving(true);
    try {
      const res = await api.patch('/api/students/me', toPayload(form));
      const next = res.data.data;
      setProfile(next);
      setForm(toForm(next));
      await refreshStudent();
      toast.success('Profile saved');
      if (returnTo && next.missingFields.length === 0) {
        navigate(returnTo);
      }
    } catch (err) {
      const parsed = parseApiError(err, 'Could not save your profile. Please try again.');
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message || 'Please fix the highlighted fields.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-container-max mx-auto w-full px-sm md:px-lg py-lg">
        <FormAlert>{loadError}</FormAlert>
      </div>
    );
  }

  if (!profile) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto w-full px-sm md:px-lg py-sm md:py-lg">
      <div className="mb-md">
        <h1 className="font-headline-md text-headline-md text-on-surface">My Profile</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-base">
          These details are shared with the CDPC when you apply to a drive.
        </p>
      </div>

      <div className="space-y-sm">
        <ProfileCompletionBanner missingFields={profile.missingFields} />

        {/* Account (locked) */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm md:p-md" aria-labelledby="account-heading">
          <h2 id="account-heading" className="font-headline-sm text-headline-sm text-on-surface mb-xs">Account</h2>
          <dl>
            <ReadOnlyRow label="Email" value={profile.email} />
            <ReadOnlyRow label="Roll number" value={profile.rollNumber} />
            <ReadOnlyRow label="Institute" value={profile.institute} />
          </dl>
          <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
            Your email and roll number can&apos;t be changed. If something here looks wrong, the CDPC admin can help you out.
          </p>
          <Link
            to="/change-password"
            className="btn-secondary mt-sm min-h-[44px] gap-xs"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">key</span>
            Change password
          </Link>
        </section>

        {/* Editable details */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm md:p-md space-y-sm"
          aria-labelledby="details-heading"
        >
          <h2 id="details-heading" className="font-headline-sm text-headline-sm text-on-surface">Your details</h2>

          {error && <FormAlert>{error}</FormAlert>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            <FormField id="firstName" label="First name" value={form.firstName} onChange={update('firstName')}
              autoComplete="given-name" maxLength={100} error={fieldErrors.firstName} />
            <FormField id="lastName" label="Last name" value={form.lastName} onChange={update('lastName')}
              autoComplete="family-name" maxLength={100} error={fieldErrors.lastName} />

            <FormField id="branch" label="Branch" error={fieldErrors.branch}>
              {(controlProps) => (
                <select {...controlProps} value={form.branch} onChange={update('branch')} className="select-field">
                  <option value="">Select your branch</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="graduationYear" label="Graduation year" type="number" inputMode="numeric"
              min={2020} max={2040} value={form.graduationYear} onChange={update('graduationYear')}
              error={fieldErrors.graduationYear} />

            <FormField id="cgpa" label="CGPA" type="number" inputMode="decimal" step="0.01" min={0} max={10}
              value={form.cgpa} onChange={update('cgpa')} helper="On a 10-point scale."
              error={fieldErrors.cgpa} />

            <FormField id="phone" label="Phone number" type="tel" value={form.phone} onChange={update('phone')}
              autoComplete="tel" maxLength={16} helper="10–15 digits, e.g. 9876543210 or +919876543210."
              error={fieldErrors.phone} />

            <FormField id="activeBacklogs" label="Active backlogs" type="number" inputMode="numeric" min={0} max={50}
              value={form.activeBacklogs} onChange={update('activeBacklogs')} error={fieldErrors.activeBacklogs} />

            <FormField id="historyBacklogs" label="Backlog history" type="number" inputMode="numeric" min={0} max={50}
              value={form.historyBacklogs} onChange={update('historyBacklogs')}
              helper="Total backlogs you've ever had, including cleared ones."
              error={fieldErrors.historyBacklogs} />
          </div>

          <FormField id="resumeUrl" label="Resume link" type="url" value={form.resumeUrl} onChange={update('resumeUrl')}
            maxLength={500} placeholder="https://drive.google.com/..."
            helper="A https:// link the CDPC can open, e.g. a Google Drive file shared as 'Anyone with the link'."
            error={fieldErrors.resumeUrl} />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-xs pt-xs">
            {returnTo && (
              <Link to={returnTo} className="btn-secondary min-h-[44px]">
                Back to drive
              </Link>
            )}
            <button type="submit" disabled={isSaving} aria-busy={isSaving} className="btn-primary min-h-[44px] sm:min-w-[160px]">
              {isSaving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentProfile;
