import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { useCatalog } from '../stores/catalog';
import { deadlineInfo, formatDay } from '../utils/deadline';
import { getStartOfTodayIST } from '../utils/dates';

const ROWS = 5;

/**
 * The left half of the login and signup sheet: the upcoming drives as a plain ruled notice
 * (company, role, CTC, closing date), dated today, straight from the public drives list. Each row
 * links to its drive. Plain placeholder rows while the API wakes up; a short line if it can't be reached.
 */
const AuthNotice = () => {
  const { university } = useCatalog();
  const [state, setState] = useState({ loading: true, error: false, drives: [], total: 0 });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/placements', { params: { status: 'Upcoming', sort: 'closing_soon', limit: ROWS }, signal: controller.signal })
      .then((res) => setState({ loading: false, error: false, drives: res.data.data || [], total: res.data.pagination?.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setState({ loading: false, error: true, drives: [], total: 0 });
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="notice-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-sm gap-y-1 pb-xs border-b-2 border-on-surface">
        <div>
          {university && <p className="font-body-sm text-body-sm text-on-surface-variant">{university}</p>}
          <h2 id="notice-heading" className="font-headline-md text-headline-md text-on-surface">Upcoming drives</h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">As of {formatDay(new Date(getStartOfTodayIST()))}</p>
      </div>

      {state.error ? (
        <p className="py-md font-body-md text-body-md text-on-surface-variant">The drive list can&apos;t be loaded right now.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant">
              <th scope="col" className="py-xs pr-sm font-label-sm text-label-sm font-semibold text-on-surface-variant">Company</th>
              <th scope="col" className="py-xs pr-sm font-label-sm text-label-sm font-semibold text-on-surface-variant hidden sm:table-cell">Role</th>
              <th scope="col" className="py-xs pr-sm font-label-sm text-label-sm font-semibold text-on-surface-variant text-right">CTC (LPA)</th>
              <th scope="col" className="py-xs font-label-sm text-label-sm font-semibold text-on-surface-variant text-right">Closes</th>
            </tr>
          </thead>
          <tbody>
            {state.loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <tr key={i} className="border-b border-outline-variant/70" aria-hidden="true">
                    <td colSpan={4} className="py-sm">
                      <span className="block h-4 w-3/4 rounded-sm bg-surface-container-high animate-pulse" />
                    </td>
                  </tr>
                ))
              : state.drives.map((d) => {
                  const closing = deadlineInfo(d.deadline);
                  const urgent = closing?.tone === 'urgent';
                  return (
                    <tr key={d._id} className="border-b border-outline-variant/70 hover:bg-surface-container-low transition-colors">
                      <td className="py-sm pr-sm">
                        <Link
                          to={`/placement/${d._id}`}
                          className="font-label-md text-label-md text-on-surface hover:text-primary hover:underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {d.company}
                        </Link>
                        <span className="block sm:hidden font-body-sm text-body-sm text-on-surface-variant">{d.role}</span>
                      </td>
                      <td className="py-sm pr-sm font-body-md text-body-md text-on-surface-variant hidden sm:table-cell">{d.role}</td>
                      <td className="py-sm pr-sm font-body-md text-body-md text-on-surface text-right tabular-nums">{d.ctc ?? '—'}</td>
                      <td className="py-sm font-body-md text-body-md text-right tabular-nums whitespace-nowrap">
                        <span className={urgent ? 'text-error font-semibold' : 'text-on-surface'}>
                          {urgent ? (closing.days === 0 ? 'Today' : 'Tomorrow') : formatDay(d.deadline, { day: 'numeric', month: 'short' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      )}

      {!state.loading && !state.error && state.drives.length === 0 && (
        <p className="py-md font-body-md text-body-md text-on-surface-variant">No upcoming drives right now.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-sm pt-xs">
        <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
          {!state.loading && !state.error && `${state.total} upcoming`}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 min-h-[44px] font-label-md text-label-md text-primary hover:underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          See all drives
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </section>
  );
};

export default AuthNotice;
