const jwt = require('jsonwebtoken');
const { ADMIN_COOKIE, JWT_ALGORITHM } = require('../constants/auth');

const requireAdmin = (req, res, next) => {
  try {
    const token = req.cookies[ADMIN_COOKIE];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });

    // Student tokens are signed with the same secret — the role claim keeps them out
    if (decoded.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.admin = { id: decoded.sub, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

module.exports = requireAdmin;
