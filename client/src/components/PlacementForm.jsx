import { useState, useEffect, useRef } from 'react';
import BranchSelect from './BranchSelect';
import TagInput from './TagInput';
import FormField from './FormField';
import { FormAlert } from './AuthCard';
import Spinner from './Spinner';
import { computeAutoStatus } from '../utils/driveStatus';
import { useFocusFirstInvalid } from '../hooks/useFocusFirstInvalid';

const INITIAL_FORM = {
  company: '',
  role: '',
  type: 'Full-Time',
  ctc: '',
  eligibility: {
    branches: [],
    cgpa: '',
    backlog: '',
  },
  driveDate: '',
  deadline: '',
  // 'auto' = status follows the dates; a real status pins it manually
  status: 'auto',
  isPostponed: false,
  jdDescription: '',
  tags: [],
  formUrl: '',
  selectionRounds: [],
  applicationMode: 'external',
  customPrompts: [],
};

const MAX_PROMPTS = 5;

const APPLICATION_MODES = [
  { value: 'external', label: 'External form only', description: 'Students use the application form link above.' },
  { value: 'in_app', label: 'In-app only', description: 'Students apply here; their profile is shared with you.' },
  { value: 'both', label: 'Both', description: 'In-app application, with the external form offered as an alternative.' },
];

const Required = () => (
  <>
    <span aria-hidden="true" className="text-error"> *</span>
    <span className="sr-only"> (required)</span>
  </>
);

// Section wrapper: a real <fieldset>/<legend> so screen readers announce the group
const Section = ({ title, hint, children, tinted = false }) => (
  <fieldset className={`rounded-xl border border-outline-variant p-sm ${tinted ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}>
    <legend className="px-1 font-label-md text-label-md text-on-surface">
      {title}
      {hint && <span className="ml-1 font-normal text-on-surface-variant">{hint}</span>}
    </legend>
    <div className="space-y-sm mt-xs">{children}</div>
  </fieldset>
);

const smallButton =
  'inline-flex items-center gap-1 min-h-[44px] px-3 bg-surface-container-lowest text-primary font-label-md text-label-md rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';

const removeButton =
  'flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

// Client-side checks that mirror the server's rules (the server re-validates everything)
const validateForm = (form) => {
  const errors = {};
  if (!form.company.trim()) errors.company = 'Enter the company name';
  if (!form.role.trim()) errors.role = 'Enter the role';
  if (form.ctc === '' || Number(form.ctc) < 0 || Number.isNaN(Number(form.ctc))) errors.ctc = 'Enter the CTC as a number (0 or more)';
  if (form.driveDate && form.deadline && form.deadline > form.driveDate) {
    errors.deadline = 'The deadline must be on or before the drive date';
  }
  const cgpa = form.eligibility.cgpa;
  if (cgpa !== '' && (Number(cgpa) < 0 || Number(cgpa) > 10)) errors['eligibility.cgpa'] = 'CGPA must be between 0 and 10';
  const backlog = form.eligibility.backlog;
  if (backlog !== '' && (!Number.isInteger(Number(backlog)) || Number(backlog) < 0)) {
    errors['eligibility.backlog'] = 'Use a whole number (0 or more)';
  }
  const url = form.formUrl.trim();
  if (url && !/^https:\/\//i.test(url)) errors.formUrl = 'The form link must start with https://';
  else if (form.applicationMode === 'both' && !url) errors.formUrl = 'Add an Application Form URL, or choose "In-app only"';
  return errors;
};

// Server errors arrive as [{ field: 'eligibility.cgpa' | 'customPrompts[0].question' | ..., message }]
const mapServerErrors = (err) => {
  const data = err.response?.data;
  const fieldErrors = {};
  const general = [];
  if (Array.isArray(data?.errors)) {
    for (const item of data.errors) {
      if (item && typeof item === 'object' && item.field) {
        const key = item.field.replace(/\[(\d+)\]/g, '.$1');
        if (!fieldErrors[key]) fieldErrors[key] = item.message;
      } else if (typeof item === 'string') {
        general.push(item);
      }
    }
  }
  if (Object.keys(fieldErrors).length === 0 && general.length === 0) {
    general.push(err.response ? data?.message || 'Something went wrong. Please try again.' : 'Could not reach the server. Please check your connection.');
  }
  return { fieldErrors, general: general.join(' ') };
};

const PlacementForm = ({ initialData, onSubmit, onCancel }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);
  useFocusFirstInvalid(formRef, fieldErrors);

  useEffect(() => {
    if (initialData) {
      setForm({
        company: initialData.company || '',
        role: initialData.role || '',
        type: initialData.type || 'Full-Time',
        ctc: initialData.ctc ?? '',
        eligibility: {
          branches: initialData.eligibility?.branches || [],
          cgpa: initialData.eligibility?.cgpa ?? '',
          backlog: initialData.eligibility?.backlog ?? '',
        },
        driveDate: initialData.driveDate ? new Date(initialData.driveDate).toISOString().split('T')[0] : '',
        deadline: initialData.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '',
        status: initialData.statusManuallySet ? initialData.status || 'Upcoming' : 'auto',
        isPostponed: initialData.isPostponed ?? false,
        jdDescription: initialData.jdDescription || '',
        tags: initialData.tags || [],
        formUrl: initialData.formUrl || '',
        selectionRounds: initialData.selectionRounds || [],
        applicationMode: initialData.applicationMode || 'external',
        customPrompts: (initialData.customPrompts || []).map((p) => ({
          question: p.question,
          required: Boolean(p.required),
        })),
      });
    }
  }, [initialData]);

  // Editing a field clears its own error (and the general message)
  const clearError = (key) => {
    setError('');
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
    if (field === 'applicationMode') clearError('formUrl');
    if (field === 'driveDate') clearError('deadline');
  };

  const handleEligibilityChange = (field, value) => {
    setForm((prev) => ({ ...prev, eligibility: { ...prev.eligibility, [field]: value } }));
    clearError(`eligibility.${field}`);
  };

  const addRound = () => {
    setForm((prev) => ({ ...prev, selectionRounds: [...prev.selectionRounds, { roundName: '', roundDescription: '' }] }));
  };
  const updateRound = (index, field, value) => {
    setForm((prev) => {
      const rounds = [...prev.selectionRounds];
      rounds[index] = { ...rounds[index], [field]: value };
      return { ...prev, selectionRounds: rounds };
    });
  };
  const removeRound = (index) => {
    setForm((prev) => ({ ...prev, selectionRounds: prev.selectionRounds.filter((_, i) => i !== index) }));
  };

  const addPrompt = () => {
    setForm((prev) =>
      prev.customPrompts.length >= MAX_PROMPTS
        ? prev
        : { ...prev, customPrompts: [...prev.customPrompts, { question: '', required: false }] }
    );
  };
  const updatePrompt = (index, field, value) => {
    setForm((prev) => {
      const prompts = [...prev.customPrompts];
      prompts[index] = { ...prompts[index], [field]: value };
      return { ...prev, customPrompts: prompts };
    });
    clearError(`customPrompts.${index}.question`);
  };
  const removePrompt = (index) => {
    setForm((prev) => ({ ...prev, customPrompts: prev.customPrompts.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        ctc: Number(form.ctc),
        eligibility: {
          branches: form.eligibility.branches,
          cgpa: form.eligibility.cgpa !== '' ? Number(form.eligibility.cgpa) : null,
          backlog: form.eligibility.backlog !== '' ? Number(form.eligibility.backlog) : null,
        },
        driveDate: form.driveDate || null,
        deadline: form.deadline || null,
        formUrl: form.formUrl.trim() || '',
        selectionRounds: form.selectionRounds
          .filter((r) => r.roundName.trim())
          .map((r) => ({ roundName: r.roundName.trim(), roundDescription: r.roundDescription?.trim() || '' })),
        customPrompts: form.customPrompts
          .filter((p) => p.question.trim())
          .map((p) => ({ question: p.question.trim(), required: p.required })),
      };
      await onSubmit(payload);
    } catch (err) {
      const mapped = mapServerErrors(err);
      setFieldErrors(mapped.fieldErrors);
      setError(mapped.general);
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorCount = Object.keys(fieldErrors).length;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-md">
      {(error || errorCount > 0) && (
        <FormAlert>
          {error || `Please fix the ${errorCount === 1 ? 'highlighted field' : `${errorCount} highlighted fields`} below.`}
        </FormAlert>
      )}

      <Section title="Basics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          <FormField id="pf-company" label={<>Company<Required /></>} value={form.company}
            onChange={(e) => handleChange('company', e.target.value)} placeholder="e.g. Google" maxLength={200}
            error={fieldErrors.company} />
          <FormField id="pf-role" label={<>Role<Required /></>} value={form.role}
            onChange={(e) => handleChange('role', e.target.value)} placeholder="e.g. SDE Intern" maxLength={200}
            error={fieldErrors.role} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <FormField id="pf-type" label={<>Type<Required /></>} error={fieldErrors.type}>
            {(controlProps) => (
              <select {...controlProps} value={form.type} onChange={(e) => handleChange('type', e.target.value)} className="select-field">
                <option value="Full-Time">Full-Time</option>
                <option value="Internship">Internship</option>
                <option value="6M Intern + FTE">6M Intern + FTE</option>
              </select>
            )}
          </FormField>
          <FormField id="pf-ctc" label={<>CTC (LPA)<Required /></>} type="number" inputMode="decimal" value={form.ctc}
            onChange={(e) => handleChange('ctc', e.target.value)} placeholder="e.g. 12" min="0" step="0.1"
            error={fieldErrors.ctc} />
          <div>
            <label htmlFor="placement-status" className="label">Status</label>
            <select
              id="placement-status"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              aria-describedby="placement-status-help"
              className="select-field"
            >
              <option value="auto">Automatic ({computeAutoStatus(form) || 'Upcoming'})</option>
              <option value="Upcoming">Upcoming (fixed)</option>
              <option value="Ongoing">Ongoing (fixed)</option>
              <option value="Completed">Completed (fixed)</option>
            </select>
            <p id="placement-status-help" className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {form.status === 'auto'
                ? 'Follows the dates: Ongoing after the deadline, Completed after the drive date.'
                : "Fixed — dates won't change it until you switch back to Automatic."}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Schedule">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          <FormField id="pf-driveDate" label="Drive date" type="date" value={form.driveDate}
            onChange={(e) => handleChange('driveDate', e.target.value)} error={fieldErrors.driveDate} />
          <FormField id="pf-deadline" label="Application deadline" type="date" value={form.deadline}
            onChange={(e) => handleChange('deadline', e.target.value)}
            helper="Applications stay open through this day."
            error={fieldErrors.deadline} />
        </div>
        <label htmlFor="isPostponed" className="flex items-start gap-xs p-sm bg-red-50 border border-red-200 rounded-lg cursor-pointer min-h-[44px]">
          <input
            id="isPostponed"
            type="checkbox"
            checked={form.isPostponed}
            onChange={(e) => handleChange('isPostponed', e.target.checked)}
            className="mt-[2px] w-5 h-5 accent-red-600 cursor-pointer flex-shrink-0"
          />
          <span>
            <span className="block font-label-md text-label-md text-red-800">Mark as postponed</span>
            <span className="block font-body-sm text-body-sm text-red-800/90 mt-0.5">
              Pauses applications and status automation until you uncheck it. Students are notified either way.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Eligibility" tinted>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          <FormField id="pf-cgpa" label="Minimum CGPA" type="number" inputMode="decimal" value={form.eligibility.cgpa}
            onChange={(e) => handleEligibilityChange('cgpa', e.target.value)} placeholder="e.g. 7.0" min="0" max="10" step="0.1"
            helper="Leave empty for no minimum." error={fieldErrors['eligibility.cgpa']} />
          <FormField id="pf-backlog" label="Max active backlogs" type="number" inputMode="numeric" value={form.eligibility.backlog}
            onChange={(e) => handleEligibilityChange('backlog', e.target.value)} placeholder="e.g. 0" min="0"
            helper="Leave empty for no limit." error={fieldErrors['eligibility.backlog']} />
        </div>
        <div role="group" aria-labelledby="pf-branches-label">
          <p id="pf-branches-label" className="label">Eligible branches</p>
          <BranchSelect
            selected={form.eligibility.branches}
            onChange={(branches) => handleEligibilityChange('branches', branches)}
          />
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">None selected means every branch can apply.</p>
        </div>
      </Section>

      <Section title="How students apply" tinted>
        <FormField id="pf-formUrl" label="Application form link (optional)" type="url" inputMode="url" value={form.formUrl}
          onChange={(e) => handleChange('formUrl', e.target.value)} placeholder="https://forms.gle/..." maxLength={500}
          error={fieldErrors.formUrl} />
        <div role="radiogroup" aria-label="Application method" className="grid grid-cols-1 sm:grid-cols-3 gap-xs">
          {APPLICATION_MODES.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-xs p-xs rounded-lg border cursor-pointer transition-colors duration-200 min-h-[44px] ${
                form.applicationMode === mode.value
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high'
              }`}
            >
              <input
                type="radio"
                name="applicationMode"
                value={mode.value}
                checked={form.applicationMode === mode.value}
                onChange={(e) => handleChange('applicationMode', e.target.value)}
                className="mt-[3px] w-4 h-4 accent-primary"
              />
              <span>
                <span className="block font-label-md text-label-md text-on-surface">{mode.label}</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant">{mode.description}</span>
              </span>
            </label>
          ))}
        </div>

        {form.applicationMode !== 'external' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-xs mb-xs">
              <p className="font-label-md text-label-md text-on-surface">
                Extra questions <span className="text-on-surface-variant font-normal">(optional, up to {MAX_PROMPTS})</span>
              </p>
              <button type="button" onClick={addPrompt} disabled={form.customPrompts.length >= MAX_PROMPTS} className={smallButton}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                Add question
              </button>
            </div>
            {form.customPrompts.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-sm border border-dashed border-outline-variant rounded-lg">
                Students will only share their profile, resume and an optional note.
              </p>
            ) : (
              <ol className="space-y-xs">
                {form.customPrompts.map((prompt, index) => {
                  const err = fieldErrors[`customPrompts.${index}.question`];
                  return (
                    <li key={index} className="flex items-start gap-xs bg-surface-container-lowest p-xs rounded-lg border border-outline-variant">
                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          type="text"
                          value={prompt.question}
                          onChange={(e) => updatePrompt(index, 'question', e.target.value)}
                          className={`input-field ${err ? 'border-error' : ''}`}
                          placeholder="e.g. Are you open to relocating to Bengaluru?"
                          aria-label={`Question ${index + 1}`}
                          aria-invalid={err ? true : undefined}
                          maxLength={500}
                        />
                        {err && <p className="font-body-sm text-body-sm text-error">{err}</p>}
                        <label className="inline-flex items-center gap-xs min-h-[44px] font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={prompt.required}
                            onChange={(e) => updatePrompt(index, 'required', e.target.checked)}
                            className="w-4 h-4 accent-primary"
                          />
                          Required
                        </label>
                      </div>
                      <button type="button" onClick={() => removePrompt(index)} className={removeButton} aria-label={`Remove question ${index + 1}`}>
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </Section>

      <Section title="Description">
        <FormField id="pf-jd" label="Job description" error={fieldErrors.jdDescription}
          helper={`Supports Markdown · ${form.jdDescription.length.toLocaleString()} / 10,000 characters`}>
          {(controlProps) => (
            <textarea
              {...controlProps}
              value={form.jdDescription}
              onChange={(e) => handleChange('jdDescription', e.target.value)}
              className="input-field h-auto min-h-[200px] py-2 resize-y font-mono text-sm leading-relaxed"
              placeholder={'# Job title\n\n## Requirements\n- Requirement 1\n- Requirement 2'}
              maxLength={10000}
              rows={10}
            />
          )}
        </FormField>
      </Section>

      <Section title="Selection process" hint="(optional)">
        {form.selectionRounds.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-sm border border-dashed border-outline-variant rounded-lg">
            No selection rounds added.
          </p>
        ) : (
          <ol className="space-y-xs">
            {form.selectionRounds.map((round, index) => (
              <li key={index} className="flex items-start gap-xs bg-surface-container-lowest p-xs rounded-lg border border-outline-variant">
                <span className="w-7 h-7 mt-2 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-sm text-label-sm flex-shrink-0" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-xs">
                  <input
                    type="text"
                    value={round.roundName}
                    onChange={(e) => updateRound(index, 'roundName', e.target.value)}
                    className="input-field"
                    placeholder="Round name (e.g. Online assessment)"
                    aria-label={`Round ${index + 1} name`}
                    maxLength={200}
                  />
                  <textarea
                    value={round.roundDescription}
                    onChange={(e) => updateRound(index, 'roundDescription', e.target.value)}
                    className="input-field h-auto min-h-[80px] py-2 resize-y"
                    placeholder="What happens in this round (optional)"
                    aria-label={`Round ${index + 1} description`}
                    maxLength={1000}
                  />
                </div>
                <button type="button" onClick={() => removeRound(index)} className={removeButton} aria-label={`Remove round ${index + 1}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={addRound} className={smallButton}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Add round
        </button>
      </Section>

      <Section title="Tags" hint="(optional)">
        <TagInput id="pf-tags" label="Tags" tags={form.tags} onChange={(tags) => handleChange('tags', tags)} />
      </Section>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-xs pt-xs">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="btn-primary sm:min-w-[160px]">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" tone="current" />
              Saving...
            </span>
          ) : initialData ? (
            'Update placement'
          ) : (
            'Add placement'
          )}
        </button>
      </div>
    </form>
  );
};

export default PlacementForm;
