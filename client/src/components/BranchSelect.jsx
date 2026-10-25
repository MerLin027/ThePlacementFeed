import { useCatalog } from '../stores/catalog';

/**
 * Eligible branches for a drive, as toggle chips (each a real checkbox inside its label). None
 * selected means every branch can apply; the summary line says which applies.
 */
const BranchSelect = ({ selected = [], onChange }) => {
  const { activeBranches, branchLabel } = useCatalog();
  // Archived branches stay listed on a drive that already has them, so they can be unticked
  const codes = [...activeBranches.map((b) => b.code), ...selected.filter((c) => !activeBranches.some((b) => b.code === c))];
  const toggle = (branch) => {
    if (selected.includes(branch)) {
      onChange(selected.filter((b) => b !== branch));
    } else {
      onChange([...selected, branch]);
    }
  };

  const selectAll = () => onChange(activeBranches.map((b) => b.code));
  const clearAll = () => onChange([]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-x-sm mb-1">
        <p className="font-body-sm text-body-sm text-on-surface-variant" aria-live="polite">
          {selected.length === 0 ? 'None selected: every branch can apply' : `${selected.length} of ${codes.length} selected`}
        </p>
        <div className="flex items-center -mr-2">
          <button
            type="button"
            onClick={selectAll}
            className="min-h-[44px] min-w-[44px] px-2 rounded-full font-label-md text-label-md text-primary hover:bg-primary/5 active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selected.length === 0}
            className="min-h-[44px] min-w-[44px] px-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-xs">
        {codes.map((branch) => {
          const on = selected.includes(branch);
          return (
            <label key={branch} className="group/br inline-flex items-center min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={on} onChange={() => toggle(branch)} className="sr-only" />
              <span
                className={`inline-flex items-center gap-1 h-9 px-3 rounded-full border font-label-md text-label-md transition-control group-active/br:scale-[0.96] group-has-[:focus-visible]/br:ring-2 group-has-[:focus-visible]/br:ring-primary ${
                  on
                    ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-30'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline hover:text-on-surface'
                }`}
              >
                {on && <span className="material-symbols-outlined text-[16px] -ml-0.5 animate-pop-in" aria-hidden="true">check</span>}
                <span>{branchLabel(branch)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default BranchSelect;
