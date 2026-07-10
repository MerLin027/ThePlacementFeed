import { useState, useEffect, useCallback } from 'react';
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

  const fetchPlacements = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 15, sort: 'newest' };
      if (search) params.search = search;
      const res = await api.get('/api/placements', { params });
      setPlacements(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage placement drives · {pagination.total} total
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
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
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Company / Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">CTC</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Drive Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full border-4 border-slate-200" />
                        <div className="w-8 h-8 rounded-full border-4 border-brand-600 border-t-transparent animate-spin absolute inset-0" />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : placements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No placements found. Click "Add Placement" to create one.
                  </td>
                </tr>
              ) : (
                placements.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 text-sm">{p.company}</p>
                      <p className="text-xs text-slate-500">{p.role}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-slate-600">{p.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">₹{p.ctc} LPA</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-slate-500">
                      {formatDate(p.driveDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
