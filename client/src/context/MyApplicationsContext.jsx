import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const MyApplicationsContext = createContext(null);

export const useMyApplications = () => {
  const context = useContext(MyApplicationsContext);
  if (!context) {
    throw new Error('useMyApplications must be used within a MyApplicationsProvider');
  }
  return context;
};

/**
 * Loads the logged-in student's applications once ({ driveId, status }) so every
 * drive card can show its apply state without a request per card.
 */
export const MyApplicationsProvider = ({ children }) => {
  const { student } = useAuth();
  const studentId = student?.id;
  const restricted = Boolean(student?.mustChangePassword);
  const [byDrive, setByDrive] = useState(() => new Map());

  useEffect(() => {
    if (!studentId || restricted) {
      setByDrive(new Map());
      return undefined;
    }

    const controller = new AbortController();
    api
      .get('/api/applications/my/summary', { signal: controller.signal })
      .then((res) => {
        setByDrive(new Map(res.data.data.map((a) => [a.driveId, a])));
      })
      .catch(() => {
        // Non-critical: buttons fall back to "Apply" and the server rejects duplicates
      });
    return () => controller.abort();
  }, [studentId, restricted]);

  const markApplied = useCallback((driveId, status = 'Applied') => {
    setByDrive((prev) => new Map(prev).set(driveId, { driveId, status }));
  }, []);

  return (
    <MyApplicationsContext.Provider value={{ byDrive, markApplied }}>
      {children}
    </MyApplicationsContext.Provider>
  );
};
