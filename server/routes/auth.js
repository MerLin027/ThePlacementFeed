const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const csrfCheck = require('../middleware/csrfCheck');

const router = express.Router();

// Rate limit login attempts: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cookie options — conditional for cross-domain production
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    maxAge: 3 * 60 * 60 * 1000, // 3 hours
    path: '/',
  };
};

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
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Must use same options as set (minus maxAge) for browser to clear
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/check — verify if current cookie is valid
router.get('/check', auth, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
  });
});

module.exports = router;
