import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import PlacementCard from '../components/PlacementCard';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ColdStartLoader from '../components/ColdStartLoader';

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  branch: '',
  ctcMin: '',
  ctcMax: '',
  sort: 'newest',
};

const Home = () => {
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);
  const coldStartTimer = useRef(null);
  const abortControllerRef = useRef(null);

  const fetchPlacements = useCallback(async (page = 1) => {
    setLoading(true);
    setIsColdStart(false);

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Start cold-start timer
    coldStartTimer.current = setTimeout(() => {
      setIsColdStart(true);
    }, 3000);

    try {
      const params = { page, limit: 12 };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.branch) params.branch = filters.branch;
      if (filters.ctcMin) params.ctcMin = filters.ctcMin;
      if (filters.ctcMax) params.ctcMax = filters.ctcMax;
      if (filters.sort) params.sort = filters.sort;

      const res = await api.get('/api/placements', {
        params,
        signal: abortController.signal
      });
      setPlacements(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('Failed to fetch placements:', err);
    } finally {
      clearTimeout(coldStartTimer.current);
      if (abortControllerRef.current === abortController) {
        setLoading(false);
        setIsColdStart(false);
      }
    }
  }, [filters]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlacements(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPlacements]);

  const handlePageChange = (page) => {
    fetchPlacements(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg pt-md pb-xl md:pt-lg md:pb-xl">
      {/* Header & Subtitle */}
      <div className="mb-md md:mb-lg">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">Active Drives</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Track and apply to upcoming placement opportunities.
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Results summary */}
      {!loading && (
        <div className="flex items-center justify-between mb-md">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {pagination.total === 0
              ? 'No placements found'
              : `Showing ${placements.length} of ${pagination.total} placement${pagination.total !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <ColdStartLoader isColdStart={isColdStart} />
      ) : placements.length === 0 ? (
        <div className="text-center py-lg px-md bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-sm">
            <span className="material-symbols-outlined text-[32px] text-outline">search_off</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-xs">No placements found</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            We couldn&apos;t find anything matching your current filters.
          </p>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-md btn-secondary"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {placements.map((p) => (
              <PlacementCard key={p._id} placement={p} />
            ))}
          </div>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default Home;
