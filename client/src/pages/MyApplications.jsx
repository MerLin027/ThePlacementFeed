import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import api from '../api/axios';
import { ApplicationStatusPill } from '../components/ApplyButton';
import CompanyMonogram from '../components/CompanyMonogram';
import { FormAlert } from '../components/AuthCard';
import Pagination from '../components/Pagination';
import { STATUS_META, TYPE_META } from '../constants/applications';
import { parseApiError } from '../utils/formErrors';
import { useCountUp } from '../hooks/useCountUp';
import { usePageTitle } from '../hooks/usePageTitle';
import { EASE_OUT_SOFT } from '../utils/motion';

const PAGE_SIZE = 20;

const TABS = [
  { key: 'all', label: 'All', dot: null, empty: 'No applications yet', hint: 'When you apply to a drive here, it shows up on this page with its latest status.' },
  { key: 'active', label: 'In progress', dot: STATUS_META.Shortlisted.dot, empty: 'Nothing in progress', hint: 'Applications waiting for a decision show up here.' },
  { key: 'selected', label: 'Selected', dot: STATUS_META.Offered.dot, empty: 'No selections yet', hint: 'Keep going: drives where you are selected show up here.' },
  { key: 'closed', label: 'Closed', dot: STATUS_META.Rejected.dot, empty: 'Nothing closed', hint: 'Applications that ended without a selection show up here.' },
];

// The pipeline a student moves through; Rejected ends it early
const STEPS = ['Applied', 'Shortlisted', 'Interviewing', 'Offered'];

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const daysAgo = (d) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

// A count that is also the filter for its group (a tab); the highlight slides to the chosen one
const FilterTile = ({ tab, count, selected, onSelect }) => {
  const shown = useCountUp(count);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`group/tile relative isolate text-left px-sm py-xs rounded-2xl border bg-surface-container-lowest shadow-soft active:scale-[0.98] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        selected ? 'border-primary-30' : 'border-outline-variant hover:border-outline hover:shadow-lift'
      }`}
    >
      {selected && (
        <m.span
          layoutId="apps-tile"
          className="absolute inset-0 -z-10 rounded-2xl bg-primary-fixed/60 ring-1 ring-primary/25"
          transition={{ type: 'spring', stiffness: 480, damping: 40 }}
          aria-hidden="true"
        />
      )}
      <span className={`flex items-center gap-1.5 font-label-md text-label-md ${selected ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'}`}>
        {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} aria-hidden="true" />}
        {tab.label}
      </span>
      <span className={`block mt-[2px] font-headline-md text-headline-md tabular-nums ${selected ? 'text-primary' : 'text-on-surface'}`}>{shown}</span>
    </button>
  );
};

// Applied → Shortlisted → Interviewing → Selected, filled up to the current step
const StatusStepper = ({ status }) => {
  const rejected = status === 'Rejected';
  const reached = rejected ? -1 : STEPS.indexOf(status);
  const fill = rejected ? 0 : Math.max(0, reached) / (STEPS.length - 1);
  const color = rejected ? STATUS_META.Rejected.color : STATUS_META[status]?.color || STATUS_META.Applied.color;
  return (
    <div className="mt-sm" aria-hidden="true">
      <div className="relative h-1.5 rounded-full bg-surface-container-high overflow-hidden">
        <m.div
          className="absolute inset-y-0 left-0 w-full rounded-full origin-left"
          style={{ background: color }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: rejected ? 1 : fill }}
          transition={{ duration: 0.6, ease: EASE_OUT_SOFT, delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between mt-1.5 font-label-sm text-label-sm">
        {STEPS.map((step, i) => {
          const done = !rejected && i <= reached;
          return (
            <span key={step} className={`inline-flex items-center gap-1 ${i === reached ? 'text-on-surface font-semibold' : done ? 'text-on-surface' : 'text-outline'}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: done ? color : 'var(--color-outline-variant)' }} />
              {STATUS_META[step].label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const CardSkeleton = () => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm space-y-xs" aria-hidden="true">
    <div className="flex items-center gap-sm">
      <span className="skeleton w-12 h-12 rounded-xl" />
      <div className="flex-1 space-y-1">
        <span className="skeleton h-4 w-1/3" />
        <span className="skeleton h-3 w-1/2" />
      </div>
    </div>
    <span className="skeleton h-1.5 w-full rounded-full" />
  </div>
);

// Every in-app application the student has made, newest first, with where each one stands
const MyApplications = () => {
  usePageTitle('My Applications');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'all';
  const [page, setPage] = useState(1);
  // A tab change goes back to page 1 (adjusted during render)
  const [pageTab, setPageTab] = useState(tab);
  if (pageTab !== tab) {
    setPageTab(tab);
    setPage(1);
  }

  // The last response, tagged with the request it answers: while it is for another request, that
  // one is still loading (derived, so the effect never has to reset state before fetching)
  const requestKey = `${tab}|${page}`;
  const [result, setResult] = useState({
    key: null, applications: [], pagination: { page: 1, totalPages: 0, total: 0 }, counts: null, error: '',
  });
  const loading = result.key !== requestKey;
  const { applications, pagination, counts } = result;
  const error = loading ? '' : result.error;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${tab}|${page}`;
    const params = { page, limit: PAGE_SIZE, ...(tab !== 'all' && { group: tab }) };
    api
      .get('/api/applications/my', { params, signal: controller.signal })
      .then((res) => {
        setResult({ key, applications: res.data.data, pagination: res.data.pagination, counts: res.data.counts, error: '' });
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        const message = parseApiError(err, "We couldn't load your applications.").message;
        setResult((prev) => ({ ...prev, key, error: message }));
      });
    return () => controller.abort();
  }, [tab, page]);

  const current = TABS.find((t) => t.key === tab);

  return (
    <div className="max-w-3xl mx-auto w-full px-sm md:px-lg py-sm md:py-lg">
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">My Applications</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Drives you applied to through The Placement Feed, and where each one stands.
        </p>
      </div>

      {/* The counts are the filter: one tile per group, the chosen one highlighted */}
      {counts && counts.all > 0 && (
        <div role="tablist" aria-label="Show applications" className="grid grid-cols-2 sm:grid-cols-4 gap-xs mb-md">
          {TABS.map((t) => (
            <FilterTile
              key={t.key}
              tab={t}
              count={counts[t.key] ?? 0}
              selected={t.key === tab}
              onSelect={() => setSearchParams(t.key === 'all' ? {} : { tab: t.key }, { replace: true })}
            />
          ))}
        </div>
      )}

      {error && <FormAlert>{error}</FormAlert>}

      {loading ? (
        <div className="space-y-xs" role="status" aria-label="Loading your applications">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : !error && applications.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft px-md py-lg text-center">
          <span className="material-symbols-outlined text-[40px] text-outline" aria-hidden="true">work_history</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mt-xs">{current.empty}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-base max-w-(--container-md) mx-auto">{current.hint}</p>
          <Link to="/" className="btn-primary mt-md min-h-[44px]">Browse drives</Link>
        </div>
      ) : (
        <ul className="space-y-xs" aria-label="Your applications">
          <AnimatePresence initial={false} mode="popLayout">
            {applications.map((a, i) => {
              const typeMeta = TYPE_META[a.type];
              return (
                <m.li
                  key={a.id}
                  layout="position"
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="group/row motion-safe:rise-in-stagger"
                  style={{ '--i': i }}
                >
                  {a.driveId ? (
                    <Link
                      to={`/placement/${a.driveId}`}
                      className="block bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm md:p-md group-hover/row:shadow-lift group-hover/row:border-primary-30 group-hover/row:-translate-y-0.5 transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-start gap-sm">
                        <CompanyMonogram name={a.company} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-xs gap-y-0.5">
                            <p className="font-headline-sm text-headline-sm text-on-surface truncate">{a.company}</p>
                            {typeMeta && (
                              <span className={`inline-flex items-center px-2 py-[1px] rounded-full font-label-sm text-label-sm ${typeMeta.pill}`}>{typeMeta.short}</span>
                            )}
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                            {a.role}
                            {a.ctc != null && <span className="text-on-surface font-label-md text-label-md"> · ₹{a.ctc} LPA</span>}
                          </p>
                        </div>
                        <ApplicationStatusPill status={a.status} />
                      </div>
                      <StatusStepper status={a.status} />
                      <div className="mt-sm pt-xs border-t border-outline-variant/60 flex flex-wrap items-center gap-x-md gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">event_available</span>
                          Applied {formatDate(a.submittedAt)}
                          {a.updatedAt && new Date(a.updatedAt) - new Date(a.submittedAt) > 60000 && <> · updated {daysAgo(a.updatedAt)}</>}
                        </span>
                        {a.isPostponed ? (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">pause_circle</span>
                            Drive postponed
                          </span>
                        ) : a.driveDate && (
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">event</span>
                            Drive {a.driveStatus === 'Completed' ? 'held' : 'on'} {formatDate(a.driveDate)}
                          </span>
                        )}
                        <span className="ml-auto material-symbols-outlined text-[18px] text-outline transition-transform duration-200 ease-out-soft group-hover/row:translate-x-1 group-hover/row:text-primary" aria-hidden="true">
                          arrow_forward
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-sm bg-surface-container-low border border-outline-variant rounded-2xl p-sm">
                      <p className="flex-1 font-body-sm text-body-sm text-on-surface-variant">This drive was removed.</p>
                      <ApplicationStatusPill status={a.status} />
                    </div>
                  )}
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
    </div>
  );
};

export default MyApplications;
