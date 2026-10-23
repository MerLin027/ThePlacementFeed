import { branchLabel } from '../constants/branches';
import { APPLICATION_STATUSES } from '../constants/applications';
import { TableRowsSkeleton } from './Skeleton';

const thClass = 'text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider';

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Applicant rows with selection for bulk actions, an inline status select and a
 * "View" button for the full application. Deleted accounts show a scrubbed name.
 */
const ApplicantTable = ({ applicants, loading, selected, onToggle, onToggleAll, onStatusChange, onView, busyIds }) => {
  const allSelected = applicants.length > 0 && applicants.every((a) => selected.has(a.id));

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-sm py-sm w-10">
                {/* 44px tap area around the native checkbox */}
                <label className="inline-flex w-[44px] h-[44px] -m-2 items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleAll(!allSelected)}
                    aria-label="Select all applicants on this page"
                    className="w-5 h-5 accent-primary cursor-pointer"
                    disabled={applicants.length === 0}
                  />
                </label>
              </th>
              <th className={thClass}>Applicant</th>
              <th className={`${thClass} hidden md:table-cell`}>Branch</th>
              <th className={thClass}>CGPA</th>
              <th className={`${thClass} hidden lg:table-cell`}>Backlogs</th>
              <th className={`${thClass} hidden lg:table-cell`}>Applied</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {loading ? (
              <TableRowsSkeleton columns={8} label="Loading applicants" />
            ) : applicants.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-sm py-xl text-center font-body-sm text-body-sm text-on-surface-variant">
                  No applicants match these filters.
                </td>
              </tr>
            ) : (
              applicants.map((a) => {
                const name = `${a.snapshot.firstName} ${a.snapshot.lastName}`.trim();
                return (
                  <tr key={a.id} className={selected.has(a.id) ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}>
                    <td className="px-sm py-xs">
                      <label className="inline-flex w-[44px] h-[44px] -m-2 items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => onToggle(a.id)}
                          aria-label={`Select ${name}`}
                          className="w-5 h-5 accent-primary cursor-pointer"
                        />
                      </label>
                    </td>
                    <td className="px-sm py-xs">
                      <p className="font-label-md text-label-md text-on-surface">
                        {name}
                        {a.studentDeleted && (
                          <span className="ml-xs px-2 py-[1px] rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                            Account deleted
                          </span>
                        )}
                      </p>
                      {a.snapshot.rollNumber && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{a.snapshot.rollNumber}</p>
                      )}
                      {a.snapshot.email && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant break-all">{a.snapshot.email}</p>
                      )}
                    </td>
                    <td className="px-sm py-xs hidden md:table-cell font-body-sm text-body-sm text-on-surface">
                      {a.snapshot.branch ? branchLabel(a.snapshot.branch) : '—'}
                    </td>
                    <td className="px-sm py-xs font-body-sm text-body-sm text-on-surface">{a.snapshot.cgpa ?? '—'}</td>
                    <td className="px-sm py-xs hidden lg:table-cell font-body-sm text-body-sm text-on-surface">
                      {a.snapshot.activeBacklogs ?? '—'}
                    </td>
                    <td className="px-sm py-xs hidden lg:table-cell font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                      {formatDate(a.submittedAt)}
                    </td>
                    <td className="px-sm py-xs">
                      <select
                        value={a.status}
                        onChange={(e) => onStatusChange(a, e.target.value)}
                        disabled={busyIds.has(a.id)}
                        aria-label={`Status for ${name}`}
                        className="select-field min-w-[140px]"
                      >
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-sm py-xs text-right">
                      <button
                        type="button"
                        onClick={() => onView(a)}
                        aria-label={`View application from ${name}`}
                        className="inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 font-label-sm text-label-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                        <span className="hidden lg:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApplicantTable;
