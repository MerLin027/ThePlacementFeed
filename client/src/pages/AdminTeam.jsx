import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import OneTimePasswordDialog from '../components/OneTimePasswordDialog';
import FormField from '../components/FormField';
import SubmitButton from '../components/SubmitButton';
import IconAction from '../components/IconAction';
import { FormAlert } from '../components/AuthCard';
import { TableRowsSkeleton } from '../components/Skeleton';
import { passwordRuleSummary } from '../constants/passwords';
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * The super admin's team: the super admin (edited on its own profile) and the admins it has added.
 * Admins have a name and an email (their sign-in) and can use the Dashboard and Students pages. The
 * server enforces every rule (admins only, disable before delete); this page mirrors them so the
 * buttons make sense.
 */

const ACCESS = {
  can: [
    { icon: 'dashboard', label: 'Dashboard', hint: 'Drives, applicants and the numbers' },
    { icon: 'group', label: 'Students', hint: 'Accounts and password resets' },
  ],
  cannot: [
    { icon: 'tune', label: 'Setup' },
    { icon: 'badge', label: 'Team' },
  ],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FORM = { name: '', email: '' };

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

const thClass = 'text-center px-sm py-sm font-label-sm text-label-sm font-semibold text-on-surface/80 uppercase tracking-wider whitespace-nowrap';

const Badge = ({ tone = 'neutral', icon, children }) => {
  const tones = {
    neutral: 'bg-surface-container-high text-on-surface-variant',
    primary: 'bg-primary-fixed text-on-primary-fixed',
    success: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-800',
    muted: 'bg-surface-container-highest text-on-surface-variant',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full font-label-sm text-label-sm whitespace-nowrap ${tones[tone]}`}>
      {icon && <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
};

const statusOf = (s) =>
  !s.active
    ? { tone: 'muted', icon: 'block', label: 'Disabled' }
    : s.mustChangePassword
      ? { tone: 'warning', icon: 'schedule', label: 'First sign-in pending' }
      : { tone: 'success', icon: 'check_circle', label: 'Active' };

const AccessSummary = () => (
  <div className="rounded-xl border border-outline-variant bg-surface-container-low/60 p-sm">
    <p id="access-heading" className="font-label-md text-label-md text-on-surface">Access</p>
    <ul className="mt-xs grid gap-xs sm:grid-cols-2" aria-labelledby="access-heading">
      {ACCESS.can.map((a) => (
        <li key={a.label} className="flex items-start gap-xs">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center" aria-hidden="true">
            <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
          </span>
          <span>
            <span className="block font-label-md text-label-md text-on-surface">{a.label}</span>
            <span className="block font-body-sm text-body-sm text-on-surface-variant">{a.hint}</span>
          </span>
        </li>
      ))}
    </ul>
    <p className="mt-xs pt-xs border-t border-outline-variant/70 flex flex-wrap items-center gap-x-xs gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
      <span>No access to</span>
      {ACCESS.cannot.map((a) => (
        <Badge key={a.label} tone="muted" icon={a.icon}>{a.label}</Badge>
      ))}
    </p>
  </div>
);

/**
 * Add an admin (name + email, then a one-time password) or edit one (only the fields that changed
 * are sent; a new email signs them out everywhere).
 */
const AdminForm = ({ member, onCancel, onSaved }) => {
  const editing = Boolean(member);
  const [form, setForm] = useState(editing ? { name: member.name, email: member.email } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const next = {};
    if (name.length < 2) next.name = 'Enter their name (at least 2 characters)';
    if (!EMAIL_PATTERN.test(email)) next.email = 'Enter a valid email address';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) {
      document.getElementById(next.name ? 'staff-name' : 'staff-email')?.focus();
      return;
    }

    const changes = editing
      ? { ...(name !== member.name && { name }), ...(email !== member.email && { email }) }
      : { name, email };
    if (editing && Object.keys(changes).length === 0) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      const res = editing
        ? await api.patch(`/api/admin/staff/${member.id}`, changes)
        : await api.post('/api/admin/staff', changes);
      onSaved(res.data, changes);
    } catch (err) {
      const parsed = parseApiError(err, editing ? 'Could not save the changes.' : 'Could not create the account.');
      setErrors(parsed.fieldErrors);
      setFormError(Object.keys(parsed.fieldErrors).length > 0 ? '' : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const emailChanging = editing && form.email.trim().toLowerCase() !== member.email;

  return (
    <form onSubmit={submit} className="space-y-sm" noValidate>
      {!editing && (
        <div className="flex items-start gap-sm">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center" aria-hidden="true">
            <span className="material-symbols-outlined text-[22px]">person_add</span>
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            They&apos;ll be able to use the <strong className="font-semibold text-on-surface">Dashboard</strong> and{' '}
            <strong className="font-semibold text-on-surface">Students</strong> pages.
          </p>
        </div>
      )}
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className={`grid gap-sm ${editing ? '' : 'sm:grid-cols-2'}`}>
        <FormField
          id="staff-name"
          label="Name"
          icon="person"
          value={form.name}
          onChange={set('name')}
          maxLength={100}
          autoComplete="off"
          autoFocus
          error={errors.name}
        />
        <FormField
          id="staff-email"
          label="Email"
          icon="mail"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.email}
          onChange={set('email')}
          maxLength={254}
          autoComplete="off"
          helper={emailChanging ? 'They will be signed out, then sign in with this email.' : 'They sign in with this email.'}
          error={errors.email}
        />
      </div>
      {!editing && (
        <>
          <AccessSummary />
          <p className="flex items-start gap-xs font-body-sm text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] mt-px text-primary" aria-hidden="true">key</span>
            <span>
              Next you&apos;ll see a one-time password to give them. They use it once to sign in, within 72 hours, then
              choose their own: {passwordRuleSummary('admin')}.
            </span>
          </p>
        </>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-xs pt-xs">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <SubmitButton isLoading={saving} loadingText={editing ? 'Saving...' : 'Creating...'} className="sm:w-auto sm:min-w-[11rem]">
          {editing ? 'Save changes' : 'Create account'}
        </SubmitButton>
      </div>
    </form>
  );
};

const AdminTeam = () => {
  usePageTitle('Team');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [oneTime, setOneTime] = useState(null);
  // { member: null } adds, { member } edits; kept while the dialog animates closed
  const [editor, setEditor] = useState({ member: null });
  const [editorOpen, setEditorOpen] = useState(false);
  const openEditor = (member) => {
    setEditor({ member });
    setEditorOpen(true);
  };
  const closeEditor = () => setEditorOpen(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/admin/staff', { signal: controller.signal })
      .then((res) => {
        setStaff(res.data.data);
        setError('');
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(parseApiError(err, 'Could not load the team.').message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const replace = (updated) => setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const nameOf = (s) => s.name || s.email || s.username;

  const run = async (member, action, success) => {
    setBusyId(member.id);
    try {
      await action();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(parseApiError(err, 'That didn’t work. Please try again.').message || 'That didn’t work. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const update = (member, changes, success) =>
    run(member, async () => replace((await api.patch(`/api/admin/staff/${member.id}`, changes)).data.data), success);

  const resetPassword = (member) =>
    run(member, async () => {
      const res = await api.post(`/api/admin/staff/${member.id}/reset-password`);
      replace(res.data.data);
      setOneTime({ title: 'Password Reset', who: nameOf(member), password: res.data.temporaryPassword });
    });

  const remove = (member) =>
    run(member, async () => {
      await api.delete(`/api/admin/staff/${member.id}`);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    }, `${nameOf(member)}'s account was deleted.`);

  const saved = ({ data, temporaryPassword }, changes) => {
    const adding = !editor.member;
    closeEditor();
    if (adding) {
      setStaff((prev) => [...prev, data]);
      setOneTime({ title: 'Account Created', who: data.name, password: temporaryPassword });
    } else {
      replace(data);
      toast.success(changes.email ? `Saved. ${data.name} signs in with the new email from now on.` : 'Changes saved.');
    }
  };

  const confirmProps = (() => {
    if (!confirm) return null;
    const { type, member } = confirm;
    const who = nameOf(member);
    switch (type) {
      case 'reset':
        return {
          title: 'Reset Password?',
          message: `${who} will be signed out everywhere and get a one-time password, shown to you once. Within 72 hours they use it to sign in and choose a new password: ${passwordRuleSummary('admin')}.`,
          confirmLabel: 'Reset password',
          tone: 'primary',
          icon: 'key',
          onConfirm: () => resetPassword(member),
        };
      case 'disable':
        return { title: 'Disable Account?', message: `${who} will be signed out at once and can't sign in until you enable the account again.`, confirmLabel: 'Disable', icon: 'block', onConfirm: () => update(member, { active: false }, `${who}'s account was disabled.`) };
      case 'delete':
        return { title: 'Delete Account?', message: `${who}'s account will be removed for good. Their past actions stay in the audit log.`, confirmLabel: 'Delete account', icon: 'person_remove', onConfirm: () => remove(member) };
      default:
        return null;
    }
  })();

  const admins = staff.filter((s) => s.role === 'admin').length;

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      <div className="mb-md flex flex-wrap items-end justify-between gap-sm">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface">Team</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {loading ? 'Staff accounts.' : `You and ${admins} admin${admins === 1 ? '' : 's'}.`} Admins can use the Dashboard and Students pages; Setup and this page are yours alone.
          </p>
        </div>
        <button type="button" onClick={() => openEditor(null)} className="btn-primary inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person_add</span>
          Add admin
        </button>
      </div>

      {error && <div className="mb-md"><FormAlert>{error}</FormAlert></div>}

      <div className="bg-surface-container-lowest rounded-2xl shadow-soft border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className={`${thClass} text-left!`}>Name</th>
                <th className={`${thClass} hidden lg:table-cell`}>Signs in with</th>
                <th className={`${thClass} hidden sm:table-cell`}>Status</th>
                <th className={`${thClass} hidden md:table-cell`}>Last sign-in</th>
                <th className={`${thClass} hidden sm:table-cell`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {loading ? (
                <TableRowsSkeleton columns={5} label="Loading the team" />
              ) : (
                staff.map((s) => {
                  const busy = busyId === s.id;
                  const isSuper = s.role === 'super_admin';
                  const status = statusOf(s);
                  // An admin from before email sign-in may still have only a username
                  const signIn = s.email || s.username || '—';
                  const actions = (
                    isSuper ? (
                      <IconAction icon="person" to="/admin/profile" label="Edit your profile" tooltip="Your profile" />
                    ) : (
                      <>
                        <IconAction icon="edit" label={`Edit ${nameOf(s)}'s details`} tooltip="Edit details" disabled={busy} onClick={() => openEditor(s)} />
                        <IconAction icon="key" label={`Reset ${nameOf(s)}'s password`} tooltip="Reset password" disabled={busy} onClick={() => setConfirm({ type: 'reset', member: s })} />
                        {s.active ? (
                          <IconAction icon="block" label={`Disable ${nameOf(s)}`} tooltip="Disable" danger disabled={busy} onClick={() => setConfirm({ type: 'disable', member: s })} />
                        ) : (
                          <IconAction icon="check_circle" label={`Enable ${nameOf(s)}`} tooltip="Enable" disabled={busy} onClick={() => update(s, { active: true }, `${nameOf(s)}'s account was enabled.`)} />
                        )}
                        {!s.active && (
                          <IconAction icon="delete" label={`Delete ${nameOf(s)}`} tooltip="Delete" danger disabled={busy} onClick={() => setConfirm({ type: 'delete', member: s })} />
                        )}
                      </>
                    )
                  );
                  return (
                    <tr key={s.id} className={`even:bg-surface-container-low/60 hover:bg-primary/4 transition-colors ${s.active ? '' : 'opacity-70'}`}>
                      <td className="px-sm py-xs">
                        <p className="font-label-md text-label-md text-on-surface whitespace-nowrap">{s.name || (isSuper ? 'Super Admin' : signIn)}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant lg:hidden truncate max-w-[14rem]">{signIn}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isSuper && <Badge tone="primary" icon="verified_user">Super Admin</Badge>}
                          {s.isYou && <Badge tone="primary">You</Badge>}
                          {/* Phones: the status sits here instead of its own column */}
                          {!isSuper && (
                            <span className="sm:hidden">
                              <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
                            </span>
                          )}
                          {s.needsEmail && <Badge tone="warning" icon="mail">Add an email</Badge>}
                        </div>
                        {/* Phones: the actions sit under the name instead of their own column */}
                        <div className="sm:hidden mt-1 -ml-2.5 flex items-center gap-1">{actions}</div>
                      </td>
                      <td className="px-sm py-xs hidden lg:table-cell text-center font-body-md text-body-md text-on-surface">
                        <span className="block max-w-[16rem] mx-auto truncate" title={signIn}>
                          {isSuper && s.email && s.username ? `${s.username} or ${s.email}` : signIn}
                        </span>
                      </td>
                      <td className="px-sm py-xs text-center hidden sm:table-cell">
                        <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
                      </td>
                      <td className="px-sm py-xs hidden md:table-cell text-center font-body-md text-body-md text-on-surface whitespace-nowrap tabular-nums">{formatDate(s.lastLoginAt)}</td>
                      <td className="px-sm py-xs hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1">{actions}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && admins === 0 && (
          <p className="px-md py-md border-t border-outline-variant/60 text-center font-body-md text-body-md text-on-surface-variant">
            No admins yet. Add one to share the Dashboard and Students pages.
          </p>
        )}
      </div>

      <Modal isOpen={editorOpen} onClose={closeEditor} title={editor.member ? 'Edit Admin' : 'Add Admin'} maxWidth="max-w-[36rem]">
        <AdminForm key={editor.member?.id || 'new'} member={editor.member} onCancel={closeEditor} onSaved={saved} />
      </Modal>

      <ConfirmDialog isOpen={Boolean(confirmProps)} onClose={closeConfirm} {...(confirmProps || {})} />
      <OneTimePasswordDialog
        isOpen={Boolean(oneTime)}
        onClose={() => {
          setOneTime(null);
          setReloadKey((k) => k + 1);
        }}
        title={oneTime?.title}
        who={oneTime?.who}
        password={oneTime?.password}
        kind="admin"
      />
    </div>
  );
};

export default AdminTeam;
