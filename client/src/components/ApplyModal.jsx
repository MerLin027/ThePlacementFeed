import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/auth';
import { useMyApplications } from '../context/myApplications';
import Modal from './Modal';
import { FormAlert } from './AuthCard';
import FormField from './FormField';
import { parseApiError } from '../utils/formErrors';
import { branchLabel } from '../constants/branches';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';

const SummaryRow = ({ label, value }) => (
  <div className="flex justify-between gap-sm py-[6px] border-b border-surface-variant last:border-b-0">
    <dt className="font-body-sm text-body-sm text-on-surface-variant">{label}</dt>
    <dd className="font-label-md text-label-md text-on-surface text-right break-all">{value}</dd>
  </div>
);

/**
 * In-app application form. Profile details are shown read-only (they're
 * snapshotted server-side); the student adds a resume link for this drive,
 * an optional note, answers to the drive's questions, and consent.
 */
const ApplyModal = ({ drive, isOpen, onClose }) => {
  const { refreshStudent } = useAuth();
  const { markApplied } = useMyApplications();
  const prompts = drive.customPrompts || [];

  const [profile, setProfile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [answers, setAnswers] = useState({});
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, fieldErrors);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    setError('');
    setFieldErrors({});
    api
      .get('/api/students/me', { signal: controller.signal })
      .then((res) => {
        setProfile(res.data.data);
        setResumeUrl(res.data.data.resumeUrl || '');
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') {
          setError(parseApiError(err, 'Could not load your profile.').message);
        }
      });
    return () => controller.abort();
  }, [isOpen]);

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {};
    prompts.forEach((p) => {
      if (p.required && !(answers[p._id] || '').trim()) errors[`prompt-${p._id}`] = 'This question needs an answer';
    });
    if (!resumeUrl.trim()) errors.resumeUrl = 'Please add a resume link';
    if (!consent) errors.consentGiven = 'Please confirm to continue';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await api.post('/api/applications', {
        driveId: drive._id,
        resumeUrl: resumeUrl.trim(),
        coverNote: coverNote.trim(),
        consentGiven: true,
        customAnswers: prompts
          .filter((p) => (answers[p._id] || '').trim())
          .map((p) => ({ promptId: p._id, answer: answers[p._id].trim() })),
      });
      markApplied(drive._id, 'Applied', { company: drive.company, role: drive.role });
      toast.success(`Application sent to ${drive.company}`);
      onClose();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'ALREADY_APPLIED') {
        markApplied(drive._id, 'Applied', { company: drive.company, role: drive.role });
        toast('You had already applied to this drive.');
        onClose();
        return;
      }
      if (code === 'INCOMPLETE_PROFILE' || code?.startsWith('INELIGIBLE')) {
        // Profile changed since the page loaded — refresh so the button updates
        await refreshStudent();
      }
      if (code === 'MISSING_ANSWERS') {
        const missing = {};
        (err.response.data.missingPromptIds || []).forEach((id) => {
          missing[`prompt-${id}`] = 'This question needs an answer';
        });
        setFieldErrors(missing);
      }
      const parsed = parseApiError(err, 'Could not submit your application. Please try again.');
      setFieldErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
      setError(parsed.message || 'Please fix the highlighted fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Apply to ${drive.company}`}>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-sm">
        <p className="font-body-md text-body-md text-on-surface-variant">{drive.role}</p>

        {error && <FormAlert>{error}</FormAlert>}

        {!profile && !error && (
          <p className="font-body-sm text-body-sm text-on-surface-variant" role="status">Loading your details…</p>
        )}

        {profile && (
          <section aria-labelledby="apply-summary-heading" className="bg-surface-container-low rounded-xl p-sm">
            <div className="flex items-center justify-between gap-sm mb-xs">
              <h3 id="apply-summary-heading" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Shared from your profile
              </h3>
              <Link to="/profile" className="font-body-sm text-body-sm text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs">
                Edit profile
              </Link>
            </div>
            <dl>
              <SummaryRow label="Name" value={fullName} />
              <SummaryRow label="Roll number" value={profile.rollNumber} />
              <SummaryRow label="Email" value={profile.email} />
              <SummaryRow label="Phone" value={profile.phone} />
              <SummaryRow label="Branch" value={branchLabel(profile.branch)} />
              <SummaryRow label="CGPA" value={profile.cgpa} />
              <SummaryRow label="Active backlogs" value={profile.activeBacklogs} />
              <SummaryRow label="Graduation year" value={profile.graduationYear} />
            </dl>
          </section>
        )}

        <FormField
          id="apply-resumeUrl"
          label="Resume link for this drive"
          type="url"
          value={resumeUrl}
          onChange={(e) => setResumeUrl(e.target.value)}
          maxLength={500}
          helper="Pre-filled from your profile. Use a different https:// link if you have a resume tailored for this role."
          error={fieldErrors.resumeUrl || fieldErrors['apply-resumeUrl']}
        />

        {prompts.map((p) => (
          <FormField
            key={p._id}
            id={`prompt-${p._id}`}
            label={`${p.question}${p.required ? ' *' : ''}`}
            error={fieldErrors[`prompt-${p._id}`]}
          >
            {(controlProps) => (
              <textarea
                {...controlProps}
                value={answers[p._id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [p._id]: e.target.value }))}
                maxLength={2000}
                rows={3}
                className="input-field h-auto min-h-[88px] py-2 resize-y"
              />
            )}
          </FormField>
        ))}

        <FormField id="apply-coverNote" label="Note to the CDPC (optional)" error={fieldErrors.coverNote}
          helper={`${coverNote.length.toLocaleString()} / 2,000 characters`}>
          {(controlProps) => (
            <textarea
              {...controlProps}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              maxLength={2000}
              rows={3}
              className="input-field h-auto min-h-[88px] py-2 resize-y"
            />
          )}
        </FormField>

        <div>
          <label htmlFor="apply-consent" className="flex items-start gap-xs cursor-pointer min-h-[44px] py-xs">
            <input
              id="apply-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={fieldErrors.consentGiven ? true : undefined}
              aria-describedby={fieldErrors.consentGiven ? 'apply-consent-error' : undefined}
              className="mt-[3px] w-5 h-5 accent-primary shrink-0 cursor-pointer"
            />
            <span className="font-body-sm text-body-sm text-on-surface">
              I confirm these details are correct, and I agree to share them with the CDPC and {drive.company} for this drive.
            </span>
          </label>
          {fieldErrors.consentGiven && (
            <p id="apply-consent-error" className="font-body-sm text-body-sm text-error">{fieldErrors.consentGiven}</p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-xs pt-xs">
          <button type="button" onClick={handleClose} className="btn-secondary min-h-[44px]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !profile}
            aria-busy={isSubmitting}
            className="btn-primary min-h-[44px] sm:min-w-[180px]"
          >
            {isSubmitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ApplyModal;
