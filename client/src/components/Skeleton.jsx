// Layout-shaped loading placeholders. They stand in for content during the
// Render cold start (up to ~50 s), so the page keeps its shape instead of
// collapsing to a lone spinner. All are hidden from screen readers; the
// surrounding region announces "loading" once.

export const Skeleton = ({ className = '' }) => <span className={`skeleton ${className}`} aria-hidden="true" />;

export const DriveCardSkeleton = () => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-md flex flex-col gap-sm" aria-hidden="true">
    <div className="flex justify-between items-start">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <div className="space-y-xs pt-xs">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/5" />
    </div>
    <Skeleton className="h-[44px] w-full rounded-lg mt-xs" />
  </div>
);

export const DriveGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
    {Array.from({ length: count }, (_, i) => (
      <DriveCardSkeleton key={i} />
    ))}
  </div>
);

export const TimelineSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-sm" aria-hidden="true">
    <div className="flex items-center gap-sm">
      <Skeleton className="w-14 h-14 rounded-xl" />
      <Skeleton className="h-6 w-40" />
    </div>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="ml-16 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm flex justify-between gap-sm">
        <div className="flex-1 space-y-xs">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
    ))}
  </div>
);

export const DetailSkeleton = () => (
  <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-sm" role="status" aria-label="Loading drive details">
    <Skeleton className="h-4 w-28 mb-sm" />
    <div className="grid grid-cols-1 md:grid-cols-12 gap-sm items-start" aria-hidden="true">
      <div className="md:col-span-4 space-y-sm">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm space-y-xs">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-[44px] w-full rounded-lg" />
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm space-y-xs">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="md:col-span-8 space-y-sm">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm space-y-xs">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm space-y-xs">
          <Skeleton className="h-6 w-1/2" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Placeholder rows for admin tables while data loads
export const TableRowsSkeleton = ({ columns, rows = 5, label = 'Loading' }) => (
  <>
    <tr className="sr-only">
      <td colSpan={columns} role="status">{label}</td>
    </tr>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r} aria-hidden="true">
        {Array.from({ length: columns }, (_, c) => (
          <td key={c} className="px-sm py-sm">
            <Skeleton className={`h-4 ${c === 0 ? 'w-3/4' : 'w-1/2'}`} />
            {c === 0 && <Skeleton className="h-3 w-1/2 mt-1" />}
          </td>
        ))}
      </tr>
    ))}
  </>
);
