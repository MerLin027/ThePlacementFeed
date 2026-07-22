import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const PlacementCard = ({ placement }) => {
  const { _id, company, role, ctc, status, driveDate, deadline, eligibility, formUrl } = placement;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Determine the bottom button style & text based on status
  const buttonConfig = {
    Upcoming: {
      className: 'btn-primary w-full py-3 justify-center',
      label: 'Apply Now',
    },
    Ongoing: {
      className: 'btn-secondary w-full py-3 justify-center text-primary',
      label: 'View Details',
    },
    Completed: {
      className: 'btn-secondary w-full py-3 justify-center text-secondary',
      label: 'View Details',
    },
  };

  const btn = buttonConfig[status] || buttonConfig.Upcoming;

  // Bottom detail row — varies by status
  const renderDetailRow = () => {
    if (status === 'Upcoming') {
      return (
        <div className="flex items-center gap-xs text-on-surface-variant font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[18px]">event</span>
          <span>Deadline: {formatDate(deadline)}</span>
        </div>
      );
    }
    if (status === 'Ongoing') {
      return (
        <div className="flex items-center gap-xs text-on-surface-variant font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[18px]">engineering</span>
          <span>{eligibility?.branches?.length > 0 ? eligibility.branches.join(', ') : 'Multiple Branches'}</span>
        </div>
      );
    }
    // Completed
    return (
      <div className="flex items-center gap-xs text-on-surface-variant font-body-sm text-body-sm">
        <span className="material-symbols-outlined text-[18px]">group</span>
        <span>Drive: {formatDate(driveDate)}</span>
      </div>
    );
  };

  return (
    <Link to={`/placement/${_id}`} className="block">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col h-full hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-shadow">
        {/* Header: Logo + Status Badge */}
        <div className="flex justify-between items-start mb-sm">
          <div className="w-12 h-12 border border-outline-variant rounded-lg flex items-center justify-center bg-surface p-1">
            <span className="material-symbols-outlined text-secondary text-[28px]">domain</span>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Company & Role */}
        <h3 className="font-headline-md text-headline-md text-on-surface mb-xs truncate">{company}</h3>
        <p className="font-body-md text-body-md text-on-surface-variant mb-md truncate">{role}</p>

        {/* Details */}
        <div className="space-y-xs mb-md flex-grow">
          <div className="flex items-center gap-xs text-on-surface-variant font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>{ctc} LPA</span>
          </div>
          {renderDetailRow()}
        </div>

        {/* Action Button */}
        {formUrl && status === 'Upcoming' ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(formUrl, '_blank', 'noopener,noreferrer');
            }}
            className={btn.className}
          >
            {btn.label}
          </button>
        ) : (
          <div className={btn.className}>
            {btn.label}
          </div>
        )}
      </div>
    </Link>
  );
};

export default PlacementCard;
