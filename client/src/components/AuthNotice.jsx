import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { useCatalog } from '../stores/catalog';
import SheetHeading from './SheetHeading';
import { TYPE_META } from '../constants/applications';
import { deadlineInfo, formatDay } from '../utils/deadline';
import { getStartOfTodayIST } from '../utils/dates';

// Rows on the notice: upcoming drives first, topped up with recently closed ones
const ROWS = 6;

// "Today" / "Tomorrow" (red) or "in 4 days" under the closing date; nothing for later dates
const closingNote = (closing) => {
  if (!closing || closing.days < 0) return null;
  if (closing.days === 0) return { text: 'Today', urgent: true };
  if (closing.days === 1) return { text: 'Tomorrow', urgent: true };
  if (closing.days <= 7) return { text: `in ${closing.days} days`, urgent: false };
  return null;
};

const cancelled = (err) => err.name === 'CanceledError' || err.code === 'ERR_CANCELED';

const DriveRow = ({ drive, closed }) => {
  const note = closed ? { text: 'Closed', urgent: false } : closingNote(deadlineInfo(drive.deadline));
  const type = TYPE_META[drive.type]?.short;
  return (
    <tr className={`group/row border-b border-outline-variant/70 hover:bg-surface-container-low transition-colors ${closed ? 'text-on-surface-variant' : ''}`}>
      <td className="py-2.5 pr-sm">
        <Link
          to={`/placement/${drive._id}`}
          className={`font-label-md text-label-md group-hover/row:text-primary hover:underline underline-offset-2 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
            closed ? 'text-on-surface-variant' : 'text-on-surface'
          }`}
        >
          {drive.company}
        </Link>
        <span className="block font-body-sm text-body-sm text-on-surface-variant">{[drive.role, type].filter(Boolean).join(' · ')}</span>
      </td>
      <td className={`py-2.5 pr-sm font-body-md text-body-md text-right tabular-nums align-top ${closed ? '' : 'text-on-surface'}`}>{drive.ctc ?? '—'}</td>
      <td className="py-2.5 text-right tabular-nums whitespace-nowrap align-top">
        <span className={`block font-body-md text-body-md ${closed ? '' : 'text-on-surface'}`}>{formatDay(drive.deadline, { day: 'numeric', month: 'short' })}</span>
        {note && (
          <span className={`block font-body-sm text-body-sm ${note.urgent ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>{note.text}</span>
        )}
      </td>
    </tr>
  );
};

/**
 * The left half of the login sheet: upcoming drives as a plain ruled notice, dated today, straight
 * from the public drives list (soonest deadline first), each company linking to its drive. When fewer
 * than six are coming up, the rest of the notice lists the most recent drives whose applications have
 * closed, so the half never stands mostly empty next to the form. Placeholder rows while the API
 * wakes up; a short line if it can't be reached.
 */
const AuthNotice = () => {
  const { university } = useCatalog();
  const [state, setState] = useState({ loading: true, error: false, upcoming: [], total: 0, recent: [] });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api
      .get('/api/drives', { params: { status: 'Upcoming', sort: 'closing_soon', limit: ROWS }, signal })
      .then(async (res) => {
        const upcoming = res.data.data || [];
        const total = res.data.pagination?.total ?? 0;
        let recent = [];
        if (upcoming.length < ROWS) {
          try {
            const past = await api.get('/api/drives', {
              params: { status: 'Ongoing,Completed', sort: 'date_desc', limit: ROWS - upcoming.length },
              signal,
            });
            recent = past.data.data || [];
          } catch (err) {
            if (cancelled(err)) return;
            // The upcoming list still stands on its own
          }
        }
        setState({ loading: false, error: false, upcoming, total, recent });
      })
      .catch((err) => {
        if (cancelled(err)) return;
        setState({ loading: false, error: true, upcoming: [], total: 0, recent: [] });
      });
    return () => controller.abort();
  }, []);

  const { loading, error, upcoming, total, recent } = state;
  const nothingAtAll = !loading && !error && upcoming.length === 0 && recent.length === 0;

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

      {error || nothingAtAll ? (
        <p className="py-md font-body-md text-body-md text-on-surface-variant">
          {error ? 'The drive list can’t be loaded right now.' : 'No drives yet. New ones appear here as soon as the CDPC posts them.'}
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
          {loading ? (
            <tbody>
              {Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-b border-outline-variant/70" aria-hidden="true">
                  <td colSpan={3} className="py-sm">
                    <span className="block h-4 w-2/3 rounded-sm bg-surface-container-high animate-pulse" />
                    <span className="block mt-1.5 h-3 w-1/3 rounded-sm bg-surface-container animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <>
              <tbody>
                {upcoming.length === 0 && (
                  <tr className="border-b border-outline-variant/70">
                    <td colSpan={3} className="py-sm font-body-md text-body-md text-on-surface-variant">Nothing coming up right now.</td>
                  </tr>
                )}
                {upcoming.map((d) => <DriveRow key={d._id} drive={d} />)}
              </tbody>
              {recent.length > 0 && (
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={3} className="pt-sm pb-1 text-left font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">
                      Recently closed
                    </th>
                  </tr>
                  {recent.map((d) => <DriveRow key={d._id} drive={d} closed />)}
                </tbody>
              )}
            </>
          )}
        </table>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-sm pt-sm">
        <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
          {!loading && !error && (total > upcoming.length ? `${upcoming.length} of ${total} upcoming` : `${total} upcoming`)}
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
