import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import api, { setupAuthInterceptor } from '../api/axios';
import { AuthContext } from './auth';

/**
 * Who is signed in. One session per browser, for a student or a staff member alike:
 *
 *   account  — what GET /api/auth/session returns, or null:
 *              students: { type: 'student', email, firstName, branch, cgpa, … , missingFields }
 *              staff:    { type: 'staff', username, name, role, roleLabel, permissions }
 *              both:     mustChangePassword
 *   student / staff — the account when it is that kind, else null
 *   can(permission) — a staff permission (the server checks every request; this only hides UI)
 *
 * sessionExpired explains a session that ended without a logout (true, or 'temp' when a reset
 * password's window ran out); signedOut is where a deliberate logout goes (home for students, the
 * login page for staff), so the guarded page being left sends people there, not to "log in to
 * come back here", and can't race the logout's own navigation.
 */
export const AuthProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const navigate = useNavigate();

  const expire = useCallback((reason = true) => {
    setSessionExpired(reason);
    setAccount(null);
  }, []);

  useEffect(() => {
    setupAuthInterceptor({ onExpired: expire, navigate });
  }, [expire, navigate]);

  // Re-reads the session (after a profile or password change, or to check who is signed in)
  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/session');
      const next = res.data.authenticated ? res.data.account : null;
      if (next) setSessionExpired(false);
      setAccount(next);
      return next;
    } catch {
      setAccount(null);
      return null;
    }
  }, []);

  // Who is signed in, once on load
  useEffect(() => {
    const check = async () => {
      await refresh();
      setLoading(false);
    };
    check();
  }, [refresh]);

  const signedIn = (next) => {
    setSignedOut(false);
    setSessionExpired(false);
    setAccount(next);
    return next;
  };

  // A student's email, or a staff member's username or email
  const login = async (identifier, password) => {
    const res = await api.post('/api/auth/login', { identifier, password });
    return signedIn(res.data.account);
  };

  const signup = async ({ email, rollNumber, password }) => {
    const res = await api.post('/api/auth/signup', { email, rollNumber, password });
    return signedIn(res.data.account);
  };

  const logout = async () => {
    const destination = account?.type === 'staff' ? '/login' : '/';
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if the request fails, forget the account here
    }
    setSignedOut(destination);
    setAccount(null);
    navigate(destination);
  };

  const student = account?.type === 'student' ? account : null;
  const staff = account?.type === 'staff' ? account : null;
  const can = (permission) => Boolean(staff?.permissions?.includes(permission));

  return (
    <AuthContext.Provider
      value={{ account, student, staff, can, loading, sessionExpired, signedOut, login, signup, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};
