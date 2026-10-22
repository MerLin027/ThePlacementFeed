import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Requests under these prefixes use the student session; everything else is admin
const STUDENT_API_PREFIXES = ['/api/students', '/api/applications'];

// Login/check probes are expected to 401 when logged out — never redirect on them
const AUTH_PROBE_URLS = [
  '/api/auth/login',
  '/api/auth/check',
  '/api/students/auth/login',
  '/api/students/auth/signup',
  '/api/students/auth/check',
];

const isStudentRequest = (url = '') =>
  STUDENT_API_PREFIXES.some((prefix) => url.startsWith(prefix));

/**
 * Set up a global interceptor that clears auth state and redirects when a
 * session expires, or when a student must change a reset password first.
 * Called from AuthContext on mount.
 */
let interceptorId = null;

export const setupAuthInterceptor = ({ onAdminExpired, onStudentExpired, navigate }) => {
  // Remove previous interceptor if it exists
  if (interceptorId !== null) {
    api.interceptors.response.eject(interceptorId);
  }

  interceptorId = api.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = error.config?.url || '';
      const status = error.response?.status;

      if (status === 403 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
        navigate('/change-password');
      } else if (status === 401 && !AUTH_PROBE_URLS.includes(url)) {
        // On a guarded page the route guard also redirects once state clears;
        // it reads the expired flag from AuthContext so both land on the same URL.
        if (isStudentRequest(url)) {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          onStudentExpired();
          navigate(`/login?expired=true&returnTo=${returnTo}`);
        } else {
          onAdminExpired();
          navigate('/admin/login?expired=true');
        }
      }
      return Promise.reject(error);
    }
  );
};

export default api;
