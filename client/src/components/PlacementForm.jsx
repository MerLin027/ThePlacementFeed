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
  jdDescription: '',
  tags: [],
  formUrl: '',
};

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
        jdDescription: initialData.jdDescription || '',
        tags: initialData.tags || [],
        formUrl: initialData.formUrl || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic client-side validation
    if (!form.company.trim()) return setError('Company name is required');
    if (!form.role.trim()) return setError('Role is required');
    if (form.ctc === '' || form.ctc < 0) return setError('CTC must be a non-negative number');
    if (form.formUrl && !/^https?:\/\//i.test(form.formUrl.trim())) return setError('Google Form URL must start with http:// or https://');

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        ctc: Number(form.ctc),
        eligibility: {
          branches: form.eligibility.branches,
          cgpa: form.eligibility.cgpa !== '' ? Number(form.eligibility.cgpa) : undefined,
          backlog: form.eligibility.backlog !== '' ? Number(form.eligibility.backlog) : undefined,
        },
        driveDate: form.driveDate || undefined,
        deadline: form.deadline || undefined,
        formUrl: form.formUrl.trim() || undefined,
      };
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
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
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Eligibility Criteria</h4>
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
        <label className="label">Google Form URL (optional)</label>
        <input
          type="text"
          value={form.formUrl}
          onChange={(e) => handleChange('formUrl', e.target.value)}
          className="input-field"
          placeholder="e.g. https://forms.gle/..."
        />
      </div>

      {/* JD Description */}
      <div>
        <label className="label">Job Description</label>
        <textarea
          value={form.jdDescription}
          onChange={(e) => handleChange('jdDescription', e.target.value)}
          className="input-field min-h-[160px] resize-y"
          placeholder="Paste the full job description here..."
          maxLength={50000}
          rows={8}
        />
        <p className="text-xs text-slate-400 mt-1">
          {form.jdDescription.length.toLocaleString()} / 50,000 characters
        </p>
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
