import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import ColdStartLoader from '../components/ColdStartLoader';

const Timeline = () => {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);
  const coldStartTimer = useRef(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchAll = async () => {
      coldStartTimer.current = setTimeout(() => setIsColdStart(true), 3000);

      try {
        const res = await api.get('/api/placements', {
          params: { limit: 500, sort: 'date_desc' },
          signal: abortController.signal
        });
        const placements = res.data.data;

        // Group by month/year
        const groups = {};
        placements.forEach((p) => {
          const date = p.driveDate ? new Date(p.driveDate) : new Date(p.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          if (!groups[key]) {
            groups[key] = { label, placements: [] };
          }
          groups[key].placements.push(p);
        });

        setGrouped(groups);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error('Failed to fetch placements:', err);
      } finally {
        clearTimeout(coldStartTimer.current);
        setLoading(false);
        setIsColdStart(false);
      }
    };
    fetchAll();
    return () => {
      clearTimeout(coldStartTimer.current);
      abortController.abort();
    };
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ColdStartLoader isColdStart={isColdStart} />
      </div>
    );
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Placement Timeline</h1>
        <p className="text-slate-500">Chronological view of all placement drives</p>
      </div>

      {sortedKeys.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No placements to display.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-slate-200" />

          {sortedKeys.map((key) => (
            <div key={key} className="mb-10">
              {/* Month header */}
              <div className="relative flex items-center gap-4 mb-6">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-brand-600 rounded-xl flex items-center justify-center z-10 flex-shrink-0">
                  <span className="text-white font-bold text-sm sm:text-base text-center leading-tight">
                    {grouped[key].label.split(' ')[0].slice(0, 3)}
                    <br />
                    <span className="text-xs opacity-80">{grouped[key].label.split(' ')[1]}</span>
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {grouped[key].label}
                </h2>
              </div>

              {/* Placement items */}
              <div className="space-y-3 ml-6 sm:ml-8 pl-8 sm:pl-10 border-l-0">
                {grouped[key].placements.map((p) => (
                  <Link
                    key={p._id}
                    to={`/placement/${p._id}`}
                    className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-slate-900">{p.company}</h3>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-sm text-slate-500">{p.role}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-slate-900">₹{p.ctc} LPA</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(p.driveDate)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timeline;
