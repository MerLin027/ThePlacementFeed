import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/auth';
import Spinner from './Spinner';

export const PageSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Spinner size="lg" label="Loading" />
  </div>
);

/**
 * Route guard for admin and student pages. UI-only — the API enforces the
 * same rules server-side on every request.
 *
 * `allowPendingPasswordChange` lets the change-password page render for a
 * student whose password was reset by the admin; every other student page
 * sends them there first.
 */
const RequireRole = ({ role, allowPendingPasswordChange = false, children }) => {
  const { isAdmin, adminSessionExpired, student, studentSessionExpired, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageSpinner />;
  }

  if (role === 'admin') {
    if (isAdmin) return children;
    return <Navigate to={adminSessionExpired ? '/admin/login?expired=true' : '/admin/login'} replace />;
  }

  if (!student) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    const expired = studentSessionExpired ? 'expired=true&' : '';
    return <Navigate to={`/login?${expired}returnTo=${returnTo}`} replace />;
  }

  if (student.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

export default RequireRole;
