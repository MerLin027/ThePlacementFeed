import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { useCatalog } from '../stores/catalog';
import { deadlineInfo } from '../utils/deadline';

const formatCtc = (ctc) => (ctc ? `₹${ctc} LPA` : null);

/**
 * The navy side panel on the login and signup pages: how many drives are coming up and the three
 * that close soonest, straight from the public drives list (links to each drive). While the API is
 * waking up it shows placeholders; if it can't be reached it falls back to a plain line.
 */
const AuthDrivesPanel = () => {
  const { university } = useCatalog();
  const [state, setState] = useState({ loading: true, error: false, drives: [], total: 0 });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/placements', { params: { status: 'Upcoming', sort: 'closing_soon', limit: 3 }, signal: controller.signal })
      .then((res) => setState({ loading: false, error: false, drives: res.data.data || [], total: res.data.pagination?.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setState({ loading: false, error: true, drives: [], total: 0 });
      });
    return () => controller.abort();
  }, []);

  return (
    <aside
      className="relative isolate h-full flex flex-col overflow-hidden rounded-3xl bg-brand-navy text-white p-md md:p-lg shadow-lift motion-safe:animate-rise-in"
      aria-label="Upcoming drives"
    >
      {/* A faint dot grid and one soft glow, echoing the page background */}
      <div
        className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgb(255_255_255/0.09)_1px,transparent_1px)] [background-size:18px_18px]"
        aria-hidden="true"
      />
      <div className="absolute -top-24 -right-24 -z-10 w-72 h-72 rounded-full bg-brand-blue/40 blur-3xl" aria-hidden="true" />

      <p className="font-label-sm text-label-sm uppercase tracking-wider text-white/60">{university || 'Campus placements'}</p>

      {state.loading ? (
        <div className="mt-sm space-y-xs" role="status" aria-label="Loading drives">
          <span className="block h-12 w-40 rounded-xl bg-white/10 animate-pulse" />
          <span className="block h-4 w-56 rounded bg-white/10 animate-pulse" />
        </div>
      ) : state.error ? (
        <p className="mt-sm font-headline-md text-headline-md text-white">Every drive the CDPC posts, in one place.</p>
      ) : (
        <p className="mt-sm leading-tight">
          <span className="block font-display-lg text-[3.5rem] font-bold tracking-tight tabular-nums">{state.total}</span>
          <span className="font-headline-sm text-headline-sm text-white/85">
            upcoming drive{state.total === 1 ? '' : 's'}
          </span>
        </p>
      )}

      {state.drives.length > 0 && (
        <div className="mt-md">
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-white/60 mb-1">Closing soonest</p>
          <ul className="-mx-2">
            {state.drives.map((d) => {
              const closing = deadlineInfo(d.deadline);
              return (
                <li key={d._id}>
                  <Link
                    to={`/placement/${d._id}`}
                    className="group/d flex items-center justify-between gap-sm min-h-[52px] px-2 rounded-xl hover:bg-white/8 active:scale-[0.99] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <span className="min-w-0">
                      <span className="block font-label-md text-label-md truncate">{d.company}</span>
                      <span className="block font-body-sm text-body-sm text-white/65 truncate">
                        {[d.role, formatCtc(d.ctc)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {closing && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full font-label-sm text-label-sm ${
                          closing.tone === 'urgent' ? 'bg-red-400/20 text-red-100' : 'bg-white/10 text-white/80'
                        }`}
                      >
                        {closing.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Link
        to="/"
        className="group/all mt-auto pt-sm self-start inline-flex items-center gap-1 min-h-[44px] font-label-md text-label-md text-white/80 hover:text-white rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Browse all drives
        <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-out-soft group-hover/all:translate-x-0.5" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </aside>
  );
};

export default AuthDrivesPanel;
