import { Link } from 'react-router';
import { PROFILE_FIELD_LABELS } from '../constants/profile';

/**
 * Lists the profile fields still needed before a student can apply in-app.
 * `missingFields` always comes from the server, which owns the rule.
 */
const ProfileCompletionBanner = ({ missingFields = [], linkTo }) => {
  if (missingFields.length === 0) return null;

  return (
    <div
      role="status"
      className="p-sm bg-amber-50 border border-amber-200 rounded-xl font-body-sm text-body-sm text-amber-900 flex items-start gap-xs"
    >
      <span className="material-symbols-outlined text-[20px] flex-shrink-0 text-amber-700" aria-hidden="true">
        assignment_late
      </span>
      <div className="flex-1">
        <p className="font-semibold">Finish your profile to apply in-app</p>
        <p className="mt-[2px]">
          Still needed: {missingFields.map((f) => PROFILE_FIELD_LABELS[f] || f).join(', ')}.
        </p>
        {linkTo && (
          <Link
            to={linkTo}
            className="inline-flex items-center gap-1 mt-xs font-semibold text-amber-900 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            Complete profile
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;
