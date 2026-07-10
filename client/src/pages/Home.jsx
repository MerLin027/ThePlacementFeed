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

  const fetchPlacements = useCallback(async (page = 1) => {
    setLoading(true);
    setIsColdStart(false);

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

      const res = await api.get('/api/placements', { params });
      setPlacements(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch placements:', err);
    } finally {
      clearTimeout(coldStartTimer.current);
      setLoading(false);
      setIsColdStart(false);
    }
  }, [filters]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
          CHARUSAT Placement Drives
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Browse the latest campus placement opportunities from CDPC. Filter by branch, status, CTC, and more.
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
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
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
        <div className="text-center py-16">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-600 mb-1">No placements found</h3>
          <p className="text-sm text-slate-400">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
