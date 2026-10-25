const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { ADMIN_COOKIE, JWT_ALGORITHM } = require('../constants/auth');

const invalid = (res) =>
  res.status(401).json({
    success: false,
    message: 'Invalid or expired token',
  });

const requireAdmin = async (req, res, next) => {
  const token = req.cookies[ADMIN_COOKIE];

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
    return invalid(res);
  }

  // Student tokens are signed with the same secret — the role claim keeps them out
  if (decoded.role !== 'admin' || !mongoose.isValidObjectId(decoded.sub)) {
    return invalid(res);
  }

  try {
    const admin = await Admin.findById(decoded.sub).select('username tokenVersion').lean();
    // Account replaced (scripts/resetAdmin.js), or token revoked by a password change.
    // Tokens from before tokenVersion existed carry none and match version 0.
    if (!admin || (admin.tokenVersion ?? 0) !== (decoded.tv ?? 0)) {
      return invalid(res);
    }
    req.admin = { id: decoded.sub, username: admin.username };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
