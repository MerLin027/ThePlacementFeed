import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, AreaChart, Area,
} from 'recharts';
import api from '../../api/axios';
import ChartCard from './ChartCard';
import { FormAlert } from '../AuthCard';
import { APPLICATION_STATUSES, STATUS_META, statusLabel } from '../../constants/applications';
import { useCatalog } from '../../stores/catalog';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { parseApiError } from '../../utils/formErrors';

// Chart ink and structure: text in the text tokens (never the series colour), recessive hairline grid
const INK = '#434655';
const GRID = '#e1e3e4';
const SURFACE = '#ffffff';
const ACCENT = '#2563eb';
const SELECTED = '#059669';
const AXIS = { fill: INK, fontSize: 12 };

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const StatTile = ({ label, value, note, icon }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm">
    <p className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{icon}</span>
      {label}
    </p>
    <p className="font-display-lg text-display-lg text-on-surface mt-1">{value.toLocaleString('en-IN')}</p>
    {note && <p className="font-body-sm text-body-sm text-on-surface-variant mt-[2px]">{note}</p>}
  </div>
);

// One tooltip look for every chart: a label line, then a swatch + name + value per series
const ChartTooltip = ({ active, payload, label, labelFormat }) => {
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
const ChartLegend = ({ items }) => (
  <ul className="flex flex-wrap justify-center gap-x-sm gap-y-1 mt-xs font-body-sm text-body-sm text-on-surface-variant">
    {items.map((item) => (
      <li key={item.label} className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);

const EmptyChart = ({ text }) => (
  <div className="h-full min-h-[200px] flex items-center justify-center rounded-xl bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
    {text}
  </div>
);

/**
 * The admin dashboard's overview: headline numbers and four charts from GET /api/admin/insights.
 * Loaded as its own chunk (React.lazy in AdminDashboard), so the chart library only downloads here.
 */
const DashboardInsights = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reduced = usePrefersReducedMotion();
  const { branchLabel } = useCatalog();

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/admin/insights', { signal: controller.signal })
      .then((res) => setData(res.data.data))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(parseApiError(err, 'Could not load the overview.').message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <div className="mb-lg"><FormAlert>{error}</FormAlert></div>;
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm mb-lg" role="status" aria-label="Loading the overview">
        {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
    );
  }

  const { kpis, pipeline, weekly, topDrives, branches, drives } = data;
  const animate = !reduced;
  const hasApps = kpis.applications > 0;

  const pipelineData = APPLICATION_STATUSES.map((s) => ({ name: statusLabel(s), status: s, value: pipeline[s], fill: STATUS_META[s].color }));
  const weekTotal = weekly.reduce((sum, w) => sum + w.applications, 0);
  const busiest = weekly.reduce((best, w) => (w.applications > (best?.applications ?? -1) ? w : best), null);
  // Only chart fields here: Recharts copies data fields onto its SVG elements as attributes, so a
  // field named `role` became an (invalid) ARIA role
  const driveData = topDrives.map((d) => ({ name: d.company, ...d.statuses }));
  const branchData = branches.map((b) => ({ name: branchLabel(b.code), code: b.code, applications: b.applications, selected: b.selected }));
  const topBranch = branchData[0];

  return (
    <section aria-labelledby="overview-heading" className="mb-lg">
      <h2 id="overview-heading" className="font-headline-md text-headline-md text-on-surface mb-sm">Overview</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm mb-sm">
        <StatTile icon="event_upcoming" label="Active drives" value={kpis.activeDrives} note={`${drives.Upcoming} upcoming · ${drives.Ongoing} ongoing`} />
        <StatTile icon="group" label="Students" value={kpis.students} note={`${pct(kpis.studentsComplete, kpis.students)}% have a complete profile`} />
        <StatTile icon="send" label="Applications" value={kpis.applications} note={`${kpis.applicationsLast7} in the last 7 days`} />
        <StatTile icon="celebration" label="Selected" value={kpis.selected} note={`${kpis.studentsPlaced} student${kpis.studentsPlaced === 1 ? '' : 's'} placed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-sm">
        <ChartCard
          title="Where applications stand"
          summary={hasApps ? `${pipeline.Offered} of ${kpis.applications} applications ended in a selection; ${pipeline.Applied} are still waiting for a first decision.` : 'No applications yet.'}
          table={{ columns: ['Status', 'Applications'], rows: pipelineData.map((d) => [d.name, d.value]) }}
        >
          {hasApps ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={96} />
                <Tooltip cursor={{ fill: 'rgb(3 21 54 / 0.04)' }} content={<ChartTooltip />} />
                <Bar dataKey="value" name="Applications" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={animate}>
                  {pipelineData.map((d) => <Cell key={d.status} fill={d.fill} />)}
                  <LabelList dataKey="value" position="right" fill={INK} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="Applications will show up here." />}
        </ChartCard>

        <ChartCard
          title="Applications per week"
          summary={weekTotal > 0 ? `${weekTotal} in the last ${weekly.length} weeks; the busiest was the week of ${shortDate(busiest.weekStart)} (${busiest.applications}).` : `None in the last ${weekly.length} weeks.`}
          table={{ columns: ['Week of', 'Applications'], rows: weekly.map((w) => [shortDate(w.weekStart), w.applications]) }}
        >
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={weekly} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="weekStart" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={shortDate} minTickGap={24} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} tickFormatter={compact} />
              <Tooltip cursor={{ stroke: INK, strokeWidth: 1 }} content={<ChartTooltip labelFormat={(v) => `Week of ${shortDate(v)}`} />} />
              <Area
                type="monotone"
                dataKey="applications"
                name="Applications"
                stroke={ACCENT}
                strokeWidth={2}
                fill={ACCENT}
                fillOpacity={0.1}
                activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Drives with the most applications"
          summary={driveData.length > 0 ? `${driveData[0].name} leads with ${topDrives[0].total} applications. Bars are split by status.` : 'No applications yet.'}
          table={{
            columns: ['Drive', ...APPLICATION_STATUSES.map(statusLabel), 'Total'],
            rows: topDrives.map((d) => [d.company, ...APPLICATION_STATUSES.map((s) => d.statuses[s]), d.total]),
          }}
        >
          {driveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, driveData.length * 40 + 60)}>
              <BarChart data={driveData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={140} />
                <Tooltip cursor={{ fill: 'rgb(3 21 54 / 0.04)' }} content={<ChartTooltip />} />
                {/* 2px surface stroke = the gap between stacked segments */}
                {APPLICATION_STATUSES.map((s) => (
                  <Bar key={s} dataKey={s} name={statusLabel(s)} stackId="status" fill={STATUS_META[s].color} stroke={SURFACE} strokeWidth={2} barSize={22} isAnimationActive={animate} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="Drives with in-app applications will show up here." />}
          {driveData.length > 0 && <ChartLegend items={APPLICATION_STATUSES.map((s) => ({ label: statusLabel(s), color: STATUS_META[s].color }))} />}
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Applications and selections by branch"
          summary={topBranch ? `${topBranch.name} applies most (${topBranch.applications} applications, ${topBranch.selected} selected).` : 'No applications yet.'}
          table={{ columns: ['Branch', 'Applications', 'Selected'], rows: branchData.map((b) => [b.name, b.applications, b.selected]) }}
        >
          {branchData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={branchData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="code" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} tickFormatter={compact} />
                <Tooltip cursor={{ fill: 'rgb(3 21 54 / 0.04)' }} content={<ChartTooltip labelFormat={(code) => branchLabel(code)} />} />
                <Bar dataKey="applications" name="Applications" fill={ACCENT} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={animate} />
                <Bar dataKey="selected" name="Selected" fill={SELECTED} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={animate} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="Branch numbers will show up here." />}
          {branchData.length > 0 && <ChartLegend items={[{ label: 'Applications', color: ACCENT }, { label: 'Selected', color: SELECTED }]} />}
        </ChartCard>
      </div>
    </section>
  );
};

export default DashboardInsights;
