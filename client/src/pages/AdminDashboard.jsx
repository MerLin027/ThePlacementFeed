import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import PlacementForm from '../components/PlacementForm';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import IconAction from '../components/IconAction';
import Pagination from '../components/Pagination';
import { usePlacementsFetch } from '../hooks/usePlacementsFetch';
import Spinner from '../components/Spinner';
import { TableRowsSkeleton } from '../components/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { FormAlert } from '../components/AuthCard';
import { useCatalog } from '../stores/catalog';

// The charts (and their library) load as a separate chunk after the page itself
const DashboardInsights = lazy(() => import('../components/charts/DashboardInsights'));

// Headings and cells are centred; the company / role column stays left-aligned
const thClass = 'text-center px-sm py-sm font-label-sm text-label-sm font-semibold text-on-surface/80 uppercase tracking-wider whitespace-nowrap';
// The status and action renderers are shared with the phone cards: centre them only in table cells
const centredCell = 'px-sm py-sm text-center [&>div]:items-center [&>div]:justify-center';

const AdminDashboard = () => {
  const catalog = useCatalog();
  usePageTitle('Admin Dashboard');
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const { loading, fetchPlacements } = usePlacementsFetch('/api/admin/drives');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Applications that will be deleted along with the drive. The count is stored with the drive it
  // belongs to, so it reads as null (loading) for any other drive without resetting it in the effect.
  const [appCount, setAppCount] = useState({ id: null, count: null });
  const deleteAppCount = deleteTarget && appCount.id === deleteTarget._id ? appCount.count : null;

  useEffect(() => {
    if (!deleteTarget) return undefined;
    const controller = new AbortController();
    const id = deleteTarget._id;
    api
      .get(`/api/admin/drives/${id}/application-count`, { signal: controller.signal })
      .then((res) => setAppCount({ id, count: res.data.data.count }))
      .catch(() => setAppCount({ id, count: null }));
    return () => controller.abort();
  }, [deleteTarget]);

  // Search
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState({});
  const [toggleError, setToggleError] = useState({});

  const loadPlacements = useCallback(async (page = 1) => {
    const params = { page, limit: 15, sort: 'newest' };
    if (search) params.search = search;
    const res = await fetchPlacements(params);
    if (res && res.data) {
      setPlacements(res.data);
      setPagination(res.pagination);
    }
  }, [search, fetchPlacements]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPlacements(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadPlacements]);

  const handleAdd = async (data) => {
    // Do NOT wrap in try/catch here — let errors propagate up to
    // PlacementForm's own catch block, which displays them in the form.
    await api.post('/api/admin/drives', data);
    // Only close and refresh on success
    setShowForm(false);
    loadPlacements(1);
  };

  const handleEdit = async (data) => {
    // Do NOT wrap in try/catch here — let errors propagate up to
    // PlacementForm's own catch block, which displays them in the form.
    await api.put(`/api/admin/drives/${editingPlacement._id}`, data);
    // Only close and refresh on success
    setEditingPlacement(null);
    setShowForm(false);
    loadPlacements(pagination.page);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/drives/${deleteTarget._id}`);
      loadPlacements(pagination.page);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openAdd = () => {
    setEditingPlacement(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingPlacement(p);
    setShowForm(true);
  };

  const handlePostponeToggle = async (p) => {
    const id = p._id;
    setToggling((prev) => ({ ...prev, [id]: true }));
    setToggleError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await api.patch(`/api/admin/drives/${id}/postpone`, {
        isPostponed: !p.isPostponed,
      });
      // Update only this row in state; no full refetch
      setPlacements((prev) =>
        prev.map((item) => (item._id === id ? res.data.data : item))
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update — please try again';
      setToggleError((prev) => ({ ...prev, [id]: msg }));
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleResetStatusAutomation = async (p) => {
    const id = p._id;
    setToggling((prev) => ({ ...prev, [id]: true }));
    setToggleError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await api.patch(`/api/admin/drives/${id}/status-automation`, {
        statusManuallySet: false,
      });
      setPlacements((prev) =>
        prev.map((item) => (item._id === id ? res.data.data : item))
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset — please try again';
      setToggleError((prev) => ({ ...prev, [id]: msg }));
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Shared by the desktop table row and the mobile card (plain render functions, not
  // components, so rows keep their DOM — and keyboard focus — across re-renders)
  const renderRowActions = (p) => (
    <div className="flex items-center justify-end gap-1">
      <IconAction to={`/admin/drives/${p._id}/applicants`} icon="group" label={`Applicants for ${p.company}`} tooltip="Applicants" />
      <IconAction onClick={() => openEdit(p)} icon="edit" label={`Edit ${p.company}`} tooltip="Edit" />
      <IconAction onClick={() => setDeleteTarget(p)} icon="delete" label={`Delete ${p.company}`} tooltip="Delete" danger />
    </div>
  );

  const renderStatusControls = (p) => (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => !toggling[p._id] && handlePostponeToggle(p)}
        aria-disabled={!!toggling[p._id]}
        aria-busy={!!toggling[p._id]}
        title={p.isPostponed ? 'Un-postpone' : 'Mark as postponed'}
        className={`relative isolate inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full font-label-md text-label-md transition-colors duration-200 before:absolute before:inset-x-0 before:inset-y-1.5 before:-z-10 before:rounded-full before:transition-colors before:duration-200 active:before:scale-95 aria-disabled:opacity-60 aria-disabled:cursor-wait focus-visible:outline-hidden focus-visible:before:ring-2 focus-visible:before:ring-primary ${
          p.isPostponed
            ? 'text-red-800 before:bg-red-50 before:border before:border-red-200 hover:before:bg-red-100'
            : 'text-on-surface-variant hover:text-on-surface before:border before:border-outline-variant hover:before:bg-surface-container-low'
        }`}
      >
        {toggling[p._id] ? (
          <Spinner size="xs" tone="current" />
        ) : (
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            {p.isPostponed ? 'undo' : 'pause_circle'}
          </span>
        )}
        {p.isPostponed ? 'Un-postpone' : 'Postpone'}
        {/* The accessible name starts with the visible text (WCAG 2.5.3), e.g. "Postpone Infosys" */}
        <span className="sr-only">{` ${p.company}`}</span>
      </button>

      {p.statusManuallySet && (
        <button
          type="button"
          onClick={() => !toggling[p._id] && handleResetStatusAutomation(p)}
          aria-disabled={!!toggling[p._id]}
          aria-busy={!!toggling[p._id]}
          title="Status is fixed by hand. Click to let it follow the dates again."
          className="relative isolate inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full font-label-md text-label-md transition-colors duration-200 before:absolute before:inset-x-0 before:inset-y-1.5 before:-z-10 before:rounded-full before:transition-colors before:duration-200 active:before:scale-95 aria-disabled:opacity-60 aria-disabled:cursor-wait focus-visible:outline-hidden focus-visible:before:ring-2 focus-visible:before:ring-primary text-on-primary-fixed-variant before:bg-primary-fixed/60 hover:before:bg-primary-fixed"
        >
          {toggling[p._id] ? (
            <Spinner size="xs" tone="current" />
          ) : (
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">restart_alt</span>
          )}
          Use automatic status
        </button>
      )}

      {toggleError[p._id] && (
        <p className="font-label-sm text-label-sm text-error" role="alert">{toggleError[p._id]}</p>
      )}
    </div>
  );

  const renderStatusCell = (p) => (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={p.status} isPostponed={p.isPostponed} />
      {p.statusManuallySet && !p.isPostponed && (
        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">push_pin</span>
          Fixed status
        </span>
      )}
    </div>
  );

  const emptyText = search ? 'No drives match your search.' : 'No drives yet. Use "Add placement" to post the first one.';

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-sm mb-md">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface">Admin Dashboard</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Manage placement drives · <span className="tabular-nums">{pagination.total}</span> total
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary gap-2">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          Add placement
        </button>
      </div>

      {/* Students need an institute to apply, and none exist until the admin adds them */}
      {catalog.loaded && catalog.institutes.length === 0 && (
        <div className="mb-md">
          <FormAlert tone="warning" icon="warning">
            <p className="font-semibold">Students can&apos;t apply in-app yet</p>
            <p className="mt-[2px]">
              Every student needs an institute before applying, and there are none to choose from.{' '}
              <Link to="/admin/settings" className="font-semibold underline underline-offset-2">Add institutes in Setup</Link>.
            </p>
          </FormAlert>
        </div>
      )}

      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm mb-lg" role="status" aria-label="Loading the overview">
            {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        }
      >
        <DashboardInsights />
      </Suspense>

      <h2 id="drives-heading" className="font-headline-md text-headline-md text-on-surface mb-sm">Drives</h2>

      {/* Search */}
      <div className="mb-md">
        <div className="group/s relative max-w-(--container-md)">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within/s:text-primary transition-colors duration-200" aria-hidden="true">search</span>
          <input
            type="search"
            aria-label="Search drives"
            placeholder="Search by company or role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field rounded-full! pl-11! shadow-soft focus:shadow-glow"
          />
        </div>
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-soft border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th scope="col" className={`${thClass} text-left!`}>Company / role</th>
                <th scope="col" className={`${thClass} hidden lg:table-cell`}>Type</th>
                <th scope="col" className={thClass}>CTC</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Controls</th>
                <th scope="col" className={`${thClass} hidden lg:table-cell`}>Drive date</th>
                <th scope="col" className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {loading ? (
                <TableRowsSkeleton columns={7} label="Loading drives" />
              ) : placements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-sm py-xl text-center font-body-sm text-body-sm text-on-surface-variant">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                placements.map((p) => (
                  <tr key={p._id} className="even:bg-surface-container-low/60 hover:bg-primary/4 transition-colors">
                    <td className="px-sm py-sm">
                      <p className="font-label-md text-label-md text-on-surface">{p.company}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{p.role}</p>
                    </td>
                    <td className="px-sm py-sm hidden lg:table-cell text-center font-body-md text-body-md text-on-surface">{p.type}</td>
                    <td className="px-sm py-sm text-center font-label-md text-label-md text-on-surface whitespace-nowrap tabular-nums">₹{p.ctc} LPA</td>
                    <td className={centredCell}>{renderStatusCell(p)}</td>
                    <td className={centredCell}>{renderStatusControls(p)}</td>
                    <td className="px-sm py-sm hidden lg:table-cell text-center font-body-md text-body-md text-on-surface whitespace-nowrap tabular-nums">
                      {formatDate(p.driveDate)}
                    </td>
                    <td className={centredCell}>{renderRowActions(p)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones: one card per drive instead of a squeezed table */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-xs" role="status" aria-label="Loading drives">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm space-y-xs" aria-hidden="true">
                <span className="skeleton h-5 w-2/3" />
                <span className="skeleton h-4 w-1/3" />
                <span className="skeleton h-[44px] w-full" />
              </div>
            ))}
          </div>
        ) : placements.length === 0 ? (
          <p className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft px-sm py-lg text-center font-body-sm text-body-sm text-on-surface-variant">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-xs" aria-label="Drives">
            {placements.map((p) => (
              <li key={p._id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-on-surface">{p.company}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{p.role}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      <span className="tabular-nums text-on-surface">₹{p.ctc} LPA</span> · {p.type} · {formatDate(p.driveDate)}
                    </p>
                  </div>
                  {renderStatusCell(p)}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-xs mt-xs pt-xs border-t border-surface-variant">
                  {renderStatusControls(p)}
                  {renderRowActions(p)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(newPage) => {
          if (newPage >= 1 && newPage <= pagination.totalPages) {
            loadPlacements(newPage);
            document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingPlacement(null); }}
        title={editingPlacement ? 'Edit Placement' : 'Add Placement'}
        maxWidth="max-w-3xl"
      >
        <PlacementForm
          initialData={editingPlacement}
          onSubmit={editingPlacement ? handleEdit : handleAdd}
          onCancel={() => { setShowForm(false); setEditingPlacement(null); }}
        />
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Placement"
        message={`Are you sure you want to delete the ${deleteTarget?.company} — ${deleteTarget?.role} placement?${
          deleteAppCount > 0
            ? ` Its ${deleteAppCount} student application${deleteAppCount === 1 ? '' : 's'} will be deleted too.`
            : ''
        } This action cannot be undone.`}
      />
    </div>
  );
};

export default AdminDashboard;
