import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { FormAlert } from '../components/AuthCard';
import { BRANCHES, branchLabel } from '../constants/branches';
import { parseApiError } from '../utils/formErrors';
import { TableRowsSkeleton } from '../components/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 25;

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const displayName = (s) => `${s.firstName} ${s.lastName}`.trim() || s.rollNumber;

const thClass = 'text-left px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider';

const ActionButton = ({ icon, label, onClick, disabled, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-2 rounded-full font-label-sm text-label-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed ${
      danger
        ? 'text-on-surface-variant hover:text-error hover:bg-error-container'
        : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'
    }`}
  >
    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const AdminStudents = () => {
  usePageTitle('Students');
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: 'reset' | 'delete', student }
  const [reloadKey, setReloadKey] = useState(0);
  // Each finished request records the key of the parameters it answered; until the latest one
  // matches the current parameters the list is loading (derived instead of reset in the effect)
  const requestKey = JSON.stringify([page, debouncedSearch, branch, reloadKey]);
  const [settled, setSettled] = useState({ key: null, error: '' });
  const loading = settled.key !== requestKey;
  const error = loading ? '' : settled.error;

  // Debounce search; any filter change goes back to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const key = JSON.stringify([page, debouncedSearch, branch, reloadKey]);
    const params = { page, limit: PAGE_SIZE };
    if (debouncedSearch) params.search = debouncedSearch;
    if (branch) params.branch = branch;

    api
      .get('/api/admin/students', { params, signal: controller.signal })
      .then((res) => {
        setStudents(res.data.data);
        setPagination(res.data.pagination);
        setSettled({ key, error: '' });
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setSettled({ key, error: parseApiError(err, 'Could not load students.').message });
      });
    return () => controller.abort();
  }, [page, debouncedSearch, branch, reloadKey]);

  const closeConfirm = useCallback(() => setConfirm(null), []);

  const handleReset = async (student) => {
    setBusyId(student.id);
    try {
      const res = await api.post(`/api/admin/students/${student.id}/reset-password`);
      setStudents((prev) => prev.map((s) => (s.id === student.id ? res.data.data : s)));
      toast.success(`${displayName(student)}'s password was reset to the default. They'll choose a new one at their next login.`, { duration: 6000 });
    } catch (err) {
      toast.error(parseApiError(err, 'Could not reset the password.').message || 'Could not reset the password.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (student) => {
    setBusyId(student.id);
    try {
      await api.delete(`/api/admin/students/${student.id}`);
      toast.success(`${displayName(student)}'s account was deleted.`);
      // Step back a page if this was the last row on it
      if (students.length === 1 && page > 1) setPage(page - 1);
      else setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(parseApiError(err, 'Could not delete the account.').message || 'Could not delete the account.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmProps =
    confirm?.type === 'reset'
      ? {
          title: 'Reset password?',
          message: `${displayName(confirm.student)}'s password will be set to the default student password and they'll be signed out everywhere. Share it with them in person — they'll be asked to choose a new one when they next log in, within 72 hours.`,
          confirmLabel: 'Reset password',
          tone: 'primary',
          icon: 'key',
          onConfirm: () => handleReset(confirm.student),
        }
      : confirm?.type === 'delete'
        ? {
            title: 'Delete account?',
            message: `Delete ${displayName(confirm.student)}'s account (${confirm.student.rollNumber})? Their applications are kept for your records, but their personal details are removed. They can sign up again afterwards. This can't be undone.`,
            confirmLabel: 'Delete account',
            tone: 'danger',
            onConfirm: () => handleDelete(confirm.student),
          }
        : null;

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      {/* Header */}
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Students</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Registered student accounts · {pagination.total} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-sm mb-md">
        <div className="group/s relative w-full sm:max-w-(--container-md)">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within/s:text-primary transition-colors duration-200" aria-hidden="true">search</span>
          <input
            type="search"
            placeholder="Search by name, email or roll number"
            aria-label="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            className="input-field rounded-full! pl-11! hover:shadow-soft"
          />
        </div>
        <select
          aria-label="Filter by branch"
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPage(1);
          }}
          className="select-field sm:max-w-(--container-xs)"
        >
          <option value="">All branches</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{branchLabel(b)}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-md"><FormAlert>{error}</FormAlert></div>}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-soft border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className={thClass}>Student</th>
                <th className={`${thClass} hidden md:table-cell`}>Email</th>
                <th className={`${thClass} hidden sm:table-cell`}>Branch</th>
                <th className={`${thClass} hidden lg:table-cell`}>Grad year</th>
                <th className={`${thClass} hidden lg:table-cell`}>Joined</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {loading ? (
                <TableRowsSkeleton columns={6} label="Loading students" />
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-sm py-xl text-center font-body-sm text-body-sm text-on-surface-variant">
                    {debouncedSearch || branch ? 'No students match these filters.' : 'No students have signed up yet.'}
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-sm py-xs">
                      <p className="font-label-md text-label-md text-on-surface">
                        {`${s.firstName} ${s.lastName}`.trim() || <span className="text-on-surface-variant italic font-normal">Name not added yet</span>}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{s.rollNumber}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant md:hidden break-all">{s.email}</p>
                      {s.mustChangePassword && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-[2px] rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
                          Password reset pending
                        </span>
                      )}
                    </td>
                    <td className="px-sm py-xs hidden md:table-cell font-body-sm text-body-sm text-on-surface break-all">{s.email}</td>
                    <td className="px-sm py-xs hidden sm:table-cell font-body-sm text-body-sm text-on-surface">
                      {s.branch ? branchLabel(s.branch) : '—'}
                    </td>
                    <td className="px-sm py-xs hidden lg:table-cell font-body-sm text-body-sm text-on-surface">{s.graduationYear ?? '—'}</td>
                    <td className="px-sm py-xs hidden lg:table-cell font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td className="px-sm py-xs">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton
                          icon="key"
                          label="Reset password"
                          disabled={busyId === s.id}
                          onClick={() => setConfirm({ type: 'reset', student: s })}
                        />
                        <ActionButton
                          icon="delete"
                          label="Delete account"
                          danger
                          disabled={busyId === s.id}
                          onClick={() => setConfirm({ type: 'delete', student: s })}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />

      <ConfirmDialog isOpen={Boolean(confirmProps)} onClose={closeConfirm} {...(confirmProps || {})} />
    </div>
  );
};

export default AdminStudents;
