import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api/axios';
import ChartCard from './ChartCard';
import { GRID, ACCENT, SELECTED, AXIS, compact } from './chartTheme';
import { ChartTooltip, ChartLegend, EmptyChart } from './chartParts';
import { FormAlert } from '../AuthCard';
import { useCatalog } from '../../stores/catalog';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { parseApiError } from '../../utils/formErrors';

/**
 * One drive's applicants by CGPA band and by branch (GET /api/placements/:driveId/applicants/insights).
 * Loaded lazily from the applicants page when its "Insights" section is opened, so the chart
 * library is fetched only then.
 */
const DriveInsights = ({ driveId, reloadKey }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reduced = usePrefersReducedMotion();
  const { branchLabel } = useCatalog();

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(`/api/placements/${driveId}/applicants/insights`, { signal: controller.signal })
      .then((res) => {
        setData(res.data.data);
        setError('');
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(parseApiError(err, 'Could not load the insights.').message);
      });
    return () => controller.abort();
  }, [driveId, reloadKey]);

  if (error) return <FormAlert>{error}</FormAlert>;
  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-sm" role="status" aria-label="Loading the insights">
        <span className="skeleton h-64 rounded-2xl" />
        <span className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const total = data.cgpa.reduce((t, b) => t + b.applicants, 0);
  const top = data.cgpa.reduce((best, b) => (b.applicants > (best?.applicants ?? 0) ? b : best), null);
  const branchData = data.branches.map((b) => ({ ...b, name: branchLabel(b.code) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-sm">
      <ChartCard
        title="Applicants by CGPA"
        summary={total > 0 ? `${total} applicant${total === 1 ? '' : 's'} with a CGPA; most fall in ${top.bucket} (${top.applicants}).` : 'No applicants with a CGPA yet.'}
        table={{ columns: ['CGPA', 'Applicants'], rows: data.cgpa.map((b) => [b.bucket, b.applicants]) }}
      >
        {total > 0 ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.cgpa} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} tickFormatter={compact} />
              <Tooltip cursor={{ fill: 'rgb(3 21 54 / 0.04)' }} content={<ChartTooltip labelFormat={(b) => `CGPA ${b}`} />} />
              <Bar dataKey="applicants" name="Applicants" fill={ACCENT} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text="The spread shows up once students apply." />}
      </ChartCard>

      <ChartCard
        title="Applicants by branch"
        summary={branchData.length > 0 ? `${branchData[0].name} has the most applicants (${branchData[0].applications}, ${branchData[0].selected} selected).` : 'No applicants yet.'}
        table={{ columns: ['Branch', 'Applicants', 'Selected'], rows: branchData.map((b) => [b.name, b.applications, b.selected]) }}
      >
        {branchData.length > 0 ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={branchData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="code" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} tickFormatter={compact} />
              <Tooltip cursor={{ fill: 'rgb(3 21 54 / 0.04)' }} content={<ChartTooltip labelFormat={(code) => branchLabel(code)} />} />
              <Bar dataKey="applications" name="Applicants" fill={ACCENT} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
              <Bar dataKey="selected" name="Selected" fill={SELECTED} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text="Branches show up once students apply." />}
        {branchData.length > 0 && <ChartLegend items={[{ label: 'Applicants', color: ACCENT }, { label: 'Selected', color: SELECTED }]} />}
      </ChartCard>
    </div>
  );
};

export default DriveInsights;
