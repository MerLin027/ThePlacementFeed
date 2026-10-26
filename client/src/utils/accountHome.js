import { safeReturnTo } from './safeReturnTo';

// Where each kind of account starts
export const homeFor = (account) => (account?.type === 'staff' ? '/admin/dashboard' : '/');

/**
 * Where to go after signing in: the change-password page while a reset password must be replaced;
 * otherwise back where the person was going, when that page is for their kind of account (staff go
 * back to staff pages, students to everything else), or their start page.
 */
export const afterSignIn = (account, rawReturnTo) => {
  if (account.mustChangePassword) return '/change-password';
  const returnTo = safeReturnTo(rawReturnTo, null);
  if (returnTo) {
    const isStaffPage = returnTo.startsWith('/admin');
    if (isStaffPage === (account.type === 'staff')) return returnTo;
  }
  return homeFor(account);
};
