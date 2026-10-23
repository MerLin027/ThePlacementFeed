import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import ColdStartLoader from '../components/ColdStartLoader';
import EmptyState from '../components/EmptyState';
import { usePlacementsFetch } from '../hooks/usePlacementsFetch';
import { usePageTitle } from '../hooks/usePageTitle';
import { getStartOfTodayIST } from '../utils/dates';
import { formatDay } from '../utils/deadline';

const PAGE_LIMIT = 50; // server maximum per page
const MAX_PAGES = 20;

// Drive dates are stored as UTC midnight of the chosen day, so read them in UTC
const driveDay = (p) => new Date(p.driveDate || p.createdAt);
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const Timeline = () => {
  usePageTitle('Timeline');
  const [drives, setDrives] = useState([]);
  const { loading, isColdStart, fetchPlacements } = usePlacementsFetch();

  // The list endpoint caps pages at 50, so fetch every page (previously the
  // timeline silently showed only the 50 most recent drives).
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const first = await fetchPlacements({ limit: PAGE_LIMIT, sort: 'date_desc', page: 1 });
      if (!first?.data || cancelled) return;
      let all = first.data;
      const totalPages = Math.min(first.pagination.totalPages, MAX_PAGES);
      for (let page = 2; page <= totalPages && !cancelled; page++) {
        const res = await api.get('/api/placements', { params: { limit: PAGE_LIMIT, sort: 'date_desc', page } });
        all = all.concat(res.data.data);
      }
      if (!cancelled) setDrives(all);
    };
    fetchAll().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchPlacements]);

  if (loading) {
    return (
      <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-md">
        <ColdStartLoader isColdStart={isColdStart} variant="timeline" />
      </div>
    );
  }

  const today = getStartOfTodayIST();
  const thisMonth = monthKey(new Date(today));

  // Newest first, grouped by month
  const sorted = [...drives].sort((a, b) => driveDay(b) - driveDay(a));
  const groups = [];
  for (const p of sorted) {
    const key = monthKey(driveDay(p));
    if (groups.at(-1)?.key !== key) {
      const d = driveDay(p);
      groups.push({
        key,
        month: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
        year: d.getUTCFullYear(),
        label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        drives: [],
      });
    }
    groups.at(-1).drives.push(p);
  }
  // The "Today" divider goes before the first drive dated before today
  const firstPastId = sorted.find((p) => driveDay(p).getTime() < today)?._id;

  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      <div className="text-center mb-lg">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">Placement timeline</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Every drive by month, latest first.</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="calendar_month"
          title="No drives yet"
          description="Drives appear here by month once the CDPC posts them."
          className="max-w-(--container-xl) mx-auto"
        />
      ) : (
        <div className="relative max-w-4xl mx-auto">
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-outline-variant" aria-hidden="true" />

          {groups.map((g) => {
            const isPastMonth = g.key < thisMonth;
            return (
              <section key={g.key} className="mb-lg" aria-labelledby={`month-${g.key}`}>
                <div className="relative flex items-center gap-sm mb-md">
                  <div
                    className={`w-12 sm:w-16 h-12 sm:h-16 rounded-xl flex flex-col items-center justify-center z-10 shrink-0 leading-tight ${
                      isPastMonth ? 'bg-surface-container-high text-on-surface' : 'bg-primary-container text-on-primary'
                    }`}
                    aria-hidden="true"
                  >
                    <span className="font-bold text-sm sm:text-base">{g.month}</span>
                    <span className="text-xs">{g.year}</span>
                  </div>
                  <h2 id={`month-${g.key}`} className="font-headline-md text-headline-md text-on-surface">
                    {g.label}
                  </h2>
                  {g.key === thisMonth && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">This month</span>
                  )}
                </div>

                <ol className="space-y-sm ml-6 sm:ml-8 pl-8 sm:pl-10">
                  {g.drives.map((p) => {
                    const past = driveDay(p).getTime() < today;
                    return (
                      <Fragment key={p._id}>
                        {p._id === firstPastId && (
                          <li className="flex items-center gap-xs -ml-8 sm:-ml-10" aria-label="Today">
                            <span className="w-3 h-3 rounded-full bg-primary-container ring-4 ring-primary/15 ml-[-6px] z-10" aria-hidden="true" />
                            <span className="font-label-md text-label-md text-primary">
                              Today · {formatDay(new Date(today), { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="flex-1 h-px bg-primary/30" aria-hidden="true" />
                          </li>
                        )}
                        <li>
                          <Link
                            to={`/placement/${p._id}`}
                            className={`block rounded-xl border p-md transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                              past ? 'bg-surface-container-low border-outline-variant' : 'bg-surface-container-lowest border-outline-variant'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-sm">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-xs flex-wrap mb-xs">
                                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{p.company}</h3>
                                  <StatusBadge status={p.status} isPostponed={p.isPostponed} />
                                </div>
                                <p className="font-body-sm text-body-sm text-on-surface-variant">{p.role}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-label-md text-label-md text-on-surface tabular-nums">₹{p.ctc} LPA</p>
                                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 tabular-nums">
                                  {p.driveDate ? formatDay(p.driveDate, { day: 'numeric', month: 'short' }) : 'Date TBA'}
                                </p>
                              </div>
                            </div>
                          </Link>
                        </li>
                      </Fragment>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timeline;
