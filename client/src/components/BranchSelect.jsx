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
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={selectAll}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          Select All
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {BRANCHES.map((branch) => (
          <label
            key={branch}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors
              ${
                selected.includes(branch)
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
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
                    ? 'bg-brand-600 border-brand-600'
                    : 'bg-white border-slate-300'
                }`}
            >
              {selected.includes(branch) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
