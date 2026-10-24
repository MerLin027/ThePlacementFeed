import { BRANCHES, branchLabel } from '../constants/branches';
import { APPLICATION_STATUSES, APPLICANT_SORTS } from '../constants/applications';

// Filter + sort controls for the applicant table. Fully controlled by the parent.
const ApplicantFilters = ({ filters, onChange }) => {
  const set = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-sm">
      <div className="group/s relative sm:col-span-2">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within/s:text-primary transition-colors duration-200" aria-hidden="true">search</span>
        <input
          type="search"
          value={filters.search}
          onChange={set('search')}
          placeholder="Name, email or roll number"
          aria-label="Search applicants"
          maxLength={100}
          className="input-field rounded-full! pl-11! hover:shadow-soft"
        />
      </div>
      <select value={filters.status} onChange={set('status')} aria-label="Filter by status" className="select-field">
        <option value="">All statuses</option>
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={filters.branch} onChange={set('branch')} aria-label="Filter by branch" className="select-field">
        <option value="">All branches</option>
        {BRANCHES.map((b) => (
          <option key={b} value={b}>{branchLabel(b)}</option>
        ))}
      </select>
      <div className="flex items-center gap-xs">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase" aria-hidden="true">CGPA</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={10}
          step="0.1"
          value={filters.cgpaMin}
          onChange={set('cgpaMin')}
          placeholder="Min"
          aria-label="Minimum CGPA"
          className="input-field"
        />
        <span className="text-on-surface-variant" aria-hidden="true">–</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={10}
          step="0.1"
          value={filters.cgpaMax}
          onChange={set('cgpaMax')}
          placeholder="Max"
          aria-label="Maximum CGPA"
          className="input-field"
        />
      </div>
      <select value={filters.sort} onChange={set('sort')} aria-label="Sort applicants" className="select-field">
        {APPLICANT_SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
};

export default ApplicantFilters;
