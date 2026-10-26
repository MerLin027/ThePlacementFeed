import axios from 'axios';

// In production the API is reached through the site's own domain: Vercel proxies /api to Render
// (client/vercel.json), so the session cookie is first-party. Phone browsers (all of iOS, many
// Android ones) drop cookies set by another site, which made logging in on a phone fail.
const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Sign-in requests answer 401 for a wrong password: that's not an expired session
const NO_EXPIRY_URLS = ['/api/auth/login', '/api/auth/signup', '/api/auth/session'];

/**
 * One interceptor for the whole site, set up by AuthContext:
 * - 401 on any other request: the session ended (expired, idle, revoked, account disabled). The
 *   account is cleared and the person is sent to the login page, then back here afterwards.
 * - 403 PASSWORD_CHANGE_REQUIRED: a reset or new account must set its own password first.
 */
let interceptorId = null;

export const setupAuthInterceptor = ({ onExpired, navigate }) => {
  if (interceptorId !== null) {
    api.interceptors.response.eject(interceptorId);
  }

  interceptorId = api.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = error.config?.url || '';
      const status = error.response?.status;
      const code = error.response?.data?.code;

      if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
        navigate('/change-password');
      } else if (status === 401 && !NO_EXPIRY_URLS.includes(url)) {
        // On a guarded page the route guard also redirects once the account clears; it reads the
        // same reason, so both land on the same URL
        const reason = code === 'TEMP_PASSWORD_EXPIRED' ? 'temp' : true;
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        onExpired(reason);
        navigate(`/login?expired=${reason}&returnTo=${returnTo}`);
      }
      return Promise.reject(error);
    }
  );
};

export default api;
