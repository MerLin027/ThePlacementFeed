import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import AdminFilterPanel from '../components/AdminFilterPanel';
import StatusStrip from '../components/charts/StatusStrip';
import ApplicantTable from '../components/ApplicantTable';
import ApplicantDetailsModal from '../components/ApplicantDetailsModal';
import Pagination from '../components/Pagination';
import { FormAlert } from '../components/AuthCard';
import { APPLICATION_STATUSES, APPLICANT_SORTS, STATUS_META, statusLabel } from '../constants/applications';
import { useCatalog } from '../stores/catalog';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { addNumber, addDay, addList, addOne } from '../utils/filterParams';
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 25;
const FILTER_DEFAULTS = {
  search: '', status: [], branch: '', institute: '', gradYear: [], cgpaMin: '', cgpaMax: '', backlogsMax: '',
  appliedFrom: '', appliedTo: '', account: '', sort: 'newest',
};
const SORT_VALUES = APPLICANT_SORTS.map((s) => s.value);

// Query params for both the list and the export; empty / invalid values are left out
const toParams = (filters, search) => {
  const params = { sort: SORT_VALUES.includes(filters.sort) ? filters.sort : 'newest' };
  if (search) params.search = search;
  addList(params, 'status', filters.status, APPLICATION_STATUSES);
  addOne(params, 'branch', filters.branch);
  addOne(params, 'institute', filters.institute);
  addList(params, 'gradYear', filters.gradYear.filter((y) => /^\d{4}$/.test(y)));
  addNumber(params, 'cgpaMin', filters.cgpaMin, { min: 0, max: 10 });
  addNumber(params, 'cgpaMax', filters.cgpaMax, { min: 0, max: 10 });
  addNumber(params, 'backlogsMax', filters.backlogsMax, { min: 0, max: 50, int: true });
  addDay(params, 'appliedFrom', filters.appliedFrom);
  addDay(params, 'appliedTo', filters.appliedTo);
  addOne(params, 'account', filters.account, ['active', 'deleted']);
  return params;
};

const AdminApplicants = () => {
  const { driveId } = useParams();
  const [drive, setDrive] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const { branches } = useCatalog();
  const [filters, setFilter, resetFilters] = useUrlFilters(FILTER_DEFAULTS);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search.trim());
  // Institutes and graduation years present on this drive (from the list response)
  const [facets, setFacets] = useState({ institutes: [], gradYears: [] });
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState('Shortlisted');
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  usePageTitle(drive ? `Applicants · ${drive.company}` : 'Applicants');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Serialised so a keystroke in the (not yet debounced) search box doesn't trigger a fetch
  const paramsKey = JSON.stringify(toParams(filters, debouncedSearch));
  const params = useMemo(() => JSON.parse(paramsKey), [paramsKey]);

  // Any filter change goes back to page 1. Adjusted during render when the filters differ from the
  // ones the page was chosen under (React's pattern for resetting state on an input change), so it
  // also resets when filters return to an earlier value, without an effect.
  const [page, setPage] = useState(1);
  const [pageFilters, setPageFilters] = useState(paramsKey);
  if (pageFilters !== paramsKey) {
    setPageFilters(paramsKey);
    setPage(1);
  }

  // Loading/error are derived from the key of the last finished request (see AdminStudents)
  const requestKey = JSON.stringify([driveId, paramsKey, page, reloadKey]);
  const [settled, setSettled] = useState({ key: null, error: '' });
  const loading = settled.key !== requestKey;
  const error = loading ? '' : settled.error;

  useEffect(() => {
    const controller = new AbortController();
    const key = JSON.stringify([driveId, JSON.stringify(params), page, reloadKey]);
    api
      .get(`/api/placements/${driveId}/applicants`, {
        params: { ...params, page, limit: PAGE_SIZE },
        signal: controller.signal,
      })
      .then((res) => {
        setDrive(res.data.drive);
        setApplicants(res.data.data);
        setStats(res.data.stats);
        setFacets(res.data.facets || { institutes: [], gradYears: [] });
        setPagination(res.data.pagination);
        setSelected(new Set());
        setSettled({ key, error: '' });
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
        setSettled({ key, error: err.response?.status === 404 || err.response?.status === 400 ? '' : parseApiError(err, 'Could not load applicants.').message });
      });
    return () => controller.abort();
  }, [driveId, params, page, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked) => setSelected(checked ? new Set(applicants.map((a) => a.id)) : new Set());

  const saveApplicant = async (applicant, changes) => {
    const res = await api.patch(`/api/placements/${driveId}/applicants/${applicant.id}`, changes);
    setApplicants((prev) => prev.map((a) => (a.id === applicant.id ? res.data.data : a)));
    if (changes.status && changes.status !== applicant.status) reload(); // refresh stats
    return res.data.data;
  };

  const handleStatusChange = async (applicant, status) => {
    setBusyIds((prev) => new Set(prev).add(applicant.id));
    try {
      await saveApplicant(applicant, { status });
      toast.success(`${applicant.snapshot.firstName} marked as ${statusLabel(status)}`);
    } catch (err) {
      toast.error(parseApiError(err, 'Could not update status.').message || 'Could not update status.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(applicant.id);
        return next;
      });
    }
  };

  const handleBulkUpdate = async () => {
    setIsBulkSaving(true);
    try {
      const res = await api.patch(`/api/placements/${driveId}/applicants/bulk-status`, {
        applicationIds: [...selected],
        status: bulkStatus,
      });
      toast.success(`${res.data.matched} applicant${res.data.matched === 1 ? '' : 's'} set to ${statusLabel(bulkStatus)}`);
      reload();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not update applicants.').message || 'Could not update applicants.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.get(`/api/placements/${driveId}/applicants/export`, {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const slug = (drive?.company || 'drive').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'drive';
      a.href = url;
      a.download = `applicants-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      // Blob error bodies need parsing before the message can be shown
      let message = 'Could not export applicants.';
      if (err.response?.status === 429) message = 'Too many exports. Please try again in a few minutes.';
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-container-max mx-auto px-sm md:px-lg py-xl">
        <FormAlert>This drive doesn&apos;t exist or was deleted.</FormAlert>
        <Link to="/admin/dashboard" className="btn-secondary mt-md min-h-[44px]">Back to dashboard</Link>
      </div>
    );
  }

  const totalApplicants = Object.values(stats).reduce((sum, n) => sum + n, 0);

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs mb-sm"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-sm mb-md">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface">Applicants</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {drive ? `${drive.company} · ${drive.role}` : '…'} · {totalApplicants} total
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || pagination.total === 0}
          aria-busy={isExporting}
          className="btn-secondary gap-xs min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
          {isExporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      <StatusStrip stats={stats} />

      {/* Status counts — click to filter */}
      <div className="flex flex-wrap gap-xs mb-md" role="group" aria-label="Filter by status">
        {APPLICATION_STATUSES.map((s) => {
          const active = filters.status.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter('status', active ? filters.status.filter((x) => x !== s) : [...filters.status, s])}
              className={`inline-flex items-center gap-xs min-h-[44px] px-3 rounded-full border font-label-md text-label-md transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? `${STATUS_META[s].pill} border-transparent shadow-soft`
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden="true" />
              {statusLabel(s)}
              <span className={`px-2 rounded-full tabular-nums ${active ? 'bg-white/60' : 'bg-surface-container-high'}`}>{stats[s] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-md">
        <AdminFilterPanel
          searchLabel="Search applicants"
          searchPlaceholder="Name, email or roll number"
          values={filters}
          defaults={FILTER_DEFAULTS}
          onChange={setFilter}
          onReset={resetFilters}
          sortOptions={APPLICANT_SORTS}
          resultText={loading ? '' : `Showing ${applicants.length} of ${pagination.total} applicant${pagination.total === 1 ? '' : 's'}`}
          fields={[
            { key: 'status', label: 'Status', type: 'multi', options: APPLICATION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })) },
            { key: 'branch', label: 'Branch', type: 'select', options: [{ value: '', label: 'All branches' }, ...branches.map((b) => ({ value: b.code, label: b.name }))] },
            {
              key: 'institute', label: 'Institute', type: 'select',
              options: [{ value: '', label: 'All institutes' }, ...facets.institutes.map((i) => ({ value: i, label: i }))],
            },
            { key: 'account', label: 'Account', type: 'select', options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active accounts' }, { value: 'deleted', label: 'Deleted accounts' }] },
            { key: 'cgpaMin', label: 'Min CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≥ ${v}` },
            { key: 'cgpaMax', label: 'Max CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≤ ${v}` },
            { key: 'backlogsMax', label: 'Max active backlogs', type: 'number', min: 0, max: 50, step: 1, chip: (v) => `Backlogs ≤ ${v}` },
            { key: 'appliedFrom', label: 'Applied from', type: 'date', chip: (v) => `Applied from ${v}` },
            { key: 'appliedTo', label: 'Applied until', type: 'date', chip: (v) => `Applied until ${v}` },
            { key: 'gradYear', label: 'Graduation year', type: 'multi', options: facets.gradYears.map((y) => ({ value: String(y), label: String(y) })) },
          ]}
        />
      </div>

      {error && <div className="mb-md"><FormAlert>{error}</FormAlert></div>}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-xs mb-sm p-sm bg-primary/5 border border-primary/20 rounded-xl"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="font-label-md text-label-md text-on-surface flex-1">
            {selected.size} selected
          </span>
          <label htmlFor="bulk-status" className="font-body-sm text-body-sm text-on-surface-variant">Set status to</label>
          <select
            id="bulk-status"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="select-field sm:w-auto"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkUpdate}
            disabled={isBulkSaving}
            aria-busy={isBulkSaving}
            className="btn-primary min-h-[44px]"
          >
            {isBulkSaving ? 'Updating…' : 'Apply'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="btn-secondary min-h-[44px]">
            Clear
          </button>
        </div>
      )}

      <ApplicantTable
        applicants={applicants}
        loading={loading}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onStatusChange={handleStatusChange}
        onView={setViewing}
        busyIds={busyIds}
      />

      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />

      <ApplicantDetailsModal
        applicant={viewing}
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        onSave={async (applicant, changes) => {
          await saveApplicant(applicant, changes);
          toast.success('Changes saved');
        }}
      />
    </div>
  );
};

export default AdminApplicants;
