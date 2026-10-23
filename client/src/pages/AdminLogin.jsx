import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import FormField from '../components/FormField';
import { usePageTitle } from '../hooks/usePageTitle';

const AdminLogin = () => {
  usePageTitle('Admin login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Redirect if already logged in
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  // Show expired message if redirected from 401 interceptor
  const expired = searchParams.get('expired') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-lg px-sm">
      <div className="w-full max-w-(--container-md)">
        {/* Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          {/* Header */}
          <div className="px-md pt-md pb-md text-center">
            <div className="w-14 h-14 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-sm">
              <span className="material-symbols-outlined text-on-primary text-[28px]">lock</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-base">Admin login</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Sign in to manage placement drives</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-md pb-md space-y-sm">
            {/* Session expired alert */}
            {expired && !error && (
              <div className="p-sm bg-amber-50 border border-amber-200 rounded-lg font-body-sm text-body-sm text-amber-700 flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                Session expired. Please log in again.
              </div>
            )}

            {/* Error alert */}
            {error && (
              <div className="p-sm bg-error-container border border-error/20 rounded-lg font-body-sm text-body-sm text-on-error-container">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="label">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>

            <FormField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-xs">
                  <Spinner size="sm" tone="current" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant mt-md">
          This is a restricted area. Only authorized administrators can access the dashboard.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
