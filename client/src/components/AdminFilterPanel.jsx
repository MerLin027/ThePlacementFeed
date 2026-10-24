import { useState, useId, useRef } from 'react';

/**
 * Search + labelled filter panel + sort for the admin lists (Students, Applicants). Same look as the
 * home page's FilterBar: one pill with the search field and a "Filters" toggle that shows how many are
 * active, removable chips for the active filters, and a panel of labelled controls.
 *
 * fields: [{ key, label, type: 'select' | 'multi' | 'number' | 'date', options?: [{ value, label }],
 *            placeholder?, min?, max?, step?, chip?: (value) => string }]
 * values / defaults: current and default value per key (arrays for 'multi')
 */
const isActive = (value, fallback) =>
  Array.isArray(value) ? value.length > 0 && value.join(',') !== (fallback || []).join(',') : value !== '' && value !== fallback;

const AdminFilterPanel = ({
  searchLabel,
  searchPlaceholder,
  fields,
  values,
  defaults,
  onChange,
  onReset,
  sortOptions,
  resultText,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const searchRef = useRef(null);

  const optionLabel = (field, value) => field.options?.find((o) => o.value === value)?.label ?? value;
  const chipFor = (field) => {
    const value = values[field.key];
    if (field.chip) return field.chip(value);
    if (Array.isArray(value)) return `${field.label}: ${value.map((v) => optionLabel(field, v)).join(', ')}`;
    return `${field.label}: ${optionLabel(field, value)}`;
  };

  const activeFields = fields.filter((f) => isActive(values[f.key], defaults[f.key]));
  const sortActive = sortOptions && values.sort !== defaults.sort;
  const chips = [
    ...activeFields.map((f) => ({ key: f.key, label: chipFor(f), reset: defaults[f.key] })),
    sortActive && { key: 'sort', label: `Sort: ${sortOptions.find((o) => o.value === values.sort)?.label || values.sort}`, reset: defaults.sort },
  ].filter(Boolean);
  const activeCount = chips.length;

  const toggleMulti = (key, value) => {
    const current = values[key] || [];
    onChange(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const renderControl = (field) => {
    const id = fid(field.key);
    const value = values[field.key];
    if (field.type === 'multi') {
      // Nothing to choose from (e.g. no applicants yet): leave the group out
      if (field.options.length === 0) return null;
      return (
        <fieldset key={field.key} className="sm:col-span-2">
          <legend className="label">{field.label}</legend>
          <div className="flex flex-wrap gap-xs">
            {field.options.map((o) => {
              const on = value.includes(o.value);
              return (
                <label key={o.value} className="group/opt inline-flex items-center min-h-[44px] cursor-pointer">
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleMulti(field.key, o.value)} />
                  <span
                    className={`inline-flex items-center gap-1 h-9 px-3 rounded-full border font-label-md text-label-md transition-control group-has-[:focus-visible]/opt:ring-2 group-has-[:focus-visible]/opt:ring-primary ${
                      on
                        ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-30'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline'
                    }`}
                  >
                    {on && <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check</span>}
                    {o.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    return (
      <div key={field.key}>
        <label htmlFor={id} className="label">{field.label}</label>
        {field.type === 'select' ? (
          <select id={id} value={value} onChange={(e) => onChange(field.key, e.target.value)} className="select-field">
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={field.type}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder || 'Any'}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="input-field"
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-full mb-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-xs">
        <div
          role="search"
          className="group/search w-full lg:flex-1 flex items-center gap-1 h-[52px] pl-4 pr-1.5 rounded-full bg-surface-container-lowest border border-outline-variant shadow-soft hover:border-outline focus-within:border-primary focus-within:hover:border-primary focus-within:shadow-glow transition-control"
        >
          <span className="material-symbols-outlined shrink-0 text-outline text-[22px] group-focus-within/search:text-primary transition-colors duration-200" aria-hidden="true">
            search
          </span>
          <input
            ref={searchRef}
            type="search"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            maxLength={100}
            value={values.search}
            onChange={(e) => onChange('search', e.target.value)}
            className="flex-1 min-w-0 h-full pl-1 bg-transparent font-body-md text-body-md text-on-surface placeholder-outline focus:outline-hidden [&::-webkit-search-cancel-button]:appearance-none"
          />
          {values.search && (
            <button
              type="button"
              onClick={() => {
                onChange('search', '');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-control animate-pop-in"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          )}
          <span className="shrink-0 w-px h-6 bg-outline-variant mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={fid('panel')}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 h-[44px] min-w-[44px] px-3 sm:px-4 rounded-full font-label-md text-label-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-control ${
              isExpanded || activeCount > 0
                ? 'bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed-dim'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
              tune
            </span>
            Filters
            {activeCount > 0 && (
              <>
                <span key={activeCount} className="bg-primary-container text-on-primary text-xs tabular-nums rounded-full min-w-5 h-5 px-1 flex items-center justify-center animate-pop-in" aria-hidden="true">
                  {activeCount}
                </span>
                <span className="sr-only">{`, ${activeCount} active`}</span>
              </>
            )}
          </button>
        </div>
        {sortOptions && (
          <div className="flex items-center gap-xs">
            <label htmlFor={fid('sort')} className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Sort by</label>
            <select id={fid('sort')} value={values.sort} onChange={(e) => onChange('sort', e.target.value)} className="select-field lg:w-auto!">
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 mt-xs" aria-label="Active filters" role="group">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange(chip.key, chip.reset)}
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

      {isExpanded && (
        <div id={fid('panel')} className="mt-xs p-md bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-lift origin-top animate-menu-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">{fields.map(renderControl)}</div>
          <div className="flex justify-end mt-md pt-sm border-t border-outline-variant">
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

      {resultText && (
        <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant tabular-nums" role="status" aria-live="polite">
          {resultText}
        </p>
      )}
    </div>
  );
};

export default AdminFilterPanel;
