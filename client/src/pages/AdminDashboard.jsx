import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PlacementForm from '../components/PlacementForm';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Search
  const [search, setSearch] = useState('');
  const abortControllerRef = useRef(null);

  const fetchPlacements = useCallback(async (page = 1) => {
    setLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const params = { page, limit: 15, sort: 'newest' };
      if (search) params.search = search;
      const res = await api.get('/api/placements', { 
        params,
        signal: abortController.signal
      });
      setPlacements(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('Failed to fetch:', err);
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  }, [search]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPlacements(1), 300);
    return () => clearTimeout(timer);
  }, [fetchPlacements]);

  const handleAdd = async (data) => {
    await api.post('/api/placements', data);
    setShowForm(false);
    fetchPlacements(1);
  };

  const handleEdit = async (data) => {
    await api.put(`/api/placements/${editingPlacement._id}`, data);
    setEditingPlacement(null);
    setShowForm(false);
    fetchPlacements(pagination.page);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/placements/${deleteTarget._id}`);
      fetchPlacements(pagination.page);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-sm mb-md">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface">Admin Dashboard</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Manage placement drives · {pagination.total} total
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button onClick={openAdd} className="btn-primary gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Placement
          </button>
          <button onClick={logout} className="btn-secondary gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-md">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search placements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Company / Role</th>
                <th className="text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">CTC</th>
                <th className="text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Drive Date</th>
                <th className="text-right px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-sm py-xl text-center">
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full border-4 border-outline-variant" />
                        <div className="w-8 h-8 rounded-full border-4 border-primary-container border-t-transparent animate-spin absolute inset-0" />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : placements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-sm py-xl text-center font-body-sm text-body-sm text-on-surface-variant">
                    No placements found. Click &quot;Add Placement&quot; to create one.
                  </td>
                </tr>
              ) : (
                placements.map((p) => (
                  <tr key={p._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-sm py-sm">
                      <p className="font-label-md text-label-md text-on-surface">{p.company}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{p.role}</p>
                    </td>
                    <td className="px-sm py-sm hidden sm:table-cell">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{p.type}</span>
                    </td>
                    <td className="px-sm py-sm">
                      <span className="font-label-md text-label-md text-on-surface">₹{p.ctc} LPA</span>
                    </td>
                    <td className="px-sm py-sm hidden md:table-cell">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-sm py-sm hidden lg:table-cell font-body-sm text-body-sm text-on-surface-variant">
                      {formatDate(p.driveDate)}
                    </td>
                    <td className="px-sm py-sm text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-outline hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-2 text-outline hover:text-error hover:bg-error-container rounded-lg transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(page) => fetchPlacements(page)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingPlacement(null); }}
        title={editingPlacement ? 'Edit Placement' : 'Add New Placement'}
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
        message={`Are you sure you want to delete the ${deleteTarget?.company} — ${deleteTarget?.role} placement? This action cannot be undone.`}
      />
    </div>
  );
};

export default AdminDashboard;
