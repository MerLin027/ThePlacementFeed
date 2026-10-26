const mongoose = require('mongoose');
const Admin = require('../../models/Admin');
const Student = require('../../models/Student');
const { readSession } = require('./sessions');
const { ADMIN_COOKIE, STUDENT_COOKIE } = require('./constants');
const { fail } = require('../../lib/http');

const deny = (res, message) => fail(res, 401, message);

/**
 * Admin session guard. The account is read on every request, so a replaced admin
 * (scripts/resetAdmin.js) or a password change (tokenVersion bump) ends old sessions at once.
 * Tokens from before tokenVersion existed carry none and match version 0.
 */
const requireAdmin = async (req, res, next) => {
  const { present, claims } = readSession(req, 'admin');
  if (!present) return deny(res, 'Authentication required');
  if (!claims || !mongoose.isValidObjectId(claims.sub)) return deny(res, 'Invalid or expired token');

  try {
    const admin = await Admin.findById(claims.sub).select('username tokenVersion').lean();
    if (!admin || (admin.tokenVersion ?? 0) !== (claims.tv ?? 0)) return deny(res, 'Invalid or expired token');
    req.admin = { id: claims.sub, username: admin.username };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Student session guards. After an admin password reset, `mustChangePassword` is set and the
 * session is restricted: every route is denied with PASSWORD_CHANGE_REQUIRED unless it uses
 * requireStudentAllowPending (session check, profile read, change password). Deny by default:
 * new routes are restricted automatically.
 */
const buildRequireStudent = ({ allowPendingPasswordChange }) => async (req, res, next) => {
  const { present, claims } = readSession(req, 'student');
  if (!present) return deny(res, 'Authentication required');
  if (!claims || !mongoose.isValidObjectId(claims.sub)) return deny(res, 'Invalid or expired session');

  try {
    const student = await Student.findById(claims.sub).select('tokenVersion mustChangePassword').lean();
    // Account deleted, or token revoked by a password change/reset
    if (!student || student.tokenVersion !== claims.tv) return deny(res, 'Invalid or expired session');

    if (student.mustChangePassword && !allowPendingPasswordChange) {
      return fail(res, 403, 'Please set a new password to continue.', { code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    req.student = { id: claims.sub, mustChangePassword: student.mustChangePassword };
    next();
  } catch (error) {
    next(error);
  }
};

const requireStudent = buildRequireStudent({ allowPendingPasswordChange: false });
const requireStudentAllowPending = buildRequireStudent({ allowPendingPasswordChange: true });

// For the session probes: with no session cookie at all the visitor is simply logged out, so answer
// 200 { authenticated: false } instead of 401 (every page asks on load, and a 401 there showed up as
// a console error for every guest). A cookie that is present but expired, forged, revoked or of the
// wrong role still reaches the real guard and gets its 401.
const PROBE_COOKIES = { admin: ADMIN_COOKIE, student: STUDENT_COOKIE };
const sessionProbe = (role) => (req, res, next) => {
  if (!req.cookies?.[PROBE_COOKIES[role]]) return res.json({ success: true, authenticated: false });
  next();
};

module.exports = { requireAdmin, requireStudent, requireStudentAllowPending, sessionProbe };
