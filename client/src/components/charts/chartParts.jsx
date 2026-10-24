// Shared pieces for the admin charts (dashboard and the applicants page), so every chart reads
// the same: one tooltip and legend style (colours and axis styles are in chartTheme.js).


// One tooltip look for every chart: a label line, then a swatch + name + value per series
export const ChartTooltip = ({ active, payload, label, labelFormat }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-pop px-3 py-2 font-body-sm text-body-sm">
      {label !== undefined && <p className="font-label-md text-label-md text-on-surface mb-1">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-xs text-on-surface-variant">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.payload?.fill || p.color }} aria-hidden="true" />
          {p.name}
          <span className="ml-auto pl-sm font-label-md text-label-md text-on-surface tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// Legend in a fixed order: a colour swatch beside text in the text colour (never coloured text)
export const ChartLegend = ({ items }) => (
  <ul className="flex flex-wrap justify-center gap-x-sm gap-y-1 mt-xs font-body-sm text-body-sm text-on-surface-variant">
    {items.map((item) => (
      <li key={item.label} className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);

export const EmptyChart = ({ text }) => (
  <div className="h-full min-h-[200px] flex items-center justify-center rounded-xl bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
    {text}
  </div>
);

/**
 * The admin dashboard's overview: headline numbers and four charts from GET /api/admin/insights.
 * Loaded as its own chunk (React.lazy in AdminDashboard), so the chart library only downloads here.
 */
