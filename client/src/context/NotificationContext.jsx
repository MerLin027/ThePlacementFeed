import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from './auth';
import { useMyApplications } from './myApplications';
import { NotificationContext } from './notifications';
import { readJSON, writeJSON, removeKeys } from '../utils/storage';
import { describeNotification } from '../utils/notificationText';

const POLL_MS = 30 * 1000;
const MAX_NOTIFICATIONS = 30;
const MAX_SEEN_IDS = 300;
const MAX_TOASTS_PER_BATCH = 3;

const NOTIFS_KEY = 'tpf:notifications';
// Every notification id ever shown or dismissed — the single source of "don't show again"
const SEEN_KEY = 'tpf:seenNotificationIds';
// Server time of the last successful poll; the next poll asks for changes since then
const CURSOR_KEY = 'tpf:notificationCursor';
const appStatusKey = (studentId) => `tpf:appStatuses:${studentId}`;
const LEGACY_KEYS = ['placement_notifications', 'lastPollTime', 'dismissedNotifIds'];

const TONE_ICON_CLASS = {
  warning: 'text-amber-600',
  success: 'text-emerald-600',
  info: 'text-primary',
  neutral: 'text-on-surface-variant',
};

const showToast = (n) => {
  const { text, icon, tone } = describeNotification(n);
  toast(text, {
    duration: 5000,
    icon: (
      <span className={`material-symbols-outlined text-[20px] ${TONE_ICON_CLASS[tone]}`} aria-hidden="true">
        {icon}
      </span>
    ),
  });
};

// Marks ids as seen in storage and returns only those not seen before.
// Re-reading storage each time means a second tab won't repeat the same toasts.
const claimUnseen = (items) => {
  const seen = new Set(readJSON(SEEN_KEY, []));
  const fresh = items.filter((n) => !seen.has(n.id));
  if (fresh.length === 0) return [];
  fresh.forEach((n) => seen.add(n.id));
  writeJSON(SEEN_KEY, [...seen].slice(-MAX_SEEN_IDS));
  return fresh;
};

export const NotificationProvider = ({ children }) => {
  const { student, loading: authLoading } = useAuth();
  const { byDrive, loadedFor } = useMyApplications();
  const [notifications, setNotifications] = useState(() => {
    const stored = readJSON(NOTIFS_KEY, []);
    return Array.isArray(stored) ? stored : [];
  });
  const polling = useRef(false);

  // Adds new notifications (newest first), toasts them, and caps the list
  const deliver = useCallback((items) => {
    if (items.length === 0) return;
    const newestFirst = [...items].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    setNotifications((prev) => {
      const ids = new Set(prev.map((n) => n.id));
      const added = newestFirst.filter((n) => !ids.has(n.id)).map((n) => ({ ...n, isRead: false }));
      return [...added, ...prev].slice(0, MAX_NOTIFICATIONS);
    });

    if (newestFirst.length > MAX_TOASTS_PER_BATCH) {
      toast(`${newestFirst.length} new updates — open the bell to see them`, {
        duration: 5000,
        icon: <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">notifications</span>,
      });
    } else {
      newestFirst.forEach(showToast);
    }
  }, []);

  // One-time cleanup of the storage keys used by the previous implementation
  useEffect(() => {
    removeKeys(...LEGACY_KEYS);
  }, []);

  // A student's application updates (company, role, outcome) belong to that student only: once we
  // know who is signed in, drop any that aren't theirs, so after a logout (or another account
  // signing in on a shared computer) they are gone from the bell and from storage. Drive updates
  // are public and stay. Waits for the session check, so a reload doesn't wipe the student's own.
  const currentStudentId = student?.id ?? null;
  useEffect(() => {
    if (authLoading) return;
    // oxlint-disable-next-line react/set-state-in-effect -- follows the signed-in account (external)
    setNotifications((prev) => {
      const kept = prev.filter((n) => n.kind !== 'application' || (currentStudentId && n.studentId === currentStudentId));
      return kept.length === prev.length ? prev : kept;
    });
  }, [authLoading, currentStudentId]);

  // Persist, and follow other tabs
  useEffect(() => {
    const serialized = JSON.stringify(notifications);
    let stored = null;
    try {
      stored = localStorage.getItem(NOTIFS_KEY);
    } catch {
      // storage unavailable
    }
    if (stored !== serialized) writeJSON(NOTIFS_KEY, notifications);
  }, [notifications]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === NOTIFS_KEY) {
        const next = readJSON(NOTIFS_KEY, []);
        setNotifications(Array.isArray(next) ? next : []);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // --- Drive updates (everyone) ---
  const pollDrives = useCallback(async () => {
    // Single flight: overlapping polls (interval + tab focus + mount) are skipped, not queued
    if (polling.current) return;
    polling.current = true;
    try {
      const cursor = readJSON(CURSOR_KEY, null);
      const res = await api.get('/api/drives/changes', {
        params: { since: cursor || new Date().toISOString() },
      });
      const { data = [], serverTime } = res.data || {};

      if (!cursor) {
        // First visit: start tracking from now without inventing notifications for old changes
        claimUnseen(data);
      } else {
        deliver(claimUnseen(data.map((c) => ({ ...c, kind: 'drive' }))));
      }
      if (serverTime) writeJSON(CURSOR_KEY, serverTime);
    } catch {
      // Network blips/cold starts: try again on the next tick
    } finally {
      polling.current = false;
    }
  }, [deliver]);

  useEffect(() => {
    // Subscribing to an external system (the server, on a timer and on tab focus): the first poll
    // runs right away by design.
    // oxlint-disable-next-line react/set-state-in-effect -- polling subscription, see above
    pollDrives();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') pollDrives();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') pollDrives();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pollDrives]);

  // --- Application status changes (logged-in student) ---
  // Compares the latest statuses with the last ones this browser saw for this student.
  useEffect(() => {
    if (!loadedFor || loadedFor !== student?.id) return;
    const key = appStatusKey(loadedFor);
    const previous = readJSON(key, null);
    const current = {};
    byDrive.forEach((a, driveId) => {
      current[driveId] = a.status;
    });

    if (previous && typeof previous === 'object') {
      const changes = [];
      byDrive.forEach((a, driveId) => {
        if (previous[driveId] && previous[driveId] !== a.status) {
          changes.push({
            id: `app-${driveId}-${a.status}-${a.updatedAt}`,
            kind: 'application',
            // Whose it is: dropped when someone else is signed in (see above)
            studentId: loadedFor,
            type: 'applicationStatus',
            placementId: driveId,
            company: a.company,
            role: a.role,
            status: a.status,
            changedAt: a.updatedAt || new Date().toISOString(),
          });
        }
      });
      // Syncs with localStorage (the statuses this browser saw last), which is the source of truth here
      // oxlint-disable-next-line react/set-state-in-effect -- external-storage sync, see above
      deliver(claimUnseen(changes));
    }
    writeJSON(key, current);
  }, [byDrive, loadedFor, student?.id, deliver]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.isRead) ? prev.map((n) => ({ ...n, isRead: true })) : prev));
  }, []);

  // Removed items stay in the seen set, so they never come back
  const clearAll = useCallback(() => setNotifications([]), []);
  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAllAsRead, clearAll, dismissNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
