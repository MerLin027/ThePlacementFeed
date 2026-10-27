import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Link, useParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import AdminFilterPanel, { toolbarButtonClass } from '../components/AdminFilterPanel';
import SelectionBar from '../components/SelectionBar';
import PillSelect from '../components/PillSelect';
import { dropDown } from '../utils/motion';
import StatusStrip from '../components/charts/StatusStrip';

// The CGPA and branch charts (and the chart library) load only when "Insights" is opened
const DriveInsights = lazy(() => import('../components/charts/DriveInsights'));
import ApplicantTable from '../components/ApplicantTable';
import ApplicantDetailsModal from '../components/ApplicantDetailsModal';
import ConfirmDialog from '../components/ConfirmDialog';
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
  appliedFrom: '', appliedTo: '', account: '', answers: '', sort: 'newest',
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
  addOne(params, 'answers', filters.answers, ['note', 'all_questions']);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
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
      .get(`/api/admin/drives/${driveId}/applicants`, {
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
    const res = await api.patch(`/api/admin/drives/${driveId}/applicants/${applicant.id}`, changes);
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
      const res = await api.patch(`/api/admin/drives/${driveId}/applicants/bulk-status`, {
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

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.post(`/api/admin/drives/${driveId}/applicants/bulk-delete`, { applicationIds: [...selected] });
      toast.success(`${res.data.deleted} application${res.data.deleted === 1 ? '' : 's'} deleted`);
      // Emptied the last page: step back one so the list isn't left blank
      if (page > 1 && selected.size >= applicants.length) setPage(page - 1);
      else reload();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not delete applications.').message || 'Could not delete applications.');
    } finally {
      setIsDeleting(false);
    }
  };

  // From the details dialog: one application
  const handleDeleteOne = async (applicant) => {
    await api.post(`/api/admin/drives/${driveId}/applicants/bulk-delete`, { applicationIds: [applicant.id] });
    toast.success('Application deleted');
    setViewing(null);
    if (page > 1 && applicants.length === 1) setPage(page - 1);
    else reload();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.get(`/api/admin/drives/${driveId}/applicants/export`, {
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
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Applicants</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {drive ? `${drive.company} · ${drive.role}` : '…'} · {totalApplicants} total
        </p>
      </div>

      {/* Pipeline: the status split, the status chips (click to filter) and the insights */}
      <section className="mb-md p-sm md:p-md bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-soft" aria-labelledby="pipeline-heading">
        <div className="flex items-center justify-between gap-sm mb-xs">
          <h2 id="pipeline-heading" className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Pipeline</h2>
          <button
            type="button"
            onClick={() => setShowInsights((v) => !v)}
            aria-expanded={showInsights}
            aria-controls="drive-insights"
            className="-my-2 -mr-2 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">bar_chart</span>
            {showInsights ? 'Hide insights' : 'Show insights'}
            <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${showInsights ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
          </button>
        </div>

        <StatusStrip stats={stats} />

        {/* One swipeable row on phones, wrapping from sm up */}
        <div className="flex flex-nowrap sm:flex-wrap gap-x-1.5 gap-y-0 overflow-x-auto sm:overflow-visible -mx-sm px-sm sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by status">
          {[
            { key: 'all', label: 'All', count: totalApplicants, active: filters.status.length === 0, onClick: () => setFilter('status', []) },
            ...APPLICATION_STATUSES.map((s) => {
              const active = filters.status.includes(s);
              return {
                key: s, status: s, label: statusLabel(s), count: stats[s] ?? 0, active,
                onClick: () => setFilter('status', active ? filters.status.filter((x) => x !== s) : [...filters.status, s]),
              };
            }),
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={chip.active}
              onClick={chip.onClick}
              className="group/st shrink-0 inline-flex items-center min-h-[44px] rounded-full focus-visible:outline-hidden"
            >
              <span
                className={`inline-flex items-center gap-1.5 h-9 pl-3 pr-1.5 rounded-full font-label-md text-label-md transition-control group-active/st:scale-[0.96] group-focus-visible/st:ring-2 group-focus-visible/st:ring-primary ${
                  chip.active
                    ? chip.status ? `${STATUS_META[chip.status].pill} shadow-soft` : 'bg-inverse-surface text-inverse-on-surface shadow-soft'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                {chip.status && <span className={`w-2 h-2 rounded-full ${STATUS_META[chip.status].dot}`} aria-hidden="true" />}
                {chip.label}
                <span className={`min-w-6 px-1.5 rounded-full text-center tabular-nums ${chip.active ? 'bg-white/25' : 'bg-surface-container-highest/70'}`}>{chip.count}</span>
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {showInsights && (
            <m.div key="insights" id="drive-insights" {...dropDown} className="mt-sm">
              <Suspense fallback={<span className="skeleton h-64 rounded-2xl" role="status" aria-label="Loading the insights" />}>
                <DriveInsights driveId={driveId} reloadKey={reloadKey} />
              </Suspense>
            </m.div>
          )}
        </AnimatePresence>
      </section>

      <div className="mb-sm">
        <AdminFilterPanel
          searchLabel="Search applicants"
          searchPlaceholder="Name, email or roll number"
          values={filters}
          defaults={FILTER_DEFAULTS}
          onChange={setFilter}
          onReset={resetFilters}
          sortOptions={APPLICANT_SORTS}
          resultText={loading ? '' : `Showing ${applicants.length} of ${pagination.total} applicant${pagination.total === 1 ? '' : 's'}`}
          actions={
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || pagination.total === 0}
              aria-busy={isExporting}
              className={toolbarButtonClass}
            >
              <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'motion-safe:animate-bounce' : ''}`} aria-hidden="true">download</span>
              {/* Icon only on phones, so the toolbar stays on one row */}
              <span className="sr-only sm:not-sr-only">{isExporting ? 'Exporting…' : 'Export to Excel'}</span>
            </button>
          }
          // Status is filtered with the pipeline chips above
          fields={[
            { key: 'branch', group: 'Academic', label: 'Branch', type: 'select', options: [{ value: '', label: 'All branches' }, ...branches.map((b) => ({ value: b.code, label: b.name }))] },
            {
              key: 'institute', group: 'Academic', label: 'Institute', type: 'select',
              options: [{ value: '', label: 'All institutes' }, ...facets.institutes.map((i) => ({ value: i, label: i }))],
            },
            { key: 'account', group: 'Application', label: 'Account', type: 'select', options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active accounts' }, { value: 'deleted', label: 'Deleted accounts' }] },
            { key: 'cgpaMin', group: 'Academic', label: 'Min CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≥ ${v}` },
            { key: 'cgpaMax', group: 'Academic', label: 'Max CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≤ ${v}` },
            { key: 'backlogsMax', group: 'Academic', label: 'Max active backlogs', type: 'number', min: 0, max: 50, step: 1, chip: (v) => `Backlogs ≤ ${v}` },
            { key: 'appliedFrom', group: 'Application', label: 'Applied from', type: 'date', chip: (v) => `Applied from ${v}` },
            { key: 'appliedTo', group: 'Application', label: 'Applied until', type: 'date', chip: (v) => `Applied until ${v}` },
            {
              key: 'answers', group: 'Application', label: 'Answers', type: 'select',
              options: [
                { value: '', label: 'Any' },
                { value: 'note', label: 'Wrote a note' },
                ...(drive?.promptCount > 0 ? [{ value: 'all_questions', label: 'Answered every question' }] : []),
              ],
            },
            { key: 'gradYear', group: 'Academic', label: 'Graduation year', type: 'multi', options: facets.gradYears.map((y) => ({ value: String(y), label: String(y) })) },
          ]}
        />
      </div>

      {error && <div className="mb-md"><FormAlert>{error}</FormAlert></div>}

      {/* Bulk actions: a floating bar while rows are selected */}
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <span className="hidden sm:inline font-body-sm text-body-sm text-white/70" aria-hidden="true">Set status</span>
        <PillSelect
          id="bulk-status"
          label="Set status to"
          tone="dark"
          size="md"
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          options={APPLICATION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <button
          type="button"
          onClick={handleBulkUpdate}
          disabled={isBulkSaving}
          aria-busy={isBulkSaving}
          className="inline-flex items-center justify-center h-[44px] px-5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60 disabled:active:scale-100"
        >
          {isBulkSaving ? 'Updating…' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={isDeleting}
          aria-busy={isDeleting}
          className="sm:ml-2 inline-flex items-center justify-center gap-1.5 h-[44px] px-4 rounded-full font-label-md text-label-md text-red-300 hover:text-red-200 hover:bg-red-400/15 active:scale-[0.97] transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-300/70 disabled:opacity-60 disabled:active:scale-100"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </SelectionBar>

      {/* Room under the last rows for the floating bar while it is open */}
      <div className={`transition-[padding] duration-300 ease-out-soft ${selected.size > 0 ? 'pb-24' : ''}`}>
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
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleBulkDelete}
        title={selected.size === 1 ? 'Delete Application' : `Delete ${selected.size} Applications`}
        message={`${selected.size === 1 ? 'This application' : `These ${selected.size} applications`} to ${drive?.company || 'this drive'} will be removed for good, with ${selected.size === 1 ? 'its' : 'their'} status, your notes and the student's answers. The student can apply again while the drive is open. This action cannot be undone.`}
      />

      <ApplicantDetailsModal
        applicant={viewing}
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        onSave={async (applicant, changes) => {
          await saveApplicant(applicant, changes);
          toast.success('Changes saved');
        }}
        onDelete={handleDeleteOne}
        driveName={drive?.company}
      />
    </div>
  );
};

export default AdminApplicants;
