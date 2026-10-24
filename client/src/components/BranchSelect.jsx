import { useCatalog } from '../stores/catalog';

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
      <div className="flex items-center gap-xs mb-xs">
        <button
          type="button"
          onClick={selectAll}
          className="min-h-[44px] min-w-[44px] px-2 rounded-full font-label-md text-label-md text-primary hover:bg-primary/5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          Select all
        </button>
        <span className="text-outline-variant" aria-hidden="true">|</span>
        <button
          type="button"
          onClick={clearAll}
          className="min-h-[44px] min-w-[44px] px-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
        {codes.map((branch) => (
          <label
            key={branch}
            className={`flex items-center gap-xs px-3 py-2 rounded-lg border cursor-pointer font-body-sm text-body-sm transition-colors
              ${
                selected.includes(branch)
                  ? 'bg-primary/5 border-primary/30 text-primary'
                  : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(branch)}
              onChange={() => toggle(branch)}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                ${
                  selected.includes(branch)
                    ? 'bg-primary-container border-primary-container'
                    : 'bg-surface-container-lowest border-outline-variant'
                }`}
            >
              {selected.includes(branch) && (
                <svg className="w-3 h-3 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {branchLabel(branch)}
          </label>
        ))}
      </div>
    </div>
  );
};

export default BranchSelect;
