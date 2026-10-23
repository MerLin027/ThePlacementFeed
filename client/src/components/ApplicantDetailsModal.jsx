import { useState, useEffect } from 'react';
import Modal from './Modal';
import { FormAlert } from './AuthCard';
import { ApplicationStatusPill } from './ApplyButton';
import { branchLabel } from '../constants/branches';
import { APPLICATION_STATUSES } from '../constants/applications';
import { parseApiError } from '../utils/formErrors';

const Row = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between gap-[2px] sm:gap-sm py-[6px] border-b border-surface-variant last:border-b-0">
    <dt className="font-body-sm text-body-sm text-on-surface-variant shrink-0">{label}</dt>
    <dd className="font-body-md text-body-md text-on-surface sm:text-right wrap-break-word">{children}</dd>
  </div>
);

/**
 * Full application for one applicant: submitted profile snapshot, resume,
 * note, answers, plus the admin's status and private note.
 * All student text is rendered as plain text (React escapes it).
 */
const ApplicantDetailsModal = ({ applicant, isOpen, onClose, onSave }) => {
  const [status, setStatus] = useState('Applied');
  const [adminNote, setAdminNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (applicant) {
      setStatus(applicant.status);
      setAdminNote(applicant.adminNote || '');
      setError('');
    }
  }, [applicant]);

  if (!applicant) return null;
  const s = applicant.snapshot;
  const name = `${s.firstName} ${s.lastName}`.trim();

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await onSave(applicant, { status, adminNote: adminNote.trim() });
      onClose();
    } catch (err) {
      setError(parseApiError(err, 'Could not save changes.').message || 'Could not save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={name || 'Applicant'}>
      <div className="space-y-sm">
        <div className="flex flex-wrap items-center gap-xs">
          <ApplicationStatusPill status={applicant.status} />
          {applicant.studentDeleted && (
            <span className="px-2 py-[2px] rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
              Account deleted
            </span>
          )}
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Applied {new Date(applicant.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>

        <section aria-label="Submitted details" className="bg-surface-container-low rounded-xl p-sm">
          <dl>
            <Row label="Roll number">{s.rollNumber || '—'}</Row>
            <Row label="Email">{s.email || '—'}</Row>
            <Row label="Phone">{s.phone || '—'}</Row>
            <Row label="Branch">{s.branch ? branchLabel(s.branch) : '—'}</Row>
            <Row label="CGPA">{s.cgpa ?? '—'}</Row>
            <Row label="Active backlogs">{s.activeBacklogs ?? '—'}</Row>
            <Row label="Backlog history">{s.historyBacklogs ?? '—'}</Row>
            <Row label="Graduation year">{s.graduationYear ?? '—'}</Row>
            <Row label="Resume">
              {applicant.resumeUrl ? (
                <a
                  href={applicant.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  Open resume
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
                </a>
              ) : (
                '—'
              )}
            </Row>
          </dl>
        </section>

        {applicant.coverNote && (
          <section>
            <h3 className="label">Note from the student</h3>
            <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap wrap-break-word">{applicant.coverNote}</p>
          </section>
        )}

        {applicant.customAnswers.length > 0 && (
          <section>
            <h3 className="label">Answers</h3>
            <dl className="space-y-xs">
              {applicant.customAnswers.map((a, i) => (
                <div key={i}>
                  <dt className="font-label-md text-label-md text-on-surface">{a.question}</dt>
                  <dd className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap wrap-break-word">{a.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="border-t border-surface-variant pt-sm space-y-sm" aria-label="Admin">
          {error && <FormAlert>{error}</FormAlert>}
          <div>
            <label htmlFor="applicant-status" className="label">Status</label>
            <select
              id="applicant-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select-field"
            >
              {APPLICATION_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="applicant-note" className="label">Private note (only admins see this)</label>
            <textarea
              id="applicant-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={1000}
              rows={3}
              className="input-field h-auto min-h-[88px] py-2 resize-y"
            />
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{adminNote.length} / 1,000</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-xs">
            <button type="button" onClick={onClose} className="btn-secondary min-h-[44px]">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              aria-busy={isSaving}
              className="btn-primary min-h-[44px] sm:min-w-[140px]"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default ApplicantDetailsModal;
