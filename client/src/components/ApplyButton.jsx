import { useNavigate } from 'react-router';
import { useApplyState } from '../hooks/useApplyState';

const BASE = 'w-full min-h-[44px] py-3 justify-center';

// Applied pill colour per pipeline status
const STATUS_STYLES = {
  Applied: 'bg-primary-fixed text-on-primary-fixed',
  Shortlisted: 'bg-amber-100 text-amber-800',
  Interviewing: 'bg-amber-100 text-amber-800',
  Offered: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-surface-container-high text-on-surface-variant',
};

export const ApplicationStatusPill = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm ${STATUS_STYLES[status] || STATUS_STYLES.Applied}`}>
    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
    {status}
  </span>
);

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
          className={`btn-primary ${BASE}`}
        >
          Apply Now
        </button>
      );
    case 'apply':
      return (
        <button type="button" onClick={go(`${detailPath}?apply=1`)} className={`btn-primary ${BASE}`}>
          Apply Now
        </button>
      );
    case 'login':
      return (
        <button
          type="button"
          onClick={go(`/login?returnTo=${encodeURIComponent(`${detailPath}?apply=1`)}`)}
          className={`btn-secondary ${BASE} text-primary`}
        >
          Log in to apply
        </button>
      );
    case 'completeProfile':
      return (
        <button
          type="button"
          onClick={go(`/profile?returnTo=${encodeURIComponent(`${detailPath}?apply=1`)}`)}
          className={`btn-secondary ${BASE} text-primary`}
        >
          Complete profile to apply
        </button>
      );
    case 'applied':
      return (
        <div className={`btn-secondary ${BASE} gap-xs`}>
          Applied
          <ApplicationStatusPill status={state.status} />
        </div>
      );
    case 'blocked':
      return (
        <div
          className={`btn-secondary ${BASE} ${
            drive.isPostponed ? 'text-red-700 border-red-200 hover:bg-red-50' : 'text-on-surface-variant'
          }`}
        >
          {state.label}
        </div>
      );
    default:
      return (
        <div
          className={`btn-secondary ${BASE} ${
            drive.isPostponed
              ? 'text-red-700 border-red-200 hover:bg-red-50 focus:ring-red-700'
              : drive.status === 'Completed'
                ? 'text-secondary'
                : 'text-primary'
          }`}
        >
          View Details
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
          Apply Now
        </a>
      );
      break;
    case 'apply':
      primary = (
        <button type="button" onClick={onApply} className={`btn-primary ${BASE}`}>
          Apply Now
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
          className="inline-flex items-center gap-1 mt-xs font-body-sm text-body-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          Or apply through the external form
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
        </a>
      )}
    </div>
  );
};
