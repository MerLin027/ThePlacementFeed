import { Link } from 'react-router';
import StatusBadge from './StatusBadge';
import CompanyMonogram from './CompanyMonogram';
import { CardApplyButton } from './ApplyButton';
import { formatBranches } from '../constants/branches';
import { deadlineInfo, DEADLINE_TONE_CLASS, formatDay } from '../utils/deadline';

const Row = ({ icon, children, title }) => (
  <div className="flex items-center gap-xs text-on-surface-variant font-body-sm text-body-sm min-w-0" title={title}>
    <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">{icon}</span>
    <span className="truncate">{children}</span>
  </div>
);

/**
 * Drive card. The company name is the link; its ::after stretches over the
 * whole card so the card is clickable, while the apply button sits above it
 * (no interactive element nested inside another).
 */
const PlacementCard = ({ placement, index = 0 }) => {
  const { _id, company, role, ctc, status, isPostponed, driveDate, deadline, eligibility } = placement;
  const branches = eligibility?.branches?.length > 0 ? formatBranches(eligibility.branches) : 'All branches';
  const closing = status === 'Upcoming' && !isPostponed ? deadlineInfo(deadline) : null;

  let timing = null;
  if (isPostponed) {
    timing = <Row icon="event_busy">New dates to be announced</Row>;
  } else if (status === 'Upcoming' && closing) {
    timing = (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-label-sm text-label-sm ${DEADLINE_TONE_CLASS[closing.tone]}`}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
        {closing.label}
      </span>
    );
  } else if (status === 'Completed') {
    timing = <Row icon="event_available">Drive held {formatDay(driveDate)}</Row>;
  } else if (driveDate) {
    timing = <Row icon="event">Drive on {formatDay(driveDate)}</Row>;
  } else if (!deadline) {
    timing = <Row icon="event">Dates to be announced</Row>;
  }

  // Hover is detected on the wrapper, which never moves, so the lifted card cannot slide out from
  // under a resting pointer and flicker
  return (
    <div className="group/card h-full">
      <article
        style={{ '--i': index }}
        className="relative bg-surface-container-lowest border border-outline-variant rounded-2xl p-md flex flex-col h-full shadow-soft group-hover/card:shadow-lift group-hover/card:border-primary-30 group-hover/card:-translate-y-0.5 transition-control focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 motion-safe:rise-in-stagger"
      >
        <div className="flex justify-between items-start gap-sm mb-sm">
          <CompanyMonogram name={company} className="group-hover/card:scale-105 transition-transform duration-200 ease-snappy" />
          <StatusBadge status={status} isPostponed={isPostponed} />
        </div>

        <h3 className="font-headline-md text-headline-md text-on-surface mb-[2px] truncate group-hover/card:text-primary transition-colors duration-200">
          <Link
            to={`/placement/${_id}`}
            className="after:absolute after:inset-0 after:rounded-2xl focus:outline-hidden"
          >
            {company}
          </Link>
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant mb-sm truncate">{role}</p>

        <div className="space-y-xs mb-md grow">
          <Row icon="payments">
            <span className="font-label-md text-label-md text-on-surface tabular-nums">₹{ctc} LPA</span>
          </Row>
          <Row icon="school" title={branches}>{branches}</Row>
          {timing}
        </div>

        <CardApplyButton drive={placement} />
      </article>
    </div>
  );
};

export default PlacementCard;
