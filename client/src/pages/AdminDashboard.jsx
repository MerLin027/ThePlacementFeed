import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import PlacementForm from '../components/PlacementForm';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import { usePlacementsFetch } from '../hooks/usePlacementsFetch';
import Spinner from '../components/Spinner';
import { TableRowsSkeleton } from '../components/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';

const thClass = 'text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider';
const iconButton =
  'inline-flex items-center justify-center w-[44px] h-[44px] rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const AdminDashboard = () => {
  usePageTitle('Admin dashboard');
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const { loading, fetchPlacements } = usePlacementsFetch();

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Applications that will be deleted along with the drive (null while loading)
  const [deleteAppCount, setDeleteAppCount] = useState(null);

  useEffect(() => {
    if (!deleteTarget) return undefined;
    const controller = new AbortController();
    setDeleteAppCount(null);
    api
      .get(`/api/placements/${deleteTarget._id}/application-count`, { signal: controller.signal })
      .then((res) => setDeleteAppCount(res.data.data.count))
      .catch(() => setDeleteAppCount(null));
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
    await api.post('/api/placements', data);
    // Only close and refresh on success
    setShowForm(false);
    loadPlacements(1);
  };

  const handleEdit = async (data) => {
    // Do NOT wrap in try/catch here — let errors propagate up to
    // PlacementForm's own catch block, which displays them in the form.
    await api.put(`/api/placements/${editingPlacement._id}`, data);
    // Only close and refresh on success
    setEditingPlacement(null);
    setShowForm(false);
    loadPlacements(pagination.page);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/placements/${deleteTarget._id}`);
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
      const res = await api.patch(`/api/placements/${id}/postpone`, {
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
      const res = await api.patch(`/api/placements/${id}/reset-status-automation`, {
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
      <Link
        to={`/admin/drives/${p._id}/applicants`}
        className={iconButton}
        title="Applicants"
        aria-label={`Applicants for ${p.company}`}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">group</span>
      </Link>
      <button type="button" onClick={() => openEdit(p)} className={iconButton} title="Edit" aria-label={`Edit ${p.company}`}>
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
      </button>
      <button
        type="button"
        onClick={() => setDeleteTarget(p)}
        className={`${iconButton} hover:!text-error hover:!bg-error-container`}
        title="Delete"
        aria-label={`Delete ${p.company}`}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
      </button>
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
        aria-label={p.isPostponed ? `Un-postpone ${p.company}` : `Mark ${p.company} as postponed`}
        className={`inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg font-label-md text-label-md transition-colors duration-200 aria-disabled:opacity-60 aria-disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          p.isPostponed
            ? 'bg-red-100 text-red-800 hover:bg-red-200'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-surface-variant'
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
      </button>

      {p.statusManuallySet && (
        <button
          type="button"
          onClick={() => !toggling[p._id] && handleResetStatusAutomation(p)}
          aria-disabled={!!toggling[p._id]}
          aria-busy={!!toggling[p._id]}
          title="Status is fixed by hand. Click to let it follow the dates again."
          className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg font-label-md text-label-md bg-primary-fixed text-on-primary-fixed hover:bg-primary/15 transition-colors duration-200 aria-disabled:opacity-60 aria-disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          <h1 className="font-display-lg text-display-lg text-on-surface">Admin dashboard</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Manage placement drives · <span className="tabular-nums">{pagination.total}</span> total
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary gap-2">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          Add placement
        </button>
      </div>

      {/* Search */}
      <div className="mb-md">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]" aria-hidden="true">search</span>
          <input
            type="search"
            aria-label="Search drives"
            placeholder="Search placements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden md:block bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th scope="col" className={thClass}>Company / role</th>
                <th scope="col" className={`${thClass} hidden lg:table-cell`}>Type</th>
                <th scope="col" className={thClass}>CTC</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Controls</th>
                <th scope="col" className={`${thClass} hidden lg:table-cell`}>Drive date</th>
                <th scope="col" className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
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
                  <tr key={p._id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="px-sm py-sm">
                      <p className="font-label-md text-label-md text-on-surface">{p.company}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{p.role}</p>
                    </td>
                    <td className="px-sm py-sm hidden lg:table-cell font-body-sm text-body-sm text-on-surface-variant">{p.type}</td>
                    <td className="px-sm py-sm font-label-md text-label-md text-on-surface whitespace-nowrap">₹{p.ctc} LPA</td>
                    <td className="px-sm py-sm">{renderStatusCell(p)}</td>
                    <td className="px-sm py-sm">{renderStatusControls(p)}</td>
                    <td className="px-sm py-sm hidden lg:table-cell font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                      {formatDate(p.driveDate)}
                    </td>
                    <td className="px-sm py-sm">{renderRowActions(p)}</td>
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
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm space-y-xs" aria-hidden="true">
                <span className="skeleton h-5 w-2/3" />
                <span className="skeleton h-4 w-1/3" />
                <span className="skeleton h-[44px] w-full" />
              </div>
            ))}
          </div>
        ) : placements.length === 0 ? (
          <p className="bg-surface-container-lowest border border-outline-variant rounded-xl px-sm py-lg text-center font-body-sm text-body-sm text-on-surface-variant">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-xs" aria-label="Drives">
            {placements.map((p) => (
              <li key={p._id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm">
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
        title={editingPlacement ? 'Edit placement' : 'Add placement'}
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
        title="Delete placement"
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
