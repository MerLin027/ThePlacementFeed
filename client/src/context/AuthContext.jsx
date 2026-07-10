import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setup401Interceptor } from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearAuth = useCallback(() => {
    setIsAdmin(false);
  }, []);

  // Set up 401 interceptor
  useEffect(() => {
    setup401Interceptor(clearAuth, navigate);
  }, [clearAuth, navigate]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/api/auth/check');
        if (res.data.authenticated) {
          setIsAdmin(true);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    if (res.data.success) {
      setIsAdmin(true);
    }
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if the request fails, clear local state
    }
    setIsAdmin(false);
    navigate('/admin/login');
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
