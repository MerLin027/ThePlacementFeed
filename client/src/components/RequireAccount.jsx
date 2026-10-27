import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/auth';
import Spinner from './Spinner';
import { homeFor } from '../utils/accountHome';

// Fills the page area (between the header and the footer), so the spinner sits in its middle
export const PageSpinner = () => (
  <div className="flex items-center justify-center h-full min-h-[60vh]">
    <Spinner size="lg" label="Loading" />
  </div>
);

/**
 * Route guard for student and staff pages. UI-only: the API enforces the same rules on every
 * request (and more), this just sends people to the right page.
 *
 * type: 'student' | 'staff'. permission: a staff permission the page needs (constants/permissions).
 * allowPendingPasswordChange: lets the change-password page render for an account whose password was
 * just reset or created; every other guarded page sends it there first.
 */
const RequireAccount = ({ type, permission, allowPendingPasswordChange = false, children }) => {
  const { account, loading, sessionExpired, signedOut, can } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;

  if (!account) {
    // Logged out on purpose: where the logout was going, not "log in to come back here"
    if (signedOut) return <Navigate to={signedOut} replace />;
    const returnTo = encodeURIComponent(location.pathname + location.search);
    const expired = sessionExpired ? `expired=${sessionExpired}&` : '';
    return <Navigate to={`/login?${expired}returnTo=${returnTo}`} replace />;
  }

  if (account.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  // Signed in, but as the other kind of account, or without the permission: back to their start page
  if ((type && account.type !== type) || (permission && !can(permission))) {
    return <Navigate to={homeFor(account)} replace />;
  }

  return children;
};

export default RequireAccount;
