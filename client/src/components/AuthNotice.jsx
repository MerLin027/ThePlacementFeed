import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { useCatalog } from '../stores/catalog';
import SheetHeading from './SheetHeading';
import CompanyMonogram from './CompanyMonogram';
import { PANEL_FOOTER, PANEL_SUBTITLE_LINES } from './authLayout';
import { TYPE_META } from '../constants/applications';
import { deadlineInfo, formatDay } from '../utils/deadline';
import { getStartOfTodayIST } from '../utils/dates';

// Rows on the notice: upcoming drives first, topped up with recently closed ones. Four full-size
// tickets fit beside the login form, so the two halves end at the same height.
const ROWS = 4;

// "Today" / "Tomorrow" (red) or "in 4 days" beside the closing date; nothing for later dates
const closingNote = (closing) => {
  if (!closing || closing.days < 0) return null;
  if (closing.days === 0) return { text: 'Today', urgent: true };
  if (closing.days === 1) return { text: 'Tomorrow', urgent: true };
  if (closing.days <= 7) return { text: `in ${closing.days} days`, urgent: false };
  return null;
};

const cancelled = (err) => err.name === 'CanceledError' || err.code === 'ERR_CANCELED';

/**
 * One drive as a small ticket: monogram, company (the link; the whole ticket is its click area),
 * role and type, CTC, and when applications close. Closed drives are quieter.
 */
const DriveRow = ({ drive, closed, index }) => {
  const note = closed ? null : closingNote(deadlineInfo(drive.deadline));
  const type = TYPE_META[drive.type]?.short;
  return (
    <li
      style={{ '--i': index }}
      className={`group/row relative flex items-center gap-sm rounded-2xl px-sm py-3 rise-in-stagger transition-[box-shadow,translate,background-color] duration-200 ease-out-soft focus-within:ring-2 focus-within:ring-primary ${
        closed
          ? 'bg-surface-container-lowest/55 ring-1 ring-outline-variant/40 hover:bg-surface-container-lowest'
          : 'bg-surface-container-lowest ring-1 ring-outline-variant/60 shadow-soft hover:shadow-lift hover:-translate-y-px'
      }`}
    >
      <CompanyMonogram name={drive.company} className={closed ? 'opacity-60 grayscale' : ''} />
      <div className="min-w-0 flex-1">
        <Link
          to={`/placement/${drive._id}`}
          className={`block truncate font-headline-sm text-[1.0625rem] leading-6 font-semibold after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-hidden group-hover/row:text-primary ${
            closed ? 'text-on-surface-variant' : 'text-on-surface'
          }`}
        >
          {drive.company}
        </Link>
        <p className="mt-0.5 truncate font-body-sm text-body-sm text-on-surface-variant">{[drive.role, type].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className={`font-headline-sm text-[1.0625rem] leading-6 font-semibold ${closed ? 'text-on-surface-variant' : 'text-on-surface'}`}>
          {drive.ctc != null ? (
            <>
              {drive.ctc} <span className="font-body-sm text-body-sm text-on-surface-variant">LPA</span>
            </>
          ) : (
            <span className="text-on-surface-variant">CTC —</span>
          )}
        </p>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
          {/* Phones: the date alone, so the company keeps its room (still read out) */}
          <span className="max-sm:sr-only">{closed ? 'Closed ' : 'Closes '}</span>
          {formatDay(drive.deadline, { day: 'numeric', month: 'short' })}
          {note && <span className={note.urgent ? 'font-semibold text-error' : ''}> · {note.text}</span>}
        </p>
      </div>
    </li>
  );
};

/**
 * The left half of the login card: upcoming drives, dated today, straight from the public drives
 * list (soonest deadline first), each linking to its drive. When fewer than five are coming up, the
 * most recent closed drives fill in, and if the list is still short a quiet note fills the rest of
 * the panel instead of blank space. Placeholder tickets while the API wakes up; a short line if it
 * can't be reached.
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
  const shown = upcoming.length + recent.length;
  const nothingAtAll = !loading && !error && shown === 0;

  return (
    <section className="relative flex flex-col flex-1" aria-labelledby="notice-heading">
      <SheetHeading
        id="notice-heading"
        title="Upcoming Drives"
        subtitle={`${university ? `${university} placements` : 'Campus placements'} · as of ${formatDay(new Date(getStartOfTodayIST()), { day: 'numeric', month: 'short' })}`}
        subtitleLines={PANEL_SUBTITLE_LINES}
      />

      <div className="mt-md flex-1 flex flex-col">
        {loading ? (
          <ul className="space-y-xs" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-sm rounded-xl bg-surface-container-lowest/70 ring-1 ring-outline-variant/40 px-sm py-2.5">
                <span className="skeleton w-10 h-10 rounded-xl" />
                <span className="flex-1">
                  <span className="skeleton h-4 w-1/2" />
                  <span className="skeleton mt-1.5 h-3 w-1/3" />
                </span>
                <span className="skeleton h-4 w-14" />
              </li>
            ))}
          </ul>
        ) : error || nothingAtAll ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-md">
            <span className="w-12 h-12 rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant/60 flex items-center justify-center text-primary" aria-hidden="true">
              <span className="material-symbols-outlined text-[24px]">{error ? 'cloud_off' : 'event_upcoming'}</span>
            </span>
            <p className="mt-sm max-w-[20rem] font-body-md text-body-md text-on-surface-variant">
              {error ? 'The drive list can’t be loaded right now.' : 'No drives yet. New ones appear here as soon as the CDPC posts them.'}
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <ul className="space-y-xs" aria-label="Upcoming drives">
                {upcoming.map((d, i) => <DriveRow key={d._id} drive={d} index={i} />)}
              </ul>
            ) : (
              <p className="rounded-xl bg-surface-container-lowest/70 ring-1 ring-outline-variant/40 px-sm py-sm font-body-md text-body-md text-on-surface-variant">
                Nothing coming up right now.
              </p>
            )}
            {recent.length > 0 && (
              <>
                <h3 className="mt-sm mb-xs flex items-center gap-xs font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                  Recently Closed
                  <span className="h-px flex-1 bg-outline-variant/70" aria-hidden="true" />
                </h3>
                <ul className="space-y-xs" aria-label="Recently closed drives">
                  {recent.map((d, i) => <DriveRow key={d._id} drive={d} index={upcoming.length + i} closed />)}
                </ul>
              </>
            )}
            {/* A short list leaves room: the free space becomes an open slot on the board, saying so,
                instead of blank panel (wide screens, where the panel is as tall as the form) */}
            {shown < ROWS && (
              <div className="hidden lg:flex flex-1 min-h-[5.5rem] mt-xs flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest/40 px-sm py-sm text-center">
                <span className="w-9 h-9 rounded-full bg-surface-container-lowest ring-1 ring-outline-variant/60 flex items-center justify-center text-primary" aria-hidden="true">
                  <span className="material-symbols-outlined text-[18px]">event_available</span>
                </span>
                <p className="mt-1 font-label-md text-label-md text-on-surface">That&apos;s everything for now</p>
                <p className="max-w-[18rem] font-body-sm text-body-sm text-on-surface-variant">
                  New drives appear here as soon as the CDPC posts them.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className={PANEL_FOOTER}>
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
