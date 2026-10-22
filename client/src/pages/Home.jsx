import { useState, useEffect, useCallback } from 'react';
import PlacementCard from '../components/PlacementCard';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ColdStartLoader from '../components/ColdStartLoader';
import { usePlacementsFetch } from '../hooks/usePlacementsFetch';
import EmptyState from '../components/EmptyState';
import { usePageTitle } from '../hooks/usePageTitle';

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  branch: '',
  ctcMin: '',
  ctcMax: '',
  sort: 'newest',
};

const Home = () => {
  usePageTitle('Drives');
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { loading, isColdStart, fetchPlacements } = usePlacementsFetch();

  const loadPlacements = useCallback(async (page = 1) => {
    const params = { page, limit: 12 };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.branch) params.branch = filters.branch;
    if (filters.ctcMin) params.ctcMin = filters.ctcMin;
    if (filters.ctcMax) params.ctcMax = filters.ctcMax;
    if (filters.sort) params.sort = filters.sort;

    const res = await fetchPlacements(params);
    if (res && res.data) {
      setPlacements(res.data);
      setPagination(res.pagination);
    }
  }, [filters, fetchPlacements]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPlacements(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadPlacements]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadPlacements(newPage);
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg pt-md pb-xl md:pt-lg md:pb-xl">
      {/* Header & Subtitle */}
      <div className="mb-md md:mb-lg">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">Active drives</h1>
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
              ? 'No drives found'
              : `Showing ${placements.length} of ${pagination.total} placement${pagination.total !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <ColdStartLoader isColdStart={isColdStart} />
      ) : placements.length === 0 ? (
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
