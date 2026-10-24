import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from './auth';
import { MyApplicationsContext } from './myApplications';

// How often a logged-in student's application statuses are refreshed
const REFRESH_MS = 60 * 1000;

/**
 * Keeps the logged-in student's applications ({ driveId, status, company, role,
 * updatedAt }) in one map, used by every drive card's apply state and by the
 * notification system to spot status changes made by the admin.
 * Refreshes every minute while the tab is visible, and on tab focus.
 */
export const MyApplicationsProvider = ({ children }) => {
  const { student } = useAuth();
  const studentId = student?.id;
  const restricted = Boolean(student?.mustChangePassword);
  const [byDrive, setByDrive] = useState(() => new Map());
  // Whose applications byDrive currently holds (null until the first load)
  const [loadedFor, setLoadedFor] = useState(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!studentId || restricted || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await api.get('/api/applications/my/summary');
      setByDrive(new Map(res.data.data.map((a) => [a.driveId, a])));
      setLoadedFor(studentId);
    } catch {
      // Non-critical: buttons fall back to "Apply" and the server rejects duplicates
    } finally {
      inFlight.current = false;
    }
  }, [studentId, restricted]);

  useEffect(() => {
    setByDrive(new Map());
    setLoadedFor(null);
    if (!studentId || restricted) return undefined;

    refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [studentId, restricted, refresh]);

  // Optimistic update after the student applies
  const markApplied = useCallback((driveId, status = 'Applied', extra = {}) => {
    setByDrive((prev) =>
      new Map(prev).set(driveId, { ...prev.get(driveId), ...extra, driveId, status, updatedAt: new Date().toISOString() })
    );
  }, []);

  return (
    <MyApplicationsContext.Provider value={{ byDrive, loadedFor, markApplied, refresh }}>
      {children}
    </MyApplicationsContext.Provider>
  );
};
