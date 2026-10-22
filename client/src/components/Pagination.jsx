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
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 mt-lg">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="w-[44px] h-[44px] flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant
                   hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
      </button>

      {getPageNumbers().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 py-2 font-body-sm text-body-sm text-outline">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            className={`w-[44px] h-[44px] flex items-center justify-center rounded-lg font-label-md text-label-md transition-colors
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
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="w-[44px] h-[44px] flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant
                   hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
      </button>
    </nav>
  );
};

export default Pagination;
