import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { useCatalog } from '../stores/catalog';
import SheetHeading from './SheetHeading';
import { TYPE_META } from '../constants/applications';
import { deadlineInfo, formatDay } from '../utils/deadline';
import { getStartOfTodayIST } from '../utils/dates';

const ROWS = 5;

// "Today" / "Tomorrow" (red) or "in 4 days" under the closing date; nothing for later dates
const closingNote = (closing) => {
  if (!closing || closing.days < 0) return null;
  if (closing.days === 0) return { text: 'Today', urgent: true };
  if (closing.days === 1) return { text: 'Tomorrow', urgent: true };
  if (closing.days <= 7) return { text: `in ${closing.days} days`, urgent: false };
  return null;
};

/**
 * The left half of the login sheet: upcoming drives as a plain ruled notice, dated today, straight
 * from the public drives list (soonest deadline first). Each company links to its drive. Placeholder
 * rows while the API wakes up; a short line if it can't be reached or there is nothing coming up.
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

  const empty = !state.loading && !state.error && state.drives.length === 0;

  return (
    <section className="flex flex-col flex-1" aria-labelledby="notice-heading">
      <SheetHeading
        id="notice-heading"
        kicker={university || 'Campus placements'}
        title="Upcoming drives"
        aside={
          <p className="shrink-0 font-body-sm text-body-sm text-on-surface-variant tabular-nums">
            As of {formatDay(new Date(getStartOfTodayIST()))}
          </p>
        }
      />

      {state.error || empty ? (
        <p className="py-md font-body-md text-body-md text-on-surface-variant">
          {state.error ? 'The drive list can’t be loaded right now.' : 'No upcoming drives right now. New ones appear here as soon as the CDPC posts them.'}
        </p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant">
              <th scope="col" className="py-2 pr-sm font-label-sm text-label-sm font-semibold text-on-surface-variant">Drive</th>
              <th scope="col" className="py-2 pr-sm font-label-sm text-label-sm font-semibold text-on-surface-variant text-right whitespace-nowrap">CTC (LPA)</th>
              <th scope="col" className="py-2 font-label-sm text-label-sm font-semibold text-on-surface-variant text-right">Closes</th>
            </tr>
          </thead>
          <tbody>
            {state.loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <tr key={i} className="border-b border-outline-variant/70" aria-hidden="true">
                    <td colSpan={3} className="py-sm">
                      <span className="block h-4 w-2/3 rounded-sm bg-surface-container-high animate-pulse" />
                      <span className="block mt-1.5 h-3 w-1/3 rounded-sm bg-surface-container animate-pulse" />
                    </td>
                  </tr>
                ))
              : state.drives.map((d) => {
                  const note = closingNote(deadlineInfo(d.deadline));
                  const type = TYPE_META[d.type]?.short;
                  return (
                    <tr key={d._id} className="group/row border-b border-outline-variant/70 last:border-b-0 hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 pr-sm">
                        <Link
                          to={`/placement/${d._id}`}
                          className="font-label-md text-label-md text-on-surface group-hover/row:text-primary hover:underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {d.company}
                        </Link>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant">
                          {[d.role, type].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-sm font-body-md text-body-md text-on-surface text-right tabular-nums align-top">{d.ctc ?? '—'}</td>
                      <td className="py-2.5 text-right tabular-nums whitespace-nowrap align-top">
                        <span className="block font-body-md text-body-md text-on-surface">{formatDay(d.deadline, { day: 'numeric', month: 'short' })}</span>
                        {note && (
                          <span className={`block font-body-sm text-body-sm ${note.urgent ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>{note.text}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-sm pt-sm border-t border-outline-variant">
        <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
          {!state.loading && !state.error && (state.total > state.drives.length ? `${state.drives.length} of ${state.total} upcoming` : `${state.total} upcoming`)}
        </p>
        <Link
          to="/"
          className="group/all inline-flex items-center gap-1 min-h-[44px] font-label-md text-label-md text-primary hover:underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          See all drives
          <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-out-soft group-hover/all:translate-x-0.5" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </section>
  );
};

export default AuthNotice;
