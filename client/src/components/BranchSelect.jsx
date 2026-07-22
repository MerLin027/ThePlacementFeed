const BRANCHES = [
  'CE', 'IT', 'CS', 'EC', 'EE', 'ME', 'CL', 'IC', 'BME', 'AI/ML', 'CSE', 'Other'
];

const BranchSelect = ({ selected = [], onChange }) => {
  const toggle = (branch) => {
    if (selected.includes(branch)) {
      onChange(selected.filter((b) => b !== branch));
    } else {
      onChange([...selected, branch]);
    }
  };

  const selectAll = () => onChange([...BRANCHES]);
  const clearAll = () => onChange([]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-xs mb-xs">
        <button
          type="button"
          onClick={selectAll}
          className="font-label-sm text-label-sm text-primary hover:text-primary-container"
        >
          Select All
        </button>
        <span className="text-outline-variant">|</span>
        <button
          type="button"
          onClick={clearAll}
          className="font-label-sm text-label-sm text-secondary hover:text-on-surface"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-xs">
        {BRANCHES.map((branch) => (
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
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
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
            {branch}
          </label>
        ))}
      </div>
    </div>
  );
};

export { BRANCHES };
export default BranchSelect;
