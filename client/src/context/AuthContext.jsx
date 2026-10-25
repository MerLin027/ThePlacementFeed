import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import api, { setupAuthInterceptor } from '../api/axios';
import { AuthContext } from './auth';

/**
 * Admin and student sessions use separate cookies and can coexist in one
 * browser (e.g. an admin testing a student account). `role` reports the
 * one the UI should present, with admin taking precedence.
 */
export const AuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  // The admin's username, for the account menu (from /api/auth/check)
  const [adminName, setAdminName] = useState('');
  const [adminSessionExpired, setAdminSessionExpired] = useState(false);
  const [student, setStudent] = useState(null);
  // Set when a session ended because the server rejected it (not a logout), so route guards can
  // tell the user why they're back on the login page: true, or 'temp' when a reset password's
  // 72-hour window ran out
  const [studentSessionExpired, setStudentSessionExpired] = useState(false);
  // True right after the student chose to log out: student-only pages then send them home instead of
  // to the login page (the guard can render before the navigation home lands)
  const [studentSignedOut, setStudentSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const expireAdmin = useCallback(() => {
    setAdminSessionExpired(true);
    setIsAdmin(false);
  }, []);
  const expireStudent = useCallback((reason = true) => {
    setStudentSessionExpired(reason);
    setStudent(null);
  }, []);

  useEffect(() => {
    setupAuthInterceptor({
      onAdminExpired: expireAdmin,
      onStudentExpired: expireStudent,
      navigate,
    });
  }, [expireAdmin, expireStudent, navigate]);

  const refreshStudent = useCallback(async () => {
    try {
      const res = await api.get('/api/students/auth/check');
      const next = res.data.authenticated ? res.data.student : null;
      if (next) setStudentSessionExpired(false);
      setStudent(next);
      return next;
    } catch {
      setStudent(null);
      return null;
    }
  }, []);

  // Check both sessions on mount
  useEffect(() => {
    const checkAuth = async () => {
      const [adminRes] = await Promise.allSettled([
        api.get('/api/auth/check'),
        refreshStudent(),
      ]);
      const admin = adminRes.status === 'fulfilled' && adminRes.value.data.authenticated === true;
      setIsAdmin(admin);
      setAdminName(admin ? adminRes.value.data.username || '' : '');
      setLoading(false);
    };
    checkAuth();
  }, [refreshStudent]);

  const loginAdmin = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    if (res.data.success) {
      setAdminSessionExpired(false);
      setIsAdmin(true);
      setAdminName(username.trim().toLowerCase());
    }
    return res.data;
  };

  const logoutAdmin = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if the request fails, clear local state
    }
    setIsAdmin(false);
    navigate('/admin/login');
  };

  const loginStudent = async (email, password) => {
    const res = await api.post('/api/students/auth/login', { email, password });
    setStudentSignedOut(false);
    const next = await refreshStudent();
    return { ...res.data, student: next };
  };

  const signupStudent = async ({ email, rollNumber, password }) => {
    const res = await api.post('/api/students/auth/signup', { email, rollNumber, password });
    setStudentSignedOut(false);
    const next = await refreshStudent();
    return { ...res.data, student: next };
  };

  const logoutStudent = async () => {
    try {
      await api.post('/api/students/auth/logout');
    } catch {
      // Even if the request fails, clear local state
    }
    setStudentSignedOut(true);
    setStudent(null);
    navigate('/');
  };

  const role = isAdmin ? 'admin' : student ? 'student' : null;

  return (
    <AuthContext.Provider
      value={{
        role,
        isAdmin,
        adminName,
        adminSessionExpired,
        student,
        studentSessionExpired,
        studentSignedOut,
        loading,
        loginAdmin,
        logoutAdmin,
        loginStudent,
        signupStudent,
        logoutStudent,
        refreshStudent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
