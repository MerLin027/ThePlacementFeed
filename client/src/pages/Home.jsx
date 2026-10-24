import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import PlacementCard from '../components/PlacementCard';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ColdStartLoader from '../components/ColdStartLoader';
import EmptyState, { LoadError } from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { usePlacementsFetch } from '../hooks/usePlacementsFetch';
import { usePageTitle } from '../hooks/usePageTitle';

const DEFAULT_SORT = 'closing_soon';

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  branch: '',
  ctcMin: '',
  ctcMax: '',
  sort: DEFAULT_SORT,
};

const PAGE_SIZE = 12;
const PAST_PAGE_SIZE = 6;

const HEADINGS = {
  '': { title: 'Active drives', subtitle: 'Open drives first, sorted by the closest deadline.' },
  Upcoming: { title: 'Upcoming drives', subtitle: 'Drives that are still taking applications or yet to open.' },
  Ongoing: { title: 'Ongoing drives', subtitle: 'Applications have closed; these drives are in progress.' },
  Completed: { title: 'Past drives', subtitle: 'Drives that have already taken place.' },
};

// Filters shared by the main list and the past-drives section (status/sort handled per list)
const baseParams = (filters) => {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.branch) params.branch = filters.branch;
  if (filters.ctcMin) params.ctcMin = filters.ctcMin;
  if (filters.ctcMax) params.ctcMax = filters.ctcMax;
  return params;
};

// Cards rise in with a short stagger; `from` keeps a "show more" batch from waiting on earlier cards
const DriveGrid = ({ drives, from = 0 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
    {drives.map((p, i) => (
      <PlacementCard key={p._id} placement={p} index={Math.max(0, i - from)} />
    ))}
  </div>
);

const Home = () => {
  usePageTitle('Drives');
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { loading, isColdStart, fetchPlacements } = usePlacementsFetch();
  const [loadError, setLoadError] = useState(false);

  // With no status filter, open drives come first and completed ones live in their own section
  const splitView = !filters.status;
  const [past, setPast] = useState({ items: [], total: 0, page: 0, totalPages: 0, loading: false });
  const [pastOpen, setPastOpen] = useState(false);

  const loadPlacements = useCallback(async (page = 1) => {
    const params = {
      ...baseParams(filters),
      page,
      limit: PAGE_SIZE,
      sort: filters.sort || DEFAULT_SORT,
      status: filters.status || 'Upcoming,Ongoing',
    };
    const res = await fetchPlacements(params);
    if (res?.error) setLoadError(true);
    if (res && res.data) {
      setLoadError(false);
      setPlacements(res.data);
      setPagination(res.pagination);
    }
  }, [filters, fetchPlacements]);

  useEffect(() => {
    const timer = setTimeout(() => loadPlacements(1), 300);
    return () => clearTimeout(timer);
  }, [loadPlacements]);

  // Past drives: first page loads with the filters (for the count), more on demand
  const loadPast = useCallback(async (page, signal) => {
    const sort = !filters.sort || filters.sort === DEFAULT_SORT ? 'date_desc' : filters.sort;
    setPast((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.get('/api/placements', {
        params: { ...baseParams(filters), status: 'Completed', sort, page, limit: PAST_PAGE_SIZE },
        signal,
      });
      setPast((prev) => ({
        items: page === 1 ? res.data.data : [...prev.items, ...res.data.data],
        total: res.data.pagination.total,
        page,
        totalPages: res.data.pagination.totalPages,
        loading: false,
      }));
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setPast((prev) => ({ ...prev, loading: false }));
    }
  }, [filters]);

  useEffect(() => {
    if (!splitView) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => loadPast(1, controller.signal), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [splitView, loadPast]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadPlacements(newPage);
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filtersActive = Boolean(filters.search || filters.branch || filters.ctcMin || filters.ctcMax);
  const heading = HEADINGS[filters.status] || HEADINGS[''];
  const noun = (n) => `drive${n === 1 ? '' : 's'}`;

  return (
    <div className="relative isolate w-full max-w-container-max mx-auto px-sm md:px-lg pt-md pb-xl md:pt-lg md:pb-xl">
      <div className="absolute inset-x-0 top-0 h-80 -z-10 hero-wash pointer-events-none" aria-hidden="true" />
      <div className="mb-md md:mb-lg md:text-center motion-safe:animate-rise-in">
        <p className="inline-flex items-center gap-xs mb-sm px-3 py-1 rounded-full border border-outline-variant bg-surface-container-lowest shadow-soft font-label-sm text-label-sm text-on-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
          CHARUSAT CDPC placement drives
        </p>
        <h1 className="font-display-lg text-display-lg md:text-[2.75rem] md:leading-[3.25rem] text-on-surface mb-xs">{heading.title}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-(--container-xl) md:mx-auto">{heading.subtitle}</p>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {!loading && !loadError && (
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-sm tabular-nums" role="status" aria-live="polite">
          {pagination.total === 0
            ? `No ${splitView ? 'open ' : ''}drives found`
            : `Showing ${placements.length} of ${pagination.total} ${splitView ? 'open ' : ''}${noun(pagination.total)}`}
        </p>
      )}

      {loading ? (
        <ColdStartLoader isColdStart={isColdStart} />
      ) : loadError ? (
        <LoadError onRetry={() => loadPlacements(pagination.page || 1)} />
      ) : placements.length === 0 ? (
        filtersActive || !splitView ? (
          <EmptyState
            icon="search_off"
            title="No drives match your filters"
            description="Try a different search or clear the filters to see every drive."
            action={
              <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="btn-secondary">
                Clear all filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="event_upcoming"
            title="No open drives right now"
            description="New drives show up here as soon as the CDPC posts them. Turn on the bell to hear about them first."
          />
        )
      ) : (
        <>
          {/* Keeps the outline h1 → h2 → card h3 (cards are h3 so past drives can share them) */}
          <h2 className="sr-only">{splitView ? 'Open drives' : heading.title}</h2>
          <DriveGrid drives={placements} />
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
        </>
      )}

      {splitView && !loading && !loadError && past.total > 0 && (
        <section className="mt-xl" aria-labelledby="past-drives-heading">
          <h2 id="past-drives-heading" className="sr-only">Past drives</h2>
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            aria-expanded={pastOpen}
            aria-controls="past-drives"
            className="w-full flex items-center justify-between gap-sm min-h-[56px] px-md rounded-2xl border border-outline-variant bg-surface-container-low hover:bg-surface-container-lowest hover:shadow-soft text-on-surface transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center gap-xs font-headline-sm text-headline-sm">
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">history</span>
              Past drives
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">({past.total})</span>
            </span>
            <span
              className={`material-symbols-outlined text-[24px] text-on-surface-variant transition-transform duration-200 ${pastOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>

          {pastOpen && (
            <div id="past-drives" className="mt-md">
              <DriveGrid drives={past.items} from={(past.page - 1) * PAST_PAGE_SIZE} />
              {past.page < past.totalPages && (
                <div className="flex justify-center mt-md">
                  <button
                    type="button"
                    onClick={() => loadPast(past.page + 1)}
                    disabled={past.loading}
                    aria-busy={past.loading}
                    className="btn-secondary gap-xs"
                  >
                    {past.loading && <Spinner size="sm" />}
                    Show more past drives
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Home;
