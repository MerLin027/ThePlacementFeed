import { useState, useEffect } from 'react';
import BranchSelect from './BranchSelect';
import TagInput from './TagInput';

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
  status: 'Upcoming',
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
  { value: 'external', label: 'External form only', description: 'Students use the Application Form URL above.' },
  { value: 'in_app', label: 'In-app only', description: 'Students apply here; their profile is shared with you.' },
  { value: 'both', label: 'Both', description: 'In-app application, with the external form offered as an alternative.' },
];

const PlacementForm = ({ initialData, onSubmit, onCancel }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
        driveDate: initialData.driveDate
          ? new Date(initialData.driveDate).toISOString().split('T')[0]
          : '',
        deadline: initialData.deadline
          ? new Date(initialData.deadline).toISOString().split('T')[0]
          : '',
        status: initialData.status || 'Upcoming',
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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleEligibilityChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      eligibility: { ...prev.eligibility, [field]: value },
    }));
  };

  const addRound = () => {
    setForm((prev) => ({
      ...prev,
      selectionRounds: [...prev.selectionRounds, { roundName: '', roundDescription: '' }],
    }));
  };

  const updateRound = (index, field, value) => {
    setForm((prev) => {
      const newRounds = [...prev.selectionRounds];
      newRounds[index] = { ...newRounds[index], [field]: value };
      return { ...prev, selectionRounds: newRounds };
    });
  };

  const removeRound = (index) => {
    setForm((prev) => ({
      ...prev,
      selectionRounds: prev.selectionRounds.filter((_, i) => i !== index),
    }));
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
  };

  const removePrompt = (index) => {
    setForm((prev) => ({
      ...prev,
      customPrompts: prev.customPrompts.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.company.trim()) return setError('Company name is required');
    if (!form.role.trim()) return setError('Role is required');
    if (form.ctc === '' || form.ctc < 0) return setError('CTC must be a non-negative number');
    if (form.formUrl && !/^https:\/\//i.test(form.formUrl.trim())) return setError('Application Form URL must start with https://');
    if (form.applicationMode === 'both' && !form.formUrl.trim()) return setError('Add an Application Form URL, or choose "In-app only"');

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
        formUrl: form.formUrl.trim() || "",
        selectionRounds: form.selectionRounds
          .filter(r => r.roundName.trim())
          .map(r => ({
            roundName: r.roundName.trim(),
            roundDescription: r.roundDescription?.trim() || "",
          })),
        customPrompts: form.customPrompts
          .filter((p) => p.question.trim())
          .map((p) => ({ question: p.question.trim(), required: p.required })),
      };

      // Set statusManuallySet if status was explicitly changed
      const originalStatus = initialData ? initialData.status : INITIAL_FORM.status;
      if (form.status !== originalStatus) {
        payload.statusManuallySet = true;
      }

      await onSubmit(payload);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.map((e) => e.message).join(', ') ||
        'Something went wrong';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-sm bg-error-container border border-error/20 rounded-lg font-body-sm text-body-sm text-on-error-container">
          {error}
        </div>
      )}

      {/* Company & Role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Company *</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="input-field"
            placeholder="e.g. Google"
            maxLength={200}
          />
        </div>
        <div>
          <label className="label">Role *</label>
          <input
            type="text"
            value={form.role}
            onChange={(e) => handleChange('role', e.target.value)}
            className="input-field"
            placeholder="e.g. SDE Intern"
            maxLength={200}
          />
        </div>
      </div>

      {/* Type, CTC, Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Type *</label>
          <select
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="select-field"
          >
            <option value="Full-Time">Full-Time</option>
            <option value="Internship">Internship</option>
            <option value="6M Intern + FTE">6M Intern + FTE</option>
          </select>
        </div>
        <div>
          <label className="label">CTC (LPA) *</label>
          <input
            type="number"
            value={form.ctc}
            onChange={(e) => handleChange('ctc', e.target.value)}
            className="input-field"
            placeholder="e.g. 12"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="select-field"
          >
            <option value="Upcoming">Upcoming</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Postponed toggle */}
      <div className="flex items-start gap-3 p-sm bg-red-50 border border-red-200 rounded-xl">
        <input
          id="isPostponed"
          type="checkbox"
          checked={form.isPostponed}
          onChange={(e) => handleChange('isPostponed', e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-600 cursor-pointer flex-shrink-0"
        />
        <div>
          <label htmlFor="isPostponed" className="font-label-md text-label-md text-red-700 cursor-pointer select-none">
            Mark as Postponed
          </label>
          <p className="font-body-sm text-body-sm text-red-500 mt-0.5">
            Use this to flag the drive as postponed due to unforeseen circumstances — the original status is preserved and can be restored by unchecking this.
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Drive Date</label>
          <input
            type="date"
            value={form.driveDate}
            onChange={(e) => handleChange('driveDate', e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="label">Deadline</label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => handleChange('deadline', e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Eligibility */}
      <div className="p-sm bg-surface-container-low rounded-xl border border-outline-variant">
        <h4 className="font-label-md text-label-md text-on-surface mb-sm">Eligibility Criteria</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Min CGPA</label>
            <input
              type="number"
              value={form.eligibility.cgpa}
              onChange={(e) => handleEligibilityChange('cgpa', e.target.value)}
              className="input-field"
              placeholder="e.g. 7.0"
              min="0"
              max="10"
              step="0.1"
            />
          </div>
          <div>
            <label className="label">Max Backlogs Allowed</label>
            <input
              type="number"
              value={form.eligibility.backlog}
              onChange={(e) => handleEligibilityChange('backlog', e.target.value)}
              className="input-field"
              placeholder="e.g. 0"
              min="0"
            />
          </div>
        </div>
        <div>
          <label className="label">Eligible Branches</label>
          <BranchSelect
            selected={form.eligibility.branches}
            onChange={(branches) => handleEligibilityChange('branches', branches)}
          />
        </div>
      </div>

      {/* Form URL */}
      <div>
        <label className="label">
          Application Form URL <span className="text-outline font-normal ml-1">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="text"
            value={form.formUrl}
            onChange={(e) => handleChange('formUrl', e.target.value)}
            className="input-field pl-9"
            placeholder="https://forms.gle/..."
          />
        </div>
      </div>

      {/* How students apply */}
      <fieldset className="p-sm bg-surface-container-low rounded-xl border border-outline-variant">
        <legend className="font-label-md text-label-md text-on-surface px-1">How students apply</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-xs mt-xs">
          {APPLICATION_MODES.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-xs p-xs rounded-lg border cursor-pointer transition-colors min-h-[44px] ${
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
                className="mt-[3px] accent-primary"
              />
              <span>
                <span className="block font-label-md text-label-md text-on-surface">{mode.label}</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant">{mode.description}</span>
              </span>
            </label>
          ))}
        </div>

        {form.applicationMode !== 'external' && (
          <div className="mt-sm">
            <div className="flex items-center justify-between mb-xs">
              <h4 className="font-label-md text-label-md text-on-surface">
                Extra questions <span className="text-outline font-normal ml-1">(optional, up to {MAX_PROMPTS})</span>
              </h4>
              <button
                type="button"
                onClick={addPrompt}
                disabled={form.customPrompts.length >= MAX_PROMPTS}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-container-lowest text-primary font-label-sm text-label-sm rounded-lg border border-outline-variant hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                Add Question
              </button>
            </div>
            {form.customPrompts.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-sm border border-dashed border-outline-variant rounded-lg">
                Students will only share their profile, resume and an optional note.
              </p>
            ) : (
              <div className="space-y-xs">
                {form.customPrompts.map((prompt, index) => (
                  <div key={index} className="flex items-start gap-xs bg-surface-container-lowest p-xs rounded-lg border border-outline-variant">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={prompt.question}
                        onChange={(e) => updatePrompt(index, 'question', e.target.value)}
                        className="input-field"
                        placeholder="e.g. Are you open to relocating to Bengaluru?"
                        aria-label={`Question ${index + 1}`}
                        maxLength={500}
                      />
                      <label className="inline-flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prompt.required}
                          onChange={(e) => updatePrompt(index, 'required', e.target.checked)}
                          className="accent-primary"
                        />
                        Required
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePrompt(index)}
                      className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md hover:bg-error-container"
                      aria-label={`Remove question ${index + 1}`}
                      title="Remove question"
                    >
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* JD Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label !mb-0">Job Description</label>
          <span className="font-label-sm text-label-sm text-outline">Supports Markdown</span>
        </div>
        <textarea
          value={form.jdDescription}
          onChange={(e) => handleChange('jdDescription', e.target.value)}
          className="input-field min-h-[200px] resize-y font-mono text-sm leading-relaxed"
          placeholder={"# Job Title\n\n## Requirements\n- Requirement 1\n- Requirement 2"}
          maxLength={10000}
          rows={10}
        />
        <div className="flex justify-end mt-1.5">
          <p className="font-label-sm text-label-sm text-outline">
            {form.jdDescription.length.toLocaleString()} / 10,000 characters
          </p>
        </div>
      </div>

      {/* Selection Process */}
      <div className="p-sm bg-surface-container-low rounded-xl border border-outline-variant">
        <div className="flex items-center justify-between mb-sm">
          <h4 className="font-label-md text-label-md text-on-surface">Selection Process <span className="text-outline font-normal ml-1">(optional)</span></h4>
          <button
            type="button"
            onClick={addRound}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-container-lowest text-primary font-label-sm text-label-sm rounded-lg border border-outline-variant hover:bg-surface-container-high focus:outline-none transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Round
          </button>
        </div>
        {form.selectionRounds.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-sm border border-dashed border-outline-variant rounded-lg">
            No selection rounds added.
          </p>
        ) : (
          <div className="space-y-4">
            {form.selectionRounds.map((round, index) => (
              <div key={index} className="flex items-start gap-3 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant relative group">
                <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-sm text-label-sm flex-shrink-0 mt-2">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={round.roundName}
                    onChange={(e) => updateRound(index, 'roundName', e.target.value)}
                    className="input-field"
                    placeholder="Round Name (e.g. Online Assessment)"
                    maxLength={200}
                  />
                  <textarea
                    value={round.roundDescription}
                    onChange={(e) => updateRound(index, 'roundDescription', e.target.value)}
                    className="input-field min-h-[80px] py-2 resize-y"
                    placeholder="Round Description (optional)"
                    maxLength={1000}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRound(index)}
                  className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md hover:bg-error-container"
                  title="Remove Round"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="label">Tags</label>
        <TagInput
          tags={form.tags}
          onChange={(tags) => handleChange('tags', tags)}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary min-w-[120px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : initialData ? (
            'Update Placement'
          ) : (
            'Add Placement'
          )}
        </button>
      </div>
    </form>
  );
};

export default PlacementForm;
