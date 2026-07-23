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
      <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-md">
        <ColdStartLoader isColdStart={isColdStart} />
      </div>
    );
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg pt-md pb-xl md:pt-lg md:pb-xl">
      <div className="text-center mb-lg">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-xs">Placement Timeline</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Chronological view of all placement drives</p>
      </div>

      {sortedKeys.length === 0 ? (
        <div className="text-center py-xl">
          <p className="font-body-md text-body-md text-on-surface-variant">No placements to display.</p>
        </div>
      ) : (
        <div className="relative max-w-4xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-outline-variant" />

          {sortedKeys.map((key) => (
            <div key={key} className="mb-lg">
              {/* Month header */}
              <div className="relative flex items-center gap-sm mb-md">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-primary-container rounded-xl flex items-center justify-center z-10 flex-shrink-0">
                  <span className="text-on-primary font-bold text-sm sm:text-base text-center leading-tight">
                    {grouped[key].label.split(' ')[0].slice(0, 3)}
                    <br />
                    <span className="text-xs opacity-80">{grouped[key].label.split(' ')[1]}</span>
                  </span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  {grouped[key].label}
                </h2>
              </div>

              {/* Placement items */}
              <div className="space-y-sm ml-6 sm:ml-8 pl-8 sm:pl-10 border-l-0">
                {grouped[key].placements.map((p) => (
                  <Link
                    key={p._id}
                    to={`/placement/${p._id}`}
                    className="block bg-surface-container-lowest rounded-xl border border-outline-variant p-md hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-xs flex-wrap mb-xs">
                          <h3 className="font-headline-sm text-headline-sm text-on-surface">{p.company}</h3>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{p.role}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-label-md text-label-md text-on-surface">₹{p.ctc} LPA</p>
                        <p className="font-label-sm text-label-sm text-outline mt-0.5">
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
