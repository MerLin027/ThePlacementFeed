import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Set up a global 401 interceptor that clears auth state and redirects
 * to login when the session expires. Called from AuthContext on mount.
 */
let interceptorId = null;

export const setup401Interceptor = (logoutFn, navigateFn) => {
  // Remove previous interceptor if it exists
  if (interceptorId !== null) {
    api.interceptors.response.eject(interceptorId);
  }

  interceptorId = api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (
        error.response?.status === 401 &&
        !error.config?.url?.includes('/api/auth/login') &&
        !error.config?.url?.includes('/api/auth/check')
      ) {
        logoutFn();
        navigateFn('/admin/login?expired=true');
      }
      return Promise.reject(error);
    }
  );
};

export default api;
