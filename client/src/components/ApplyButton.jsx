import { useNavigate } from 'react-router';
import { STATUS_META } from '../constants/applications';
import { useApplyState } from '../hooks/useApplyState';

const BASE = 'w-full min-h-[44px] py-3 justify-center';

// Card footer actions: lighter than form buttons. One filled action (Apply now), a soft tint for
// "log in / complete profile first", and plain rows for states that are not actions.
const CARD_ACTION =
  'group/cta relative z-10 inline-flex w-full items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl font-label-md text-label-md active:scale-[0.98] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const CARD_PRIMARY = `${CARD_ACTION} bg-primary-container text-on-primary shadow-soft hover:bg-primary hover:shadow-lift`;
const CARD_SOFT = `${CARD_ACTION} bg-primary-fixed/60 text-on-primary-fixed-variant hover:bg-primary-fixed`;
const CARD_ROW = 'flex items-center w-full min-h-[44px] font-label-md text-label-md';

const Arrow = () => (
  <span className="material-symbols-outlined text-[18px] -mr-1 transition-transform duration-200 ease-out-soft group-hover/cta:translate-x-0.5" aria-hidden="true">
    arrow_forward
  </span>
);


// Status pill: one colour and icon per pipeline status (constants/applications.js)
export const ApplicationStatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.Applied;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm ${meta.pill}`}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
};

/**
 * Apply control for a drive card. The card itself is a link to the detail page,
 * so every action here stops that navigation and decides its own target;
 * the in-app form only ever opens on the detail page.
 */
export const CardApplyButton = ({ drive }) => {
  const navigate = useNavigate();
  const state = useApplyState(drive);
  const detailPath = `/placement/${drive._id}`;

  const go = (path) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(path);
  };

  switch (state.kind) {
    case 'external':
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(drive.formUrl, '_blank', 'noopener,noreferrer');
          }}
          className={CARD_PRIMARY}
        >
          Apply now
          <span className="material-symbols-outlined text-[16px] -mr-1" aria-hidden="true">open_in_new</span>
        </button>
      );
    case 'apply':
      return (
        <button type="button" onClick={go(`${detailPath}?apply=1`)} className={CARD_PRIMARY}>
          Apply now
          <Arrow />
        </button>
      );
    case 'login':
      return (
        <button
          type="button"
          onClick={go(`/login?returnTo=${encodeURIComponent(`${detailPath}?apply=1`)}`)}
          className={CARD_SOFT}
        >
          Log in to apply
          <Arrow />
        </button>
      );
    case 'completeProfile':
      return (
        <button
          type="button"
          onClick={go(`/profile?returnTo=${encodeURIComponent(`${detailPath}?apply=1`)}`)}
          className={CARD_SOFT}
        >
          Complete profile to apply
          <Arrow />
        </button>
      );
    case 'applied':
      return (
        <div className={`${CARD_ROW} justify-between gap-xs text-on-surface-variant`}>
          You&apos;ve applied
          <ApplicationStatusPill status={state.status} />
        </div>
      );
    case 'blocked':
      return (
        <div
          className={`${CARD_ROW} justify-center gap-1.5 rounded-xl ${
            drive.isPostponed ? 'bg-red-50 text-red-700' : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{drive.isPostponed ? 'pause_circle' : 'block'}</span>
          {state.label}
        </div>
      );
    default:
      return (
        // The whole card is the link; this row just says so
        <div
          className={`${CARD_ROW} justify-between px-1 ${
            drive.isPostponed ? 'text-red-700' : drive.status === 'Completed' ? 'text-on-surface-variant' : 'text-primary'
          }`}
        >
          View details
          <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-out-soft group-hover/card:translate-x-1" aria-hidden="true">
            arrow_forward
          </span>
        </div>
      );
  }
};

/**
 * Apply control for the drive detail page. `onApply` opens the in-app form.
 * Reasons for a blocked state are always shown as text, not just a tooltip.
 */
export const DetailApplyPanel = ({ drive, onApply }) => {
  const navigate = useNavigate();
  const state = useApplyState(drive);
  const returnTo = encodeURIComponent(`/placement/${drive._id}?apply=1`);
  // The external alternative is only offered while applying is actually open
  const showExternalAlt =
    drive.applicationMode === 'both' && drive.formUrl && ['apply', 'login', 'completeProfile'].includes(state.kind);

  let primary = null;
  switch (state.kind) {
    case 'external':
      primary = (
        <a href={drive.formUrl} target="_blank" rel="noopener noreferrer" className={`btn-primary ${BASE}`}>
          Apply now
        </a>
      );
      break;
    case 'apply':
      primary = (
        <button type="button" onClick={onApply} className={`btn-primary ${BASE}`}>
          Apply now
        </button>
      );
      break;
    case 'login':
      primary = (
        <>
          <button type="button" onClick={() => navigate(`/login?returnTo=${returnTo}`)} className={`btn-primary ${BASE}`}>
            Log in to apply
          </button>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
            New here? Creating an account takes a minute.
          </p>
        </>
      );
      break;
    case 'completeProfile':
      primary = (
        <>
          <button type="button" onClick={() => navigate(`/profile?returnTo=${returnTo}`)} className={`btn-primary ${BASE}`}>
            Complete profile to apply
          </button>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
            A few details are still missing from your profile.
          </p>
        </>
      );
      break;
    case 'applied':
      primary = (
        <div className="flex flex-wrap items-center justify-between gap-xs" role="status">
          <span className="font-label-md text-label-md text-on-surface">You&apos;ve applied</span>
          <ApplicationStatusPill status={state.status} />
        </div>
      );
      break;
    case 'blocked':
      primary = (
        <>
          <button type="button" disabled className={`btn-secondary ${BASE} opacity-70 cursor-not-allowed`}>
            {state.label}
          </button>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{state.reason}</p>
        </>
      );
      break;
    default:
      return null;
  }

  return (
    <div className="border-t border-surface-variant mt-xs pt-xs">
      {primary}
      {showExternalAlt && (
        <a
          href={drive.formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-xs font-body-sm text-body-sm text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
        >
          Or apply through the external form
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
        </a>
      )}
    </div>
  );
};
