import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { TYPE_META } from '../constants/applications';
import ColdStartLoader from '../components/ColdStartLoader';
import EmptyState, { LoadError } from '../components/EmptyState';
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
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { loading, isColdStart, fetchPlacements } = usePlacementsFetch();

  // The list endpoint caps pages at 50, so fetch every page (previously the
  // timeline silently showed only the 50 most recent drives).
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const first = await fetchPlacements({ limit: PAGE_LIMIT, sort: 'date_desc', page: 1 });
      if (cancelled) return;
      if (first?.error) {
        setLoadError(true);
        return;
      }
      if (!first?.data) return;
      let all = first.data;
      const totalPages = Math.min(first.pagination.totalPages, MAX_PAGES);
      for (let page = 2; page <= totalPages && !cancelled; page++) {
        const res = await api.get('/api/placements', { params: { limit: PAGE_LIMIT, sort: 'date_desc', page } });
        all = all.concat(res.data.data);
      }
      if (!cancelled) {
        setLoadError(false);
        setDrives(all);
      }
    };
    // A later page failing also counts: a partial timeline would hide drives without saying so
    fetchAll().catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPlacements, reloadKey]);

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
      <div className="text-center mb-lg motion-safe:animate-rise-in">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">Placement timeline</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Every drive by month, latest first.</p>
      </div>

      {loadError ? (
        <LoadError onRetry={() => setReloadKey((k) => k + 1)} className="max-w-(--container-xl) mx-auto" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="calendar_month"
          title="No drives yet"
          description="Drives appear here by month once the CDPC posts them."
          className="max-w-(--container-xl) mx-auto"
        />
      ) : (
        <div className="relative max-w-4xl mx-auto">
          {/* The rail, centred on the month badges' centre line. Markers below use the same spacing units
              (not px), so they stay on it whatever the root font size. */}
          <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px -translate-x-1/2 bg-outline-variant" aria-hidden="true" />

          {groups.map((g) => {
            const isPastMonth = g.key < thisMonth;
            return (
              <section key={g.key} className="mb-lg" aria-labelledby={`month-${g.key}`}>
                <div className="relative flex items-center gap-sm mb-md">
                  <div
                    className={`w-12 sm:w-16 h-12 sm:h-16 rounded-2xl flex flex-col items-center justify-center z-10 shrink-0 leading-tight ${
                      isPastMonth ? 'bg-surface-container-high text-on-surface' : 'bg-primary-container text-on-primary shadow-lift'
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
                  {g.drives.map((p, i) => {
                    const past = driveDay(p).getTime() < today;
                    return (
                      <Fragment key={p._id}>
                        {p._id === firstPastId && (
                          <li className="flex items-center gap-xs -ml-8 sm:-ml-10" aria-label="Today">
                            <span className="w-3 h-3 rounded-full bg-primary-container ring-4 ring-primary/15 -ml-1.5 z-10" aria-hidden="true" />
                            <span className="font-label-md text-label-md text-primary">
                              Today · {formatDay(new Date(today), { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="flex-1 h-px bg-primary/30" aria-hidden="true" />
                          </li>
                        )}
                        <li className="group/item relative motion-safe:rise-in-stagger" style={{ '--i': i }}>
                          {/* Marker on the rail (back by the list's padding, then half its width); grows when its card is hovered */}
                          <span
                            className={`absolute top-1/2 -mt-1 -left-8 sm:-left-10 -ml-1 w-2 h-2 rounded-full ring-4 ring-background transition-transform duration-200 ease-snappy group-hover/item:[transform:scale(1.5)] ${
                              past ? 'bg-outline' : TYPE_META[p.type]?.bar || 'bg-primary-container'
                            }`}
                            aria-hidden="true"
                          />
                          <Link
                            to={`/placement/${p._id}`}
                            className={`block rounded-2xl border p-md transition-control group-hover/item:shadow-lift group-hover/item:border-primary-30 group-hover/item:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                              past ? 'bg-surface-container-low border-outline-variant' : 'bg-surface-container-lowest border-outline-variant shadow-soft'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-sm">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-xs flex-wrap mb-xs">
                                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{p.company}</h3>
                                  <StatusBadge status={p.status} isPostponed={p.isPostponed} />
                                </div>
                                <p className="flex flex-wrap items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">
                                  {p.role}
                                  {TYPE_META[p.type] && (
                                    <span className={`inline-flex items-center px-2 py-[1px] rounded-full font-label-sm text-label-sm ${TYPE_META[p.type].pill}`}>
                                      {TYPE_META[p.type].short}
                                    </span>
                                  )}
                                </p>
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
