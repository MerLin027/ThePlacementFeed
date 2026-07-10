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
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
      {/* Search bar + toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by company or role..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="input-field !pl-10"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`btn-secondary gap-2 ${activeFilterCount > 0 ? '!border-brand-300 !text-brand-600' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Sort by:</label>
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
              className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
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
