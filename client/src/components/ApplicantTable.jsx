import { useCatalog } from '../stores/catalog';
import { APPLICATION_STATUSES, STATUS_META, statusLabel } from '../constants/applications';
import { TableRowsSkeleton } from './Skeleton';
import PillSelect from './PillSelect';

// Headings and cells are centred; the applicant column (name, roll number, email) stays left-aligned
const thClass = 'text-center px-sm py-sm font-label-sm text-label-sm font-semibold text-on-surface/80 uppercase tracking-wider whitespace-nowrap';
const tdClass = 'px-sm py-xs text-center font-body-md text-body-md';
const statusOptions = APPLICATION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Applicant rows with selection for bulk actions, an inline status select and a
 * "View" button for the full application. Deleted accounts show a scrubbed name.
 */
const ApplicantTable = ({ applicants, loading, selected, onToggle, onToggleAll, onStatusChange, onView, busyIds }) => {
  const { branchLabel } = useCatalog();
  const allSelected = applicants.length > 0 && applicants.every((a) => selected.has(a.id));

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-soft border border-outline-variant overflow-hidden">
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
              <th className={`${thClass} text-left!`}>Applicant</th>
              <th className={`${thClass} hidden md:table-cell`}>Branch</th>
              <th className={`${thClass} hidden sm:table-cell`}>CGPA</th>
              <th className={`${thClass} hidden lg:table-cell`}>Backlogs</th>
              <th className={`${thClass} hidden lg:table-cell`}>Applied</th>
              <th className={thClass}>Status</th>
              <th className={thClass}><span className="sr-only sm:not-sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/60">
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
                const isSelected = selected.has(a.id);
                return (
                  <tr key={a.id} className={`transition-colors duration-200 ${isSelected ? 'bg-primary/5' : `even:bg-surface-container-low/60 hover:bg-primary/4`}`}>
                    {/* A blue edge marks selected rows */}
                    <td className={`px-sm py-xs transition-shadow duration-200 ${isSelected ? 'shadow-[inset_3px_0_0_var(--color-primary-container)]' : ''}`}>
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
                          <span className="ml-xs px-2 py-px rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                            Account deleted
                          </span>
                        )}
                      </p>
                      {a.snapshot.rollNumber && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{a.snapshot.rollNumber}</p>
                      )}
                      {/* On phones the email (and CGPA) are in the details dialog */}
                      {a.snapshot.email && (
                        <p className="hidden sm:block font-body-sm text-body-sm text-on-surface-variant break-all">{a.snapshot.email}</p>
                      )}
                    </td>
                    <td className={`${tdClass} hidden md:table-cell text-on-surface`}>
                      {/* Long branch names stay on one line; the full name shows on hover */}
                      <span className="block max-w-[16rem] mx-auto truncate" title={a.snapshot.branch ? branchLabel(a.snapshot.branch) : undefined}>
                        {a.snapshot.branch ? branchLabel(a.snapshot.branch) : '—'}
                      </span>
                    </td>
                    <td className={`${tdClass} hidden sm:table-cell text-on-surface tabular-nums`}>{a.snapshot.cgpa ?? '—'}</td>
                    <td className={`${tdClass} hidden lg:table-cell text-on-surface tabular-nums`}>{a.snapshot.activeBacklogs ?? '—'}</td>
                    <td className={`${tdClass} hidden lg:table-cell text-on-surface whitespace-nowrap tabular-nums`}>{formatDate(a.submittedAt)}</td>
                    <td className={tdClass}>
                      {/* A compact pill in the status colour; still a native select underneath */}
                      <PillSelect
                        label={`Status for ${name}`}
                        value={a.status}
                        onChange={(e) => onStatusChange(a, e.target.value)}
                        disabled={busyIds.has(a.id)}
                        options={statusOptions}
                        tone={`${STATUS_META[a.status]?.pill || 'bg-surface-container-high text-on-surface'} group-hover/ps:brightness-95`}
                        className={`min-w-[116px] sm:min-w-[132px] ${STATUS_META[a.status] ? STATUS_META[a.status].pill.split(' ').find((c) => c.startsWith('text-')) : ''}`}
                      />
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => onView(a)}
                        aria-label={`View application from ${name}`}
                        className="inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/5 font-label-sm text-label-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
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
