import { useState } from 'react';
import { BRANCHES } from './BranchSelect';

const FilterBar = ({ filters, onFilterChange, onReset }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.branch,
    filters.ctcMin,
    filters.ctcMax,
    filters.sort && filters.sort !== 'newest',
  ].filter(Boolean).length;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-md">
      {/* Search bar + toggle */}
      <div className="flex items-center gap-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by company or role..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center gap-2 h-11 px-4 rounded-lg font-label-md text-label-md border transition-colors ${
            activeFilterCount > 0
              ? 'bg-primary/5 border-primary/30 text-primary'
              : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-container text-on-primary text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="mt-md pt-md border-t border-outline-variant">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
            {/* Status */}
            <div>
              <label className="label">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleChange('status', e.target.value)}
                className="select-field"
              >
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="label">Branch</label>
              <select
                value={filters.branch || ''}
                onChange={(e) => handleChange('branch', e.target.value)}
                className="select-field"
              >
                <option value="">All Branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* CTC Range */}
            <div>
              <label className="label">Min CTC (LPA)</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                step="0.5"
                value={filters.ctcMin || ''}
                onChange={(e) => handleChange('ctcMin', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Max CTC (LPA)</label>
              <input
                type="number"
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
          <div className="flex items-center justify-between mt-md pt-md border-t border-outline-variant">
            <div className="flex items-center gap-sm">
              <label className="font-label-md text-label-md text-on-surface-variant">Sort by:</label>
              <select
                value={filters.sort || 'newest'}
                onChange={(e) => handleChange('sort', e.target.value)}
                className="select-field !w-auto"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="date_desc">Drive Date (Latest)</option>
                <option value="date_asc">Drive Date (Earliest)</option>
                <option value="ctc_desc">CTC (High → Low)</option>
                <option value="ctc_asc">CTC (Low → High)</option>
              </select>
            </div>
            <button
              onClick={onReset}
              className="font-label-md text-label-md text-secondary hover:text-primary transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
