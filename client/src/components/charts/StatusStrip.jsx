import { APPLICATION_STATUSES, STATUS_META } from '../../constants/applications';

/**
 * One drive's applicants split by status, as a single bar (part-to-whole). Plain HTML, so the
 * applicants page doesn't load the chart library. The status buttons under it double as the legend
 * (same colours, labels and counts); each segment also names itself on hover.
 */
const StatusStrip = ({ stats }) => {
  const total = APPLICATION_STATUSES.reduce((sum, s) => sum + (stats[s] || 0), 0);
  if (total === 0) return null;

  const summary = APPLICATION_STATUSES.filter((s) => stats[s] > 0)
    .map((s) => `${stats[s]} ${STATUS_META[s].label.toLowerCase()}`)
    .join(', ');

  return (
    <div className="mb-sm" role="img" aria-label={`${total} applicants: ${summary}`}>
      {/* gap-[2px] on the surface colour separates touching segments */}
      <div className="flex h-3 gap-[2px] rounded-full overflow-hidden bg-surface-container-lowest">
        {APPLICATION_STATUSES.filter((s) => stats[s] > 0).map((s) => (
          <span
            key={s}
            title={`${STATUS_META[s].label}: ${stats[s]} (${Math.round((stats[s] / total) * 100)}%)`}
            className={`${STATUS_META[s].dot} min-w-[6px] transition-[flex-grow] duration-300 ease-out-soft`}
            style={{ flexGrow: stats[s] }}
          />
        ))}
      </div>
    </div>
  );
};

export default StatusStrip;
