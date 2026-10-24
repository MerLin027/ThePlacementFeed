import { useState, useId } from 'react';

/**
 * Frame for one dashboard chart: a title, a one-line summary (what the chart says, also the
 * screen-reader description), the chart itself, and a "Table" toggle that shows the same numbers as
 * a table, so nothing depends on reading colours or hovering.
 *
 * table: { columns: [label, ...], rows: [[cell, ...], ...] }
 */
const ChartCard = ({ title, summary, table, children, className = '' }) => {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm md:p-md flex flex-col ${className}`}
    >
      <div className="flex items-start justify-between gap-sm mb-xs">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
          <p id={`${id}-summary`} className="font-body-sm text-body-sm text-on-surface-variant mt-[2px]">{summary}</p>
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="shrink-0 inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{showTable ? 'bar_chart' : 'table'}</span>
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>

      {showTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-outline-variant">
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`py-xs pr-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider ${i > 0 ? 'text-right' : ''}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i} className={`py-xs pr-sm text-on-surface ${i > 0 ? 'text-right tabular-nums' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`} className="flex-1 min-h-0">
          {children}
        </div>
      )}
    </section>
  );
};

export default ChartCard;
