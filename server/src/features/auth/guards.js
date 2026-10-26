const Admin = require('../../models/Admin');
const Student = require('../../models/Student');
const { fail } = require('../../lib/http');
const { readSession, endSessionsFor } = require('./sessions');
const { permissionsFor } = require('./permissions');

/**
 * Who is making the request. authenticate() reads the session cookie and loads the account on every
 * request (one indexed read each), so a disabled account, a reset or a deleted account takes effect
 * immediately. It sets:
 *
 *   req.account = { type: 'student' | 'staff', id, role, permissions, mustChangePassword, ... } or null
 *   req.sessionState = 'none' (no cookie) | 'invalid' (unknown, expired, idle, account gone) | 'valid'
 *
 * The require* guards below decide; they are applied once per namespace (routes/student.js,
 * routes/admin.js), so everything mounted after them is covered.
 */

const loadAccount = async ({ accountType, accountId }) => {
  if (accountType === 'student') {
    const student = await Student.findById(accountId).select('email firstName mustChangePassword').lean();
    return student && { type: 'student', id: student._id.toString(), email: student.email, mustChangePassword: Boolean(student.mustChangePassword), permissions: [] };
  }
  const staff = await Admin.findById(accountId).select('username name email role active mustChangePassword').lean();
  if (!staff) return null;
  if (staff.active === false) {
    // Disabling ends sessions; this catches any that slipped through
    await endSessionsFor({ type: 'staff', id: staff._id });
    return null;
  }
  return {
    type: 'staff',
    id: staff._id.toString(),
    username: staff.username,
    name: staff.name || '',
    email: staff.email || '',
    role: staff.role,
    permissions: permissionsFor(staff.role),
    mustChangePassword: Boolean(staff.mustChangePassword),
  };
};

const authenticate = async (req, res, next) => {
  try {
    const { present, session } = await readSession(req);
    const account = session ? await loadAccount(session) : null;
    req.account = account;
    req.sessionState = account ? 'valid' : present ? 'invalid' : 'none';
    next();
  } catch (error) {
    next(error);
  }
};

const unauthenticated = (req, res) =>
  fail(res, 401, req.sessionState === 'invalid' ? 'Invalid or expired session' : 'Authentication required', {
    code: req.sessionState === 'invalid' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED',
  });

/**
 * Requires a signed-in account of the given type. allowPendingPasswordChange: also let through an
 * account whose password was just reset or created (only the routes needed to set a new password).
 * Deny by default: without it, such an account gets 403 PASSWORD_CHANGE_REQUIRED everywhere.
 */
const requireAccount = (type, { allowPendingPasswordChange = false } = {}) => (req, res, next) => {
  if (!req.account) return unauthenticated(req, res);
  if (type && req.account.type !== type) return fail(res, 403, "You don't have access to this.", { code: 'FORBIDDEN' });
  if (req.account.mustChangePassword && !allowPendingPasswordChange) {
    return fail(res, 403, 'Please set a new password to continue.', { code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
};

const requireStudent = requireAccount('student');
const requireStudentAllowPending = requireAccount('student', { allowPendingPasswordChange: true });
const requireStaff = requireAccount('staff');
const requireAnyAccountAllowPending = requireAccount(null, { allowPendingPasswordChange: true });

// A staff permission (features/auth/permissions.js); runs after requireStaff
const requirePermission = (permission) => (req, res, next) => {
  if (!req.account?.permissions.includes(permission)) {
    return fail(res, 403, "You don't have access to this.", { code: 'FORBIDDEN' });
  }
  next();
};

module.exports = {
  authenticate,
  requireStudent,
  requireStudentAllowPending,
  requireStaff,
  requireAnyAccountAllowPending,
  requirePermission,
};
