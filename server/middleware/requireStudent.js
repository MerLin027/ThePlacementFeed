const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { STUDENT_COOKIE, JWT_ALGORITHM } = require('../constants/auth');

const unauthorized = (res) =>
  res.status(401).json({
    success: false,
    message: 'Invalid or expired session',
  });

/**
 * Builds the student auth middleware.
 *
 * After an admin password reset, `mustChangePassword` is set and the session is
 * restricted: every route is denied with PASSWORD_CHANGE_REQUIRED unless it
 * explicitly opts in via `allowPendingPasswordChange` (check, profile read,
 * change password). Deny by default — new routes are restricted automatically.
 */
const buildRequireStudent = ({ allowPendingPasswordChange }) => async (req, res, next) => {
  try {
    const token = req.cookies[STUDENT_COOKIE];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      return unauthorized(res);
    }

    if (decoded.role !== 'student' || !mongoose.isValidObjectId(decoded.sub)) {
      return unauthorized(res);
    }

    const student = await Student.findById(decoded.sub)
      .select('tokenVersion mustChangePassword')
      .lean();

    // Account deleted, or token revoked by a password change/reset
    if (!student || student.tokenVersion !== decoded.tv) {
      return unauthorized(res);
    }

    if (student.mustChangePassword && !allowPendingPasswordChange) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Please set a new password to continue.',
      });
    }

    req.student = {
      id: decoded.sub,
      mustChangePassword: student.mustChangePassword,
    };
    next();
  } catch (error) {
    next(error);
  }
};

const requireStudent = buildRequireStudent({ allowPendingPasswordChange: false });
const requireStudentAllowPending = buildRequireStudent({ allowPendingPasswordChange: true });

module.exports = { requireStudent, requireStudentAllowPending };
