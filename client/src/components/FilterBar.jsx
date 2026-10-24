import { useState, useId, useRef, useEffect } from 'react';
import { useCatalog } from '../stores/catalog';

const SORT_LABELS = {
  closing_soon: 'Closing soon',
  newest: 'Newest first',
  oldest: 'Oldest first',
  date_desc: 'Drive date (latest)',
  date_asc: 'Drive date (earliest)',
  ctc_desc: 'CTC (high → low)',
  ctc_asc: 'CTC (low → high)',
};

// Typing "/" anywhere outside a form field jumps to the search box
const isTypingTarget = (el) =>
  el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const FilterBar = ({ filters, onFilterChange, onReset }) => {
  const { branches, branchLabel } = useCatalog();
  const [isExpanded, setIsExpanded] = useState(false);
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const searchRef = useRef(null);

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role=dialog]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.branch,
    filters.ctcMin,
    filters.ctcMax,
    filters.sort && filters.sort !== 'closing_soon',
  ].filter(Boolean).length;

  // Removable summary of the panel's filters, shown while the panel is closed
  const chips = [
    filters.status && { key: 'status', label: `Status: ${filters.status}` },
    filters.branch && { key: 'branch', label: `Branch: ${branchLabel(filters.branch)}` },
    filters.ctcMin && { key: 'ctcMin', label: `CTC ≥ ${filters.ctcMin} LPA` },
    filters.ctcMax && { key: 'ctcMax', label: `CTC ≤ ${filters.ctcMax} LPA` },
    filters.sort && filters.sort !== 'closing_soon' && { key: 'sort', label: `Sort: ${SORT_LABELS[filters.sort] || filters.sort}`, reset: 'closing_soon' },
  ].filter(Boolean);

  return (
    <div className="w-full md:max-w-2xl mx-auto mb-md">
      {/* One pill: search icon, field, clear / "/" hint, divider, filters toggle */}
      <div
        role="search"
        className="group/search flex items-center gap-1 h-[56px] pl-4 pr-1.5 rounded-full bg-surface-container-lowest border border-outline-variant shadow-soft hover:border-outline focus-within:border-primary focus-within:hover:border-primary focus-within:shadow-glow transition-control"
      >
        <span
          className="material-symbols-outlined shrink-0 text-outline text-[22px] group-focus-within/search:text-primary transition-colors duration-200"
          aria-hidden="true"
        >
          search
        </span>
        <input
          ref={searchRef}
          type="search"
          aria-label="Search drives by company or role"
          aria-keyshortcuts="/"
          placeholder="Search by company or role"
          value={filters.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          className="flex-1 min-w-0 h-full pl-1 bg-transparent font-body-md text-body-md text-on-surface placeholder-outline focus:outline-hidden [&::-webkit-search-cancel-button]:appearance-none"
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => {
              handleChange('search', '');
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-control animate-pop-in"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        ) : (
          <kbd
            className="hidden md:inline-flex shrink-0 items-center justify-center min-w-[26px] h-[26px] px-1.5 mr-1 rounded-md border border-outline-variant bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant group-focus-within/search:opacity-0 transition-opacity duration-150"
            aria-hidden="true"
          >
            /
          </kbd>
        )}
        <span className="shrink-0 w-px h-6 bg-outline-variant mx-1" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={fid('panel')}
          className={`shrink-0 inline-flex items-center justify-center gap-1.5 h-[44px] min-w-[44px] px-3 sm:px-4 rounded-full font-label-md text-label-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-control ${
            isExpanded || activeFilterCount > 0
              ? 'bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed-dim'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            tune
          </span>
          {/* Name comes from the content ("Filters, 2 active"); the word is screen-reader-only on phones */}
          <span className="sr-only sm:not-sr-only">Filters</span>
          {activeFilterCount > 0 && (
            <>
              <span
                key={activeFilterCount}
                className="bg-primary-container text-on-primary text-xs tabular-nums rounded-full min-w-5 h-5 px-1 flex items-center justify-center animate-pop-in"
                aria-hidden="true"
              >
                {activeFilterCount}
              </span>
              <span className="sr-only">{`, ${activeFilterCount} active`}</span>
            </>
          )}
        </button>
      </div>

      {/* Active filters, removable one by one */}
      {!isExpanded && chips.length > 0 && (
        <div className="flex flex-wrap items-center md:justify-center gap-x-1 mt-xs">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleChange(chip.key, chip.reset || '')}
              className="group/chip inline-flex items-center min-h-[44px] rounded-full focus-visible:outline-hidden animate-pop-in"
            >
              <span className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md group-hover/chip:bg-primary-fixed-dim group-focus-visible/chip:ring-2 group-focus-visible/chip:ring-primary transition-control">
                <span className="sr-only">Remove filter: </span>
                {chip.label}
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
              </span>
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-[44px] px-2 rounded-full font-label-md text-label-md text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Expanded filters */}
      {isExpanded && (
        <div
          id={fid('panel')}
          className="mt-xs p-md bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-lift origin-top animate-menu-in"
        >
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
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}{b.active ? '' : ' (archived)'}</option>
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
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="min-h-[44px] px-3 rounded-full font-label-md text-label-md text-secondary hover:text-primary hover:bg-surface-container-low transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
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
