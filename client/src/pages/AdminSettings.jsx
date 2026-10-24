import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import TwoStepConfirmDialog from '../components/TwoStepConfirmDialog';
import FormField from '../components/FormField';
import { FormAlert } from '../components/AuthCard';
import { PageSpinner } from '../components/RequireRole';
import { loadCatalog } from '../stores/catalog';
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const iconButton =
  'inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-2 rounded-full font-label-sm text-label-sm text-on-surface-variant transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed';

const RowButton = ({ icon, label, onClick, danger, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`${iconButton} ${danger ? 'hover:text-error hover:bg-error-container' : 'hover:text-primary hover:bg-primary/5'}`}
  >
    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
  </button>
);

const StatusChip = ({ active }) => (
  <span
    className={`inline-flex items-center px-2 py-[2px] rounded-full font-label-sm text-label-sm ${
      active ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container-high text-on-surface-variant'
    }`}
  >
    {active ? 'Active' : 'Archived'}
  </span>
);

const Section = ({ id, title, description, children }) => (
  <section aria-labelledby={id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm md:p-md">
    <h2 id={id} className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 mb-sm">{description}</p>
    {children}
  </section>
);

/**
 * The lists students and drives choose from: the College/University name shown on every profile,
 * the institutes students pick once, and the branches drives are open to. Items in use can be
 * archived (hidden from new choices) or, after a two-step prompt, deleted anyway.
 */
const AdminSettings = () => {
  usePageTitle('Settings');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [universityDraft, setUniversityDraft] = useState(null);
  const [universityError, setUniversityError] = useState('');
  const [newInstitute, setNewInstitute] = useState('');
  const [instituteErrors, setInstituteErrors] = useState({});
  const [newBranch, setNewBranch] = useState({ code: '', name: '' });
  const [branchErrors, setBranchErrors] = useState({});
  const [busy, setBusy] = useState(''); // which action is saving
  const [editing, setEditing] = useState(null); // { kind, id, value, error }
  const [deleting, setDeleting] = useState(null); // { kind, item, inUse, usage }

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/admin/catalog', { signal: controller.signal })
      .then((res) => {
        setData(res.data.data);
        setLoadError('');
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setLoadError(parseApiError(err, 'Could not load the settings.').message);
      });
    return () => controller.abort();
  }, [reloadKey]);

  // After any change: this page's counts and the site-wide catalog (dropdowns, labels)
  const refresh = () => {
    setReloadKey((k) => k + 1);
    loadCatalog();
  };

  // Runs a change; field errors go to `setFieldErrors`, anything else to a toast
  const mutate = async (key, request, success, setFieldErrors) => {
    setBusy(key);
    try {
      await request();
      if (success) toast.success(success);
      refresh();
      return true;
    } catch (err) {
      const parsed = parseApiError(err, 'Could not save that change.');
      if (setFieldErrors && Object.keys(parsed.fieldErrors).length > 0) setFieldErrors(parsed.fieldErrors);
      else toast.error(parsed.message || 'Please check the highlighted fields.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveUniversity = async (e) => {
    e.preventDefault();
    setUniversityError('');
    const ok = await mutate(
      'university',
      () => api.put('/api/admin/catalog/university', { name: universityDraft ?? data.university ?? '' }),
      'College/University saved. Every profile shows it now.',
      (errors) => setUniversityError(errors.name)
    );
    if (ok) setUniversityDraft(null);
  };

  const addInstitute = async (e) => {
    e.preventDefault();
    setInstituteErrors({});
    const ok = await mutate('institute-new', () => api.post('/api/admin/catalog/institutes', { name: newInstitute }), 'Institute added', setInstituteErrors);
    if (ok) setNewInstitute('');
  };

  const addBranch = async (e) => {
    e.preventDefault();
    setBranchErrors({});
    const ok = await mutate('branch-new', () => api.post('/api/admin/catalog/branches', newBranch), 'Branch added', setBranchErrors);
    if (ok) setNewBranch({ code: '', name: '' });
  };

  const pathFor = (kind, item) => `/api/admin/catalog/${kind === 'branch' ? 'branches' : 'institutes'}/${item.id}`;
  const nameOf = (kind, item) => (kind === 'branch' ? `${item.name} (${item.code})` : item.name);

  const saveRename = async () => {
    const { kind, id, value } = editing;
    const ok = await mutate(`rename-${id}`, () => api.patch(pathFor(kind, { id }), { name: value }), 'Name updated', (errors) =>
      setEditing((ed) => ed && { ...ed, error: errors.name })
    );
    if (ok) setEditing(null);
  };

  const setActive = (kind, item, active) =>
    mutate(`active-${item.id}`, () => api.patch(pathFor(kind, item), { active }), active ? `${item.name} restored` : `${item.name} archived. It can't be chosen anymore.`);

  const openDelete = async (kind, item) => {
    const inUse = kind === 'branch' ? item.students + item.openDrives + item.completedDrives > 0 : item.students > 0;
    let usage = kind === 'branch' ? null : { students: item.students };
    if (kind === 'branch' && inUse) {
      setBusy(`delete-${item.id}`);
      try {
        usage = (await api.get(`/api/admin/catalog/branches/${item.id}/usage`)).data.data;
      } catch (err) {
        toast.error(parseApiError(err, 'Could not check where this branch is used.').message);
        return;
      } finally {
        setBusy('');
      }
    }
    setDeleting({ kind, item, inUse, usage });
  };

  const runDelete = (force) => {
    const { kind, item } = deleting;
    mutate(`delete-${item.id}`, () => api.delete(pathFor(kind, item), { params: force ? { force: true } : {} }), `${nameOf(kind, item)} deleted`);
  };

  if (loadError) {
    return (
      <div className="max-w-container-max mx-auto px-sm md:px-lg py-lg">
        <FormAlert>{loadError}</FormAlert>
      </div>
    );
  }
  if (!data) return <PageSpinner />;

  const renderName = (kind, item) =>
    editing?.id === item.id ? (
      <div className="flex flex-col sm:flex-row gap-xs w-full">
        <div className="flex-1">
          <label htmlFor={`rename-${item.id}`} className="sr-only">New name for {item.name}</label>
          <input
            id={`rename-${item.id}`}
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value, error: '' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') setEditing(null);
            }}
            maxLength={120}
            aria-invalid={Boolean(editing.error) || undefined}
            aria-describedby={editing.error ? `rename-${item.id}-error` : undefined}
            className="input-field"
            autoFocus
          />
          {editing.error && <p id={`rename-${item.id}-error`} className="mt-1 font-body-sm text-body-sm text-error">{editing.error}</p>}
        </div>
        <div className="flex gap-xs">
          <button type="button" onClick={saveRename} disabled={busy === `rename-${item.id}`} className="btn-primary min-h-[44px]">Save</button>
          <button type="button" onClick={() => setEditing(null)} className="btn-secondary min-h-[44px]">Cancel</button>
        </div>
      </div>
    ) : (
      <div className="min-w-0">
        <p className="font-label-md text-label-md text-on-surface truncate">
          {kind === 'branch' && <span className="font-mono text-primary mr-xs">{item.code}</span>}
          {item.name}
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {kind === 'branch'
            ? `${plural(item.students, 'student')} · ${plural(item.openDrives, 'open drive')} · ${plural(item.completedDrives, 'past drive')}`
            : plural(item.students, 'student')}
        </p>
      </div>
    );

  const renderRow = (kind, item) => (
    <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-xs py-xs">
      <div className="flex-1 min-w-0 flex items-center gap-sm">{renderName(kind, item)}</div>
      {editing?.id !== item.id && (
        <div className="flex items-center gap-1 justify-between sm:justify-end">
          <StatusChip active={item.active} />
          <div className="flex items-center">
            <RowButton icon="edit" label={`Rename ${item.name}`} onClick={() => setEditing({ kind, id: item.id, value: item.name, error: '' })} />
            <RowButton
              icon={item.active ? 'archive' : 'unarchive'}
              label={item.active ? `Archive ${item.name}` : `Restore ${item.name}`}
              disabled={busy === `active-${item.id}`}
              onClick={() => setActive(kind, item, !item.active)}
            />
            <RowButton icon="delete" label={`Delete ${item.name}`} danger disabled={busy === `delete-${item.id}`} onClick={() => openDelete(kind, item)} />
          </div>
        </div>
      )}
    </li>
  );

  // --- Delete prompts ---
  const kindLabel = deleting?.kind === 'branch' ? 'branch' : 'institute';
  const name = deleting && nameOf(deleting.kind, deleting.item);
  const simpleDelete = deleting && !deleting.inUse;
  const usage = deleting?.usage || {};
  const blockers = usage.onlyBranchDrives || [];
  const usedBy =
    deleting?.kind === 'branch'
      ? [
          usage.students > 0 && plural(usage.students, 'student'),
          usage.openDrives > 0 && plural(usage.openDrives, 'open drive'),
          usage.completedDrives > 0 && plural(usage.completedDrives, 'past drive'),
        ].filter(Boolean).join(', ')
      : plural(usage.students || 0, 'student');

  const twoStep = deleting?.inUse
    ? {
        first: {
          title: `Delete ${name}?`,
          icon: 'delete',
          message: (
            <>
              <p>This {kindLabel} is used by {usedBy}.</p>
              {deleting.item.active && <p>Archiving hides it from new choices and keeps everything that already uses it working.</p>}
            </>
          ),
          confirmLabel: 'Delete anyway',
          extraAction: deleting.item.active ? { label: 'Archive instead', onClick: () => setActive(deleting.kind, deleting.item, false) } : null,
        },
        second: {
          title: 'This will change other records',
          icon: 'warning',
          message:
            deleting.kind === 'branch' ? (
              <>
                {usage.students > 0 && <p>{plural(usage.students, 'student')} will have to choose a branch again before they can apply.</p>}
                {usage.openDrives > 0 && <p>It will be removed from {plural(usage.openDrives, 'open drive')}.</p>}
                {usage.completedDrives > 0 && <p>{plural(usage.completedDrives, 'past drive')} keep it as history.</p>}
                {blockers.length > 0 && (
                  <div className="text-left p-xs rounded-lg bg-error-container text-on-error-container">
                    <p className="font-semibold">Can&apos;t delete yet: these open drives are only for this branch.</p>
                    <ul className="list-disc ml-5 mt-1">
                      {blockers.map((d) => <li key={d.id}>{d.company} · {d.role}</li>)}
                    </ul>
                    <p className="mt-1">
                      Change their eligible branches on the <Link to="/admin/dashboard" className="underline font-semibold">dashboard</Link> first.
                    </p>
                  </div>
                )}
                <p>This can&apos;t be undone.</p>
              </>
            ) : (
              <>
                <p>{plural(usage.students, 'student')} will have to choose their institute again before they can apply.</p>
                <p>Past applications keep the institute&apos;s name. This can&apos;t be undone.</p>
              </>
            ),
          actions: [{ label: `Delete ${kindLabel}`, tone: 'danger', disabled: blockers.length > 0, onClick: () => runDelete(true) }],
        },
      }
    : null;

  const universityValue = universityDraft ?? data.university ?? '';

  return (
    <div className="max-w-3xl mx-auto w-full px-sm md:px-lg py-md md:py-xl">
      <div className="mb-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Settings</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          The lists students and drives choose from.
        </p>
      </div>

      <div className="space-y-sm">
        <Section id="university-heading" title="College / University" description="Shown on every student profile and saved with each application.">
          <form onSubmit={saveUniversity} noValidate className="flex flex-col sm:flex-row sm:items-start gap-xs">
            <FormField
              id="universityName"
              label="Name"
              className="flex-1"
              value={universityValue}
              onChange={(e) => {
                setUniversityDraft(e.target.value);
                setUniversityError('');
              }}
              maxLength={120}
              placeholder="e.g. CHARUSAT"
              error={universityError}
            />
            <button type="submit" disabled={busy === 'university' || universityValue.trim() === (data.university || '')} className="btn-primary min-h-[44px] sm:mt-[20px]">
              {busy === 'university' ? 'Saving...' : 'Save'}
            </button>
          </form>
          {!data.university && <p className="mt-xs font-body-sm text-body-sm text-amber-800">Not set yet: profiles show &quot;Not set by the CDPC yet&quot;.</p>}
        </Section>

        <Section id="institutes-heading" title="Institutes" description="Students pick one once, from their profile, and need one to apply. You can reset a student's choice on the Students page.">
          {data.institutes.filter((i) => i.active).length === 0 && (
            <FormAlert tone="warning" icon="warning">No active institutes: students can&apos;t apply in-app until you add one.</FormAlert>
          )}
          <form onSubmit={addInstitute} noValidate className="flex flex-col sm:flex-row sm:items-start gap-xs mt-xs">
            <FormField
              id="newInstitute"
              label="New institute"
              className="flex-1"
              value={newInstitute}
              onChange={(e) => setNewInstitute(e.target.value)}
              maxLength={120}
              placeholder="e.g. CSPIT"
              error={instituteErrors.name}
            />
            <button type="submit" disabled={busy === 'institute-new' || !newInstitute.trim()} className="btn-primary min-h-[44px] gap-xs sm:mt-[20px]">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              Add
            </button>
          </form>
          {data.institutes.length > 0 ? (
            <ul className="mt-xs divide-y divide-surface-variant" aria-label="Institutes">
              {data.institutes.map((i) => renderRow('institute', i))}
            </ul>
          ) : (
            <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">No institutes yet.</p>
          )}
        </Section>

        <Section id="branches-heading" title="Branches" description="Students choose one; drives can be limited to some of them. Codes are stored on profiles and drives, so a code can't be changed, only its name.">
          <form onSubmit={addBranch} noValidate className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] items-start gap-xs">
            <FormField
              id="newBranchCode"
              label="Code"
              value={newBranch.code}
              onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value.toUpperCase() })}
              maxLength={12}
              placeholder="e.g. RAI"
              autoCapitalize="characters"
              error={branchErrors.code}
            />
            <FormField
              id="newBranchName"
              label="Full name"
              value={newBranch.name}
              onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
              maxLength={120}
              placeholder="e.g. Robotics & Automation"
              error={branchErrors.name}
            />
            <button type="submit" disabled={busy === 'branch-new' || !newBranch.code.trim() || !newBranch.name.trim()} className="btn-primary min-h-[44px] gap-xs sm:mt-[20px]">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              Add
            </button>
          </form>
          <ul className="mt-xs divide-y divide-surface-variant" aria-label="Branches">
            {data.branches.map((b) => renderRow('branch', b))}
          </ul>
        </Section>
      </div>

      <ConfirmDialog
        isOpen={Boolean(simpleDelete)}
        onClose={() => setDeleting(null)}
        onConfirm={() => runDelete(false)}
        title={`Delete ${name}?`}
        message={`Nothing uses this ${kindLabel}, so nothing else changes. This can't be undone.`}
        confirmLabel={`Delete ${kindLabel}`}
      />
      <TwoStepConfirmDialog isOpen={Boolean(twoStep)} onClose={() => setDeleting(null)} first={twoStep?.first} second={twoStep?.second} />
    </div>
  );
};

export default AdminSettings;
