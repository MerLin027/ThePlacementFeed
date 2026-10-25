import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import TwoStepConfirmDialog from '../components/TwoStepConfirmDialog';
import Pagination from '../components/Pagination';
import { FormAlert } from '../components/AuthCard';
import { useCatalog } from '../stores/catalog';
import AdminFilterPanel from '../components/AdminFilterPanel';
import IconAction from '../components/IconAction';
import { STUDENT_SORTS } from '../constants/applications';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { addNumber, addList, addOne, addDay, gradYearOptions } from '../utils/filterParams';
import { parseApiError } from '../utils/formErrors';
import { TableRowsSkeleton } from '../components/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 25;
const NONE = '__none'; // "not set" option for branch / institute

const FILTER_DEFAULTS = {
  search: '', branch: '', institute: '', gradYear: [], profile: '', cgpaMin: '', cgpaMax: '', backlogsMax: '',
  account: '', applications: '', joinedFrom: '', joinedTo: '', sort: 'newest',
};
const SORT_VALUES = STUDENT_SORTS.map((s) => s.value);

// Query params for the list; empty / invalid values are left out
const toParams = (filters, search) => {
  const params = { sort: SORT_VALUES.includes(filters.sort) ? filters.sort : 'newest' };
  if (search) params.search = search;
  addOne(params, 'branch', filters.branch);
  addOne(params, 'institute', filters.institute);
  addList(params, 'gradYear', filters.gradYear.filter((y) => /^\d{4}$/.test(y)));
  addOne(params, 'profile', filters.profile, ['complete', 'incomplete', 'no_institute']);
  addNumber(params, 'cgpaMin', filters.cgpaMin, { min: 0, max: 10 });
  addNumber(params, 'cgpaMax', filters.cgpaMax, { min: 0, max: 10 });
  addNumber(params, 'backlogsMax', filters.backlogsMax, { min: 0, max: 50, int: true });
  addOne(params, 'account', filters.account, ['reset_pending']);
  addOne(params, 'applications', filters.applications, ['applied', 'never', 'selected']);
  addDay(params, 'joinedFrom', filters.joinedFrom);
  addDay(params, 'joinedTo', filters.joinedTo);
  return params;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const displayName = (s) => `${s.firstName} ${s.lastName}`.trim() || s.rollNumber;

// Headings and cells are centred; the student column (name, roll number, badges) stays left-aligned
const thClass = 'text-center px-sm py-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider';


const AdminStudents = () => {
  const { branches, branchLabel, institutes } = useCatalog();
  usePageTitle('Students');
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [filters, setFilter, resetFilters] = useUrlFilters(FILTER_DEFAULTS);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search.trim());
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: 'reset' | 'resetInstitute' | 'delete', student, applications? }
  const [reloadKey, setReloadKey] = useState(0);
  // Each finished request records the key of the parameters it answered; until the latest one
  // matches the current parameters the list is loading (derived instead of reset in the effect)
  const paramsKey = JSON.stringify(toParams(filters, debouncedSearch));
  // Any filter change goes back to page 1 (adjusted during render, as on the Applicants page)
  const [pageFilters, setPageFilters] = useState(paramsKey);
  if (pageFilters !== paramsKey) {
    setPageFilters(paramsKey);
    setPage(1);
  }
  const requestKey = JSON.stringify([page, paramsKey, reloadKey]);
  const [settled, setSettled] = useState({ key: null, error: '' });
  const loading = settled.key !== requestKey;
  const error = loading ? '' : settled.error;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    const key = JSON.stringify([page, paramsKey, reloadKey]);
    const params = { ...JSON.parse(paramsKey), page, limit: PAGE_SIZE };

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
  }, [page, paramsKey, reloadKey]);

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

  const handleResetInstitute = async (student) => {
    setBusyId(student.id);
    try {
      const res = await api.post(`/api/admin/students/${student.id}/reset-institute`);
      setStudents((prev) => prev.map((s) => (s.id === student.id ? res.data.data : s)));
      toast.success(`${displayName(student)} can choose their institute again.`);
    } catch (err) {
      toast.error(parseApiError(err, 'Could not reset the institute.').message || 'Could not reset the institute.');
    } finally {
      setBusyId(null);
    }
  };

  // The second prompt needs the number of applications, so it is fetched before the dialog opens
  const openDelete = async (student) => {
    setBusyId(student.id);
    let applications = null;
    try {
      const res = await api.get(`/api/admin/students/${student.id}/application-count`);
      applications = res.data.data.count;
    } catch {
      // Unknown count: still ask what to do with any applications
    } finally {
      setBusyId(null);
    }
    setConfirm({ type: 'delete', student, applications });
  };

  // mode: 'retain' keeps the applications (personal details removed), 'delete' removes them too
  const handleDelete = async (student, mode) => {
    setBusyId(student.id);
    try {
      await api.delete(`/api/admin/students/${student.id}`, { params: { applications: mode } });
      toast.success(
        mode === 'delete'
          ? `${displayName(student)}'s account and applications were deleted.`
          : `${displayName(student)}'s account was deleted. Their applications were kept without personal details.`
      );
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
      : confirm?.type === 'resetInstitute'
        ? {
            title: 'Reset institute?',
            message: `${displayName(confirm.student)} chose ${confirm.student.institute?.name}. Resetting lets them choose again from their profile. They can't apply to drives until they do.`,
            confirmLabel: 'Reset institute',
            tone: 'primary',
            icon: 'restart_alt',
            onConfirm: () => handleResetInstitute(confirm.student),
          }
        : null;

  const deleteTarget = confirm?.type === 'delete' ? confirm : null;
  const appCount = deleteTarget?.applications;
  const appsNoun = appCount == null ? 'their applications' : `their ${appCount} application${appCount === 1 ? '' : 's'}`;
  const deleteFirst = deleteTarget && {
    title: 'Delete account?',
    message: `Delete ${displayName(deleteTarget.student)}'s account (${deleteTarget.student.rollNumber})? They can sign up again afterwards. This can't be undone.`,
    confirmLabel: 'Delete account',
    icon: 'person_remove',
    // Used only when there are no applications, so there is nothing to choose between
    onConfirm: () => handleDelete(deleteTarget.student, 'retain'),
  };
  const deleteSecond = deleteTarget && appCount !== 0 ? {
    title: 'What about their applications?',
    icon: 'folder_delete',
    message: (
      <>
        <p>Choose what happens to {appsNoun}.</p>
        <p><strong className="text-on-surface">Keep the records:</strong> drive lists, counts and exports keep them, marked as a deleted account, without name, email, phone, resume or answers.</p>
        <p><strong className="text-on-surface">Delete the records:</strong> they are removed from every drive for good.</p>
      </>
    ),
    actions: [
      { label: 'Keep the records', tone: 'primary', onClick: () => handleDelete(deleteTarget.student, 'retain') },
      { label: 'Delete the records', tone: 'danger', onClick: () => handleDelete(deleteTarget.student, 'delete') },
    ],
  } : null;

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      {/* Header */}
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Students</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Registered student accounts · {pagination.total} total
        </p>
      </div>

      <AdminFilterPanel
        searchLabel="Search students"
        searchPlaceholder="Name, email or roll number"
        values={filters}
        defaults={FILTER_DEFAULTS}
        onChange={setFilter}
        onReset={resetFilters}
        sortOptions={STUDENT_SORTS}
        resultText={loading ? '' : `Showing ${students.length} of ${pagination.total} student${pagination.total === 1 ? '' : 's'}`}
        fields={[
          {
            key: 'branch', group: 'Academic', label: 'Branch', type: 'select',
            options: [{ value: '', label: 'All branches' }, { value: NONE, label: 'Not set' }, ...branches.map((b) => ({ value: b.code, label: `${b.name}${b.active ? '' : ' (archived)'}` }))],
          },
          {
            key: 'institute', group: 'Academic', label: 'Institute', type: 'select',
            options: [{ value: '', label: 'All institutes' }, { value: NONE, label: 'Not chosen yet' }, ...institutes.map((i) => ({ value: i.id, label: i.name }))],
          },
          {
            key: 'profile', group: 'Account', label: 'Profile', type: 'select',
            options: [{ value: '', label: 'Any' }, { value: 'complete', label: 'Complete' }, { value: 'incomplete', label: 'Incomplete' }, { value: 'no_institute', label: 'No institute chosen' }],
          },
          {
            key: 'applications', group: 'Account', label: 'Applications', type: 'select',
            options: [{ value: '', label: 'Any' }, { value: 'applied', label: 'Has applied' }, { value: 'never', label: 'Never applied' }, { value: 'selected', label: 'Selected somewhere' }],
          },
          { key: 'cgpaMin', group: 'Academic', label: 'Min CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≥ ${v}` },
          { key: 'cgpaMax', group: 'Academic', label: 'Max CGPA', type: 'number', min: 0, max: 10, step: 0.1, chip: (v) => `CGPA ≤ ${v}` },
          { key: 'backlogsMax', group: 'Academic', label: 'Max active backlogs', type: 'number', min: 0, max: 50, step: 1, chip: (v) => `Backlogs ≤ ${v}` },
          { key: 'account', group: 'Account', label: 'Account', type: 'select', options: [{ value: '', label: 'All' }, { value: 'reset_pending', label: 'Password reset pending' }] },
          { key: 'joinedFrom', group: 'Account', label: 'Joined from', type: 'date', chip: (v) => `Joined from ${v}` },
          { key: 'joinedTo', group: 'Account', label: 'Joined until', type: 'date', chip: (v) => `Joined until ${v}` },
          { key: 'gradYear', group: 'Academic', label: 'Graduation year', type: 'multi', options: gradYearOptions().map((y) => ({ value: y, label: y })) },
        ]}
      />

      {error && <div className="mb-md"><FormAlert>{error}</FormAlert></div>}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-soft border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className={`${thClass} text-left!`}>Student</th>
                <th className={`${thClass} hidden md:table-cell`}>Email</th>
                <th className={`${thClass} hidden sm:table-cell`}>Branch</th>
                <th className={`${thClass} hidden md:table-cell`}>Institute</th>
                <th className={`${thClass} hidden lg:table-cell`}>Grad year</th>
                <th className={`${thClass} hidden lg:table-cell`}>Applications</th>
                <th className={`${thClass} hidden lg:table-cell`}>Joined</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {loading ? (
                <TableRowsSkeleton columns={8} label="Loading students" />
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-sm py-xl text-center font-body-sm text-body-sm text-on-surface-variant">
                    {paramsKey !== JSON.stringify(toParams(FILTER_DEFAULTS, '')) ? 'No students match these filters.' : 'No students have signed up yet.'}
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-sm py-xs">
                      <p className="font-label-md text-label-md text-on-surface whitespace-nowrap">
                        {`${s.firstName} ${s.lastName}`.trim() || <span className="text-on-surface-variant italic font-normal">Name not added yet</span>}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{s.rollNumber}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant md:hidden break-all">{s.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {!s.profileComplete && (
                          <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Profile incomplete</span>
                        )}
                        {s.selected && (
                          <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm">Selected</span>
                        )}
                      </div>
                      {s.mustChangePassword && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-[2px] rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
                          Password reset pending
                        </span>
                      )}
                    </td>
                    <td className="px-sm py-xs hidden md:table-cell text-center font-body-sm text-body-sm text-on-surface">
                      {/* Long emails end in "…"; the full address shows on hover */}
                      <span className="block max-w-[15rem] mx-auto truncate" title={s.email}>{s.email}</span>
                    </td>
                    <td className="px-sm py-xs hidden sm:table-cell text-center font-body-sm text-body-sm text-on-surface">
                      {s.branch ? branchLabel(s.branch) : '—'}
                    </td>
                    <td className="px-sm py-xs hidden md:table-cell text-center font-body-sm text-body-sm text-on-surface">
                      {s.institute ? s.institute.name : <span className="text-on-surface-variant italic">Not chosen yet</span>}
                    </td>
                    <td className="px-sm py-xs hidden lg:table-cell text-center font-body-sm text-body-sm text-on-surface tabular-nums">{s.graduationYear ?? '—'}</td>
                    <td className="px-sm py-xs hidden lg:table-cell text-center font-body-sm text-body-sm text-on-surface tabular-nums">{s.applications ?? 0}</td>
                    <td className="px-sm py-xs hidden lg:table-cell text-center font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap tabular-nums">{formatDate(s.createdAt)}</td>
                    <td className="px-sm py-xs">
                      <div className="flex items-center justify-center gap-1">
                        <IconAction
                          icon="key"
                          label="Reset password"
                          disabled={busyId === s.id}
                          onClick={() => setConfirm({ type: 'reset', student: s })}
                        />
                        {s.institute && (
                          <IconAction
                            icon="restart_alt"
                            label="Reset institute"
                            disabled={busyId === s.id}
                            onClick={() => setConfirm({ type: 'resetInstitute', student: s })}
                          />
                        )}
                        <IconAction
                          icon="delete"
                          label="Delete account"
                          danger
                          disabled={busyId === s.id}
                          onClick={() => openDelete(s)}
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
      <TwoStepConfirmDialog isOpen={Boolean(deleteTarget)} onClose={closeConfirm} first={deleteFirst} second={deleteSecond} />
    </div>
  );
};

export default AdminStudents;
