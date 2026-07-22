const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-lg">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant
                   hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
      </button>

      {getPageNumbers().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 py-2 font-body-sm text-body-sm text-outline">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md text-label-md transition-colors
              ${
                p === page
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant
                   hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
      </button>
    </div>
  );
};

export default Pagination;
