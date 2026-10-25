import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/auth';
import Spinner from '../components/Spinner';
import FormField from '../components/FormField';
import AuthCard, { FormAlert } from '../components/AuthCard';
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
    <AuthCard
      title="Admin login"
      subtitle="Sign in to manage placement drives."
      footer={
        <p>
          For the CDPC admin. Students{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs">
            log in here
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-sm">
        {expired && !error && (
          <FormAlert tone="warning" icon="warning">Session expired. Please log in again.</FormAlert>
        )}
        {error && <FormAlert>{error}</FormAlert>}

        <div>
          <label htmlFor="username" className="label">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
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
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
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
    </AuthCard>
  );
};

export default AdminLogin;
