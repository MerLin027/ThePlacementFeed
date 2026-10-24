import { useState, useId } from 'react';
import { BRANCHES, branchLabel } from '../constants/branches';

const FilterBar = ({ filters, onFilterChange, onReset }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.branch,
    filters.ctcMin,
    filters.ctcMax,
    filters.sort && filters.sort !== 'closing_soon',
  ].filter(Boolean).length;

  return (
    <div className="w-full md:max-w-2xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-md">
      {/* Search bar + toggle */}
      <div className="flex items-center gap-sm">
        <div className="flex-1 flex items-center gap-2 h-[46px] px-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
          <span className="material-symbols-outlined shrink-0 text-outline text-[20px]" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            aria-label="Search drives by company or role"
            placeholder="Search by company or role..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="flex-1 min-w-0 h-full bg-transparent font-body-md text-body-md text-on-surface placeholder-outline focus:outline-hidden text-center placeholder:text-center"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={fid('panel')}
          className={`inline-flex items-center gap-2 h-[46px] min-w-[46px] px-4 rounded-lg font-label-md text-label-md border transition-colors ${
            activeFilterCount > 0
              ? 'bg-primary/5 border-primary/30 text-primary'
              : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
          {/* Name comes from the content ("Filters, 2 active"); the word is screen-reader-only on phones */}
          <span className="sr-only sm:not-sr-only">Filters</span>
          {activeFilterCount > 0 && (
            <>
              <span className="bg-primary-container text-on-primary text-xs rounded-full w-5 h-5 flex items-center justify-center" aria-hidden="true">
                {activeFilterCount}
              </span>
              <span className="sr-only">{`, ${activeFilterCount} active`}</span>
            </>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div id={fid('panel')} className="mt-md pt-md border-t border-outline-variant">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
            {/* Status */}
            <div>
              <label htmlFor={fid('status')} className="label">Status</label>
              <select
                id={fid('status')}
                value={filters.status || ''}
                onChange={(e) => handleChange('status', e.target.value)}
                className="select-field"
              >
                <option value="">All statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed (past drives)</option>
              </select>
            </div>

            {/* Branch */}
            <div>
              <label htmlFor={fid('branch')} className="label">Branch</label>
              <select
                id={fid('branch')}
                value={filters.branch || ''}
                onChange={(e) => handleChange('branch', e.target.value)}
                className="select-field"
              >
                <option value="">All branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{branchLabel(b)}</option>
                ))}
              </select>
            </div>

            {/* CTC Range */}
            <div>
              <label htmlFor={fid('ctcMin')} className="label">Min CTC (LPA)</label>
              <input
                id={fid('ctcMin')}
                type="number"
                inputMode="decimal"
                placeholder="Any"
                min="0"
                step="0.5"
                value={filters.ctcMin || ''}
                onChange={(e) => handleChange('ctcMin', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor={fid('ctcMax')} className="label">Max CTC (LPA)</label>
              <input
                id={fid('ctcMax')}
                type="number"
                inputMode="decimal"
                placeholder="Any"
                min="0"
                step="0.5"
                value={filters.ctcMax || ''}
                onChange={(e) => handleChange('ctcMax', e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Sort + Reset */}
          <div className="flex flex-wrap items-center justify-between gap-sm mt-md pt-md border-t border-outline-variant">
            <div className="flex items-center gap-sm">
              <label htmlFor={fid('sort')} className="font-label-md text-label-md text-on-surface-variant">Sort by</label>
              <select
                id={fid('sort')}
                value={filters.sort || 'closing_soon'}
                onChange={(e) => handleChange('sort', e.target.value)}
                className="select-field w-auto!"
              >
                <option value="closing_soon">Closing soon</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="date_desc">Drive date (latest)</option>
                <option value="date_asc">Drive date (earliest)</option>
                <option value="ctc_desc">CTC (high → low)</option>
                <option value="ctc_asc">CTC (low → high)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="min-h-[44px] px-2 rounded-lg font-label-md text-label-md text-secondary hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
