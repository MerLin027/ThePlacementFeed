import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const PlacementCard = ({ placement }) => {
  const { _id, company, role, type, ctc, status, driveDate, deadline, eligibility, tags } = placement;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const typeColor = {
    'Full-Time': 'bg-violet-50 text-violet-700 border-violet-200',
    'Internship': 'bg-sky-50 text-sky-700 border-sky-200',
    '6M Intern + FTE': 'bg-teal-50 text-teal-700 border-teal-200',
  };

  return (
    <Link to={`/placement/${_id}`} className="block">
      <div className="card p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {company}
            </h3>
            <p className="text-sm text-slate-500 truncate mt-0.5">{role}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeColor[type] || ''}`}>
            {type}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            ₹{ctc} LPA
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm text-slate-500 flex-1">
          {eligibility?.branches?.length > 0 && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{eligibility.branches.join(', ')}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Drive: {formatDate(driveDate)}</span>
          </div>
          {deadline && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Deadline: {formatDate(deadline)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            {tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-500"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-400">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default PlacementCard;
