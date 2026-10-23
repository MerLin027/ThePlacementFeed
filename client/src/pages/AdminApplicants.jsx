import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import ApplicantFilters from '../components/ApplicantFilters';
import ApplicantTable from '../components/ApplicantTable';
import ApplicantDetailsModal from '../components/ApplicantDetailsModal';
import Pagination from '../components/Pagination';
import { FormAlert } from '../components/AuthCard';
import { APPLICATION_STATUSES } from '../constants/applications';
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { search: '', status: '', branch: '', cgpaMin: '', cgpaMax: '', sort: 'newest' };

// Query params for both the list and the export; empty / invalid values are left out
const toParams = (filters, search) => {
  const params = { sort: filters.sort };
  if (search) params.search = search;
  if (filters.status) params.status = filters.status;
  if (filters.branch) params.branch = filters.branch;
  ['cgpaMin', 'cgpaMax'].forEach((k) => {
    const n = Number(filters[k]);
    if (filters[k] !== '' && Number.isFinite(n) && n >= 0 && n <= 10) params[k] = n;
  });
  return params;
};

const AdminApplicants = () => {
  const { driveId } = useParams();
  const [drive, setDrive] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  // Any filter change goes back to page 1
  useEffect(() => {
    setPage(1);
  }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .get(`/api/placements/${driveId}/applicants`, {
        params: { ...params, page, limit: PAGE_SIZE },
        signal: controller.signal,
      })
      .then((res) => {
        setDrive(res.data.drive);
        setApplicants(res.data.data);
        setStats(res.data.stats);
        setPagination(res.data.pagination);
        setSelected(new Set());
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
        else setError(parseApiError(err, 'Could not load applicants.').message);
        setLoading(false);
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
      toast.success(`${applicant.snapshot.firstName} marked as ${status}`);
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
      toast.success(`${res.data.matched} applicant${res.data.matched === 1 ? '' : 's'} set to ${bulkStatus}`);
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

      {/* Status counts — click to filter */}
      <div className="flex flex-wrap gap-xs mb-md" role="group" aria-label="Filter by status">
        {APPLICATION_STATUSES.map((s) => {
          const active = filters.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters((f) => ({ ...f, status: active ? '' : s }))}
              className={`inline-flex items-center gap-xs min-h-[44px] px-3 rounded-full border font-label-md text-label-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? 'bg-primary-container text-on-primary border-primary-container'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              {s}
              <span className={`px-2 rounded-full ${active ? 'bg-white/20' : 'bg-surface-container-high'}`}>{stats[s] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-md">
        <ApplicantFilters filters={filters} onChange={setFilters} />
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
              <option key={s} value={s}>{s}</option>
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
