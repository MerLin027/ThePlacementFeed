const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const requireAdmin = require('../middleware/requireAdmin');
const csrfCheck = require('../middleware/csrfCheck');
const { getCookieOptions, getClearCookieOptions } = require('../utils/cookies');
const { ADMIN_COOKIE, ADMIN_SESSION_MS, JWT_ALGORITHM } = require('../constants/auth');

const router = express.Router();

// Rate limit login attempts: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, csrfCheck, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Find admin by username
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    let isMatch = false;
    if (admin) {
      // Compare password
      isMatch = await bcrypt.compare(password, admin.passwordHash);
    } else {
      // Dummy compare to mitigate timing attacks (cost factor 12)
      await bcrypt.compare(password, '$2a$12$GKh7blGTmDJaRLvz9YzfR.mNa5ByAsSvWCpRnGbSpYlJG1.9g0x1u');
    }

    if (!admin || !isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { sub: admin._id.toString(), role: 'admin', username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '3h', algorithm: JWT_ALGORITHM }
    );

    // Set httpOnly cookie
    res.cookie(ADMIN_COOKIE, token, getCookieOptions(ADMIN_SESSION_MS));

    res.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', csrfCheck, (req, res) => {
  // Must use same options as set (minus maxAge) for browser to clear
  res.clearCookie(ADMIN_COOKIE, getClearCookieOptions());

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/check — verify if current cookie is valid
router.get('/check', requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
  });
});

module.exports = router;
