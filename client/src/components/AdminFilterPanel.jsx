import { useState, useId, useRef, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { dropDown } from '../utils/motion';
import PillSelect from './PillSelect';

/**
 * Search + filter panel + sort for the admin lists (Students, Applicants), as one toolbar row of
 * 44px pills: search (press "/" to jump to it), Filters (with the active count), Sort, and any page
 * actions (e.g. Export) at the end. Under it: the result count and a removable chip per active filter.
 * The panel drops down with the labelled controls, grouped when fields carry a `group`.
 *
 * fields: [{ key, label, type: 'select' | 'multi' | 'number' | 'date', group?, options?: [{ value, label }],
 *            placeholder?, min?, max?, step?, chip?: (value) => string }]
 * values / defaults: current and default value per key (arrays for 'multi')
 */
const isActive = (value, fallback) =>
  Array.isArray(value) ? value.length > 0 && value.join(',') !== (fallback || []).join(',') : value !== '' && value !== fallback;

const isTypingTarget = (el) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// The toolbar's buttons share the search pill's look: white, hairline border, soft shadow
const toolbarButton =
  'inline-flex items-center justify-center gap-1.5 h-[44px] min-w-[44px] px-4 rounded-full border font-label-md text-label-md whitespace-nowrap shadow-soft active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
export const toolbarButtonClass = `${toolbarButton} bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface`;

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
  actions,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const searchRef = useRef(null);

  // "/" focuses the search, as on the home page (not while typing or with a dialog open)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role=dialog], [role=alertdialog]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const optionLabel = (field, value) => field.options?.find((o) => o.value === value)?.label ?? value;
  const chipFor = (field) => {
    const value = values[field.key];
    if (field.chip) return field.chip(value);
    if (Array.isArray(value)) return `${field.label}: ${value.map((v) => optionLabel(field, v)).join(', ')}`;
    return `${field.label}: ${optionLabel(field, value)}`;
  };

  const chips = fields
    .filter((f) => isActive(values[f.key], defaults[f.key]))
    .map((f) => ({ key: f.key, label: chipFor(f), reset: defaults[f.key] }));
  const activeCount = chips.length;

  const toggleMulti = (key, value) => {
    const current = values[key] || [];
    onChange(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  // Fields in groups, in the order the groups first appear (one unnamed group when none is set)
  const groups = [];
  for (const field of fields) {
    const name = field.group || '';
    let group = groups.find((g) => g.name === name);
    if (!group) groups.push((group = { name, fields: [] }));
    group.fields.push(field);
  }

  const renderControl = (field) => {
    const id = fid(field.key);
    const value = values[field.key];
    if (field.type === 'multi') {
      // Nothing to choose from (e.g. no applicants yet): leave the group out
      if (field.options.length === 0) return null;
      return (
        <fieldset key={field.key} className="sm:col-span-2">
          <legend className="label">{field.label}</legend>
          <div className="flex flex-wrap gap-x-xs">
            {field.options.map((o) => {
              const on = value.includes(o.value);
              return (
                <label key={o.value} className="group/opt inline-flex items-center min-h-[44px] cursor-pointer">
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleMulti(field.key, o.value)} />
                  <span
                    className={`inline-flex items-center gap-1 h-9 px-3 rounded-full border font-label-md text-label-md transition-control group-active/opt:scale-[0.96] group-has-[:focus-visible]/opt:ring-2 group-has-[:focus-visible]/opt:ring-primary ${
                      on
                        ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-30'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline hover:text-on-surface'
                    }`}
                  >
                    {on && <span className="material-symbols-outlined text-[16px] animate-pop-in" aria-hidden="true">check</span>}
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
    <div className="w-full mb-xs">
      <div className="flex flex-col lg:flex-row lg:items-center gap-xs">
        <div
          role="search"
          className="group/search w-full lg:flex-1 flex items-center h-[44px] pl-4 rounded-full bg-surface-container-lowest border border-outline-variant shadow-soft hover:border-outline focus-within:border-primary focus-within:hover:border-primary focus-within:shadow-glow transition-control"
        >
          <span className="material-symbols-outlined shrink-0 text-outline text-[20px] group-focus-within/search:text-primary transition-colors duration-200" aria-hidden="true">
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
            className="flex-1 min-w-0 h-[44px] -my-px pl-2 bg-transparent font-body-md text-body-md text-on-surface placeholder-outline focus:outline-hidden [&::-webkit-search-cancel-button]:appearance-none"
          />
          {values.search ? (
            <button
              type="button"
              onClick={() => {
                onChange('search', '');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary transition-control animate-pop-in"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          ) : (
            <kbd
              className="hidden md:inline-flex shrink-0 items-center justify-center min-w-[24px] h-[24px] px-1.5 mr-2.5 rounded-md border border-outline-variant bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant group-focus-within/search:opacity-0 transition-opacity duration-150"
              aria-hidden="true"
            >
              /
            </kbd>
          )}
        </div>

        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={fid('panel')}
            className={`${toolbarButton} ${
              isExpanded || activeCount > 0
                ? 'bg-primary-fixed border-primary-30 text-on-primary-fixed-variant hover:bg-primary-fixed-dim'
                : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
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
          {sortOptions && (
            <PillSelect
              id={fid('sort')}
              label="Sort by"
              icon="swap_vert"
              size="md"
              value={values.sort}
              onChange={(e) => onChange('sort', e.target.value)}
              options={sortOptions}
              className="flex-1 min-w-0 lg:flex-none text-on-surface-variant"
            />
          )}
          {actions}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <m.div
            key="panel"
            id={fid('panel')}
            {...dropDown}
            className="mt-xs bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-lift overflow-hidden"
          >
            <div className="divide-y divide-outline-variant/70">
              {groups.map((group) => (
                <div key={group.name || 'all'} className="p-md">
                  {group.name && (
                    <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-xs">{group.name}</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-sm gap-y-xs">{group.fields.map(renderControl)}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-xs px-md py-xs bg-surface-container-low/60 border-t border-outline-variant/70">
              <button
                type="button"
                onClick={onReset}
                disabled={activeCount === 0}
                className="min-h-[44px] px-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="min-h-[44px] px-4 rounded-full font-label-md text-label-md bg-on-surface text-surface hover:bg-on-surface/85 active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Done
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {(resultText || chips.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 mt-xs min-h-[44px]">
          {resultText && (
            <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums mr-xs" role="status" aria-live="polite">
              {resultText}
            </p>
          )}
          {chips.length > 0 && (
            <div className="contents" aria-label="Active filters" role="group">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onChange(chip.key, chip.reset)}
                  className="group/chip inline-flex items-center min-h-[44px] rounded-full focus-visible:outline-hidden animate-pop-in"
                >
                  <span className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md group-hover/chip:bg-primary-fixed-dim group-active/chip:scale-[0.96] group-focus-visible/chip:ring-2 group-focus-visible/chip:ring-primary transition-control">
                    <span className="sr-only">Remove filter: </span>
                    {chip.label}
                    <span className="material-symbols-outlined text-[16px] transition-transform duration-200 group-hover/chip:rotate-90" aria-hidden="true">close</span>
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
        </div>
      )}
    </div>
  );
};

export default AdminFilterPanel;
