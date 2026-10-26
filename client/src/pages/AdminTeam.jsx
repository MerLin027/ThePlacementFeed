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
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * The super admin's team: staff accounts, who can do what, and the account actions. The server
 * enforces every rule (no changing your own role, always one active super admin, disable before
 * delete); this page only mirrors them so the buttons make sense.
 */

const ROLES = [
  { value: 'admin', label: 'Admin', hint: 'Drives, applicants, students and the dashboard' },
  { value: 'super_admin', label: 'Super admin', hint: 'Everything, plus Setup and this Team page' },
];

const EMPTY_FORM = { name: '', username: '', email: '', role: 'admin' };

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

const thClass = 'text-center px-sm py-sm font-label-sm text-label-sm font-semibold text-on-surface/80 uppercase tracking-wider whitespace-nowrap';

const Badge = ({ tone = 'neutral', icon, children }) => {
  const tones = {
    neutral: 'bg-surface-container-high text-on-surface-variant',
    primary: 'bg-primary-fixed text-on-primary-fixed',
    warning: 'bg-amber-100 text-amber-800',
    muted: 'bg-surface-container-highest text-on-surface-variant',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full font-label-sm text-label-sm ${tones[tone]}`}>
      {icon && <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{icon}</span>}
      {children}
    </span>
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

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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
  const nameOf = (s) => s.name || s.username;

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
      setOneTime({ title: 'Password reset', who: nameOf(member), password: res.data.temporaryPassword });
    });

  const remove = (member) =>
    run(member, async () => {
      await api.delete(`/api/admin/staff/${member.id}`);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    }, `${nameOf(member)}'s account was deleted.`);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setAdding(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Enter their name';
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(form.username.trim())) errors.username = '3–32 letters, digits, dots, hyphens or underscores';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await api.post('/api/admin/staff', {
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role,
        ...(form.email.trim() && { email: form.email.trim() }),
      });
      setStaff((prev) => [...prev, res.data.data]);
      setAdding(false);
      setOneTime({ title: 'Account created', who: res.data.data.name, password: res.data.temporaryPassword });
    } catch (err) {
      const parsed = parseApiError(err, 'Could not create the account.');
      setFormErrors(parsed.fieldErrors);
      setFormError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmProps = (() => {
    if (!confirm) return null;
    const { type, member } = confirm;
    const who = nameOf(member);
    switch (type) {
      case 'promote':
        return { title: 'Make super admin?', message: `${who} will also manage Setup and this team, including other super admins.`, confirmLabel: 'Make super admin', tone: 'primary', icon: 'verified_user', onConfirm: () => update(member, { role: 'super_admin' }, `${who} is now a super admin.`) };
      case 'demote':
        return { title: 'Make admin?', message: `${who} will no longer see Setup or this team.`, confirmLabel: 'Make admin', tone: 'primary', icon: 'person', onConfirm: () => update(member, { role: 'admin' }, `${who} is now an admin.`) };
      case 'reset':
        return { title: 'Reset password?', message: `${who} will be signed out everywhere and get a one-time password, shown to you once, to set a new one within 72 hours.`, confirmLabel: 'Reset password', tone: 'primary', icon: 'key', onConfirm: () => resetPassword(member) };
      case 'disable':
        return { title: 'Disable account?', message: `${who} will be signed out at once and can't sign in until you enable the account again.`, confirmLabel: 'Disable', icon: 'block', onConfirm: () => update(member, { active: false }, `${who}'s account was disabled.`) };
      case 'delete':
        return { title: 'Delete account?', message: `${who}'s account will be removed for good. Their past actions stay in the audit log.`, confirmLabel: 'Delete account', icon: 'person_remove', onConfirm: () => remove(member) };
      default:
        return null;
    }
  })();

  const activeSuperAdmins = staff.filter((s) => s.role === 'super_admin' && s.active).length;

  return (
    <div className="max-w-container-max mx-auto px-sm md:px-lg py-md md:py-xl">
      <div className="mb-md flex flex-wrap items-end justify-between gap-sm">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface">Team</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Staff accounts{loading ? '' : ` · ${staff.length} total`}. Admins manage drives, applicants and students; super admins also manage Setup and the team.
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary inline-flex items-center gap-1.5">
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
                <th className={`${thClass} hidden md:table-cell`}>Username</th>
                <th className={`${thClass} hidden lg:table-cell`}>Email</th>
                <th className={`${thClass} hidden sm:table-cell`}>Role</th>
                <th className={`${thClass} hidden md:table-cell`}>Last sign-in</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {loading ? (
                <TableRowsSkeleton columns={6} label="Loading the team" />
              ) : (
                staff.map((s) => {
                  const busy = busyId === s.id;
                  const lastSuper = s.role === 'super_admin' && s.active && activeSuperAdmins <= 1;
                  return (
                    <tr key={s.id} className={`even:bg-surface-container-low/60 hover:bg-primary/4 transition-colors ${s.active ? '' : 'opacity-70'}`}>
                      <td className="px-sm py-xs">
                        <p className="font-label-md text-label-md text-on-surface whitespace-nowrap">{s.name || s.username}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant md:hidden">{s.username}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {/* Phones: the role sits here instead of its own column */}
                          <span className="sm:hidden">
                            <Badge tone={s.role === 'super_admin' ? 'primary' : 'neutral'}>{s.roleLabel}</Badge>
                          </span>
                          {s.isYou && <Badge tone="primary">You</Badge>}
                          {!s.active && <Badge tone="muted" icon="block">Disabled</Badge>}
                          {s.mustChangePassword && <Badge tone="warning" icon="schedule">First sign-in pending</Badge>}
                        </div>
                      </td>
                      <td className="px-sm py-xs hidden md:table-cell text-center font-body-md text-body-md text-on-surface">{s.username}</td>
                      <td className="px-sm py-xs hidden lg:table-cell text-center font-body-md text-body-md text-on-surface">
                        <span className="block max-w-[15rem] mx-auto truncate" title={s.email || undefined}>{s.email || '—'}</span>
                      </td>
                      <td className="px-sm py-xs text-center hidden sm:table-cell">
                        <Badge tone={s.role === 'super_admin' ? 'primary' : 'neutral'} icon={s.role === 'super_admin' ? 'verified_user' : undefined}>
                          {s.roleLabel}
                        </Badge>
                      </td>
                      <td className="px-sm py-xs hidden md:table-cell text-center font-body-md text-body-md text-on-surface whitespace-nowrap tabular-nums">{formatDate(s.lastLoginAt)}</td>
                      <td className="px-sm py-xs">
                        {s.isYou ? (
                          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
                            <span className="hidden md:inline">Use your account menu</span>
                            <span className="md:hidden" aria-label="Use your account menu">—</span>
                          </p>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {s.role === 'admin' ? (
                              <IconAction icon="verified_user" label={`Make ${nameOf(s)} a super admin`} tooltip="Make super admin" disabled={busy || !s.active} onClick={() => setConfirm({ type: 'promote', member: s })} />
                            ) : (
                              <IconAction icon="person" label={`Make ${nameOf(s)} an admin`} tooltip={lastSuper ? 'The last super admin' : 'Make admin'} disabled={busy || lastSuper} onClick={() => setConfirm({ type: 'demote', member: s })} />
                            )}
                            <IconAction icon="key" label={`Reset ${nameOf(s)}'s password`} tooltip="Reset password" disabled={busy} onClick={() => setConfirm({ type: 'reset', member: s })} />
                            {s.active ? (
                              <IconAction icon="block" label={`Disable ${nameOf(s)}`} tooltip={lastSuper ? 'The last super admin' : 'Disable'} danger disabled={busy || lastSuper} onClick={() => setConfirm({ type: 'disable', member: s })} />
                            ) : (
                              <IconAction icon="check_circle" label={`Enable ${nameOf(s)}`} tooltip="Enable" disabled={busy} onClick={() => update(s, { active: true }, `${nameOf(s)}'s account was enabled.`)} />
                            )}
                            {!s.active && (
                              <IconAction icon="delete" label={`Delete ${nameOf(s)}`} tooltip="Delete" danger disabled={busy} onClick={() => setConfirm({ type: 'delete', member: s })} />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add admin" maxWidth="max-w-[34rem]">
        <form onSubmit={submitAdd} className="space-y-sm" noValidate>
          {formError && <FormAlert>{formError}</FormAlert>}
          <FormField id="staff-name" label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} autoComplete="off" error={formErrors.name} />
          <FormField
            id="staff-username"
            label="Username"
            helper="What they type to sign in. Letters, digits, dots, hyphens or underscores."
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            maxLength={32}
            autoComplete="off"
            error={formErrors.username}
          />
          <FormField
            id="staff-email"
            label="Email (optional)"
            helper="They can sign in with this too."
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            maxLength={254}
            autoComplete="off"
            error={formErrors.email}
          />
          <fieldset>
            <legend className="label">Role</legend>
            <div className="grid gap-xs sm:grid-cols-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-xs p-sm rounded-xl border cursor-pointer transition-colors ${
                    form.role === r.value ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant hover:border-outline'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff-role"
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={() => setForm((f) => ({ ...f, role: r.value }))}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block font-label-md text-label-md text-on-surface">{r.label}</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            They get a one-time password, shown to you next, and choose their own password when they first sign in.
          </p>
          <SubmitButton isLoading={saving} loadingText="Creating...">Create account</SubmitButton>
        </form>
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
      />
    </div>
  );
};

export default AdminTeam;
