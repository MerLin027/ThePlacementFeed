const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const Student = require('../models/Student');
const csrfCheck = require('../middleware/csrfCheck');
const { requireStudentAllowPending } = require('../middleware/requireStudent');
const { studentSignupRules, studentLoginRules, validate } = require('../middleware/validate');
const { getClearCookieOptions } = require('../utils/cookies');
const { issueStudentSession } = require('../utils/studentSession');
const { STUDENT_COOKIE, BCRYPT_COST } = require('../constants/auth');

const router = express.Router();

// Same cost factor as real hashes so unknown-email logins take the same time
const DUMMY_HASH = '$2a$12$GKh7blGTmDJaRLvz9YzfR.mNa5ByAsSvWCpRnGbSpYlJG1.9g0x1u';

// Students on campus Wi-Fi share one public IP, so IP-only limits are kept loose
// and brute force is throttled per (IP, email) pair instead.
const limiterMessage = (message) => ({ success: false, message });

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: limiterMessage('Too many sign-up attempts. Please try again in a few minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: limiterMessage('Too many login attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    // ipKeyGenerator groups IPv6 clients by /56 so one user cannot rotate addresses to dodge the limit
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
  message: limiterMessage('Too many login attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: limiterMessage('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with these details already exists. If this is you, try logging in — or ask the CDPC admin for help.';

// POST /api/students/auth/signup
router.post(
  '/signup',
  signupLimiter,
  csrfCheck,
  studentSignupRules,
  validate,
  async (req, res, next) => {
    try {
      const { email, rollNumber, password } = req.body;
      const institute = req.body.institute || 'CHARUSAT';

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

      let student;
      try {
        student = await Student.create({ email, rollNumber, institute, passwordHash });
      } catch (error) {
        // Same message for a taken email or roll number
        if (error.code === 11000) {
          return res.status(409).json({ success: false, message: DUPLICATE_ACCOUNT_MESSAGE });
        }
        throw error;
      }

      issueStudentSession(res, student);
      res.status(201).json({
        success: true,
        message: 'Account created',
        mustChangePassword: false,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/students/auth/login
router.post(
  '/login',
  loginIpLimiter,
  loginAccountLimiter,
  csrfCheck,
  studentLoginRules,
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const student = await Student.findOne({ email }).select('+passwordHash');

      let isMatch = false;
      if (student) {
        isMatch = await bcrypt.compare(password, student.passwordHash);
      } else {
        // Dummy compare to mitigate timing attacks
        await bcrypt.compare(password, DUMMY_HASH);
      }

      // An expired temporary password is treated exactly like a wrong password
      const tempPasswordExpired =
        student?.mustChangePassword &&
        student.tempPasswordExpiresAt &&
        student.tempPasswordExpiresAt < new Date();

      if (!student || !isMatch || tempPasswordExpired) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      issueStudentSession(res, student);
      res.json({
        success: true,
        message: 'Login successful',
        mustChangePassword: student.mustChangePassword,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/students/auth/logout — clearing a cookie needs no session
router.post('/logout', sessionLimiter, csrfCheck, (req, res) => {
  res.clearCookie(STUDENT_COOKIE, getClearCookieOptions());
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/students/auth/check — allowed while a password change is pending
router.get('/check', sessionLimiter, requireStudentAllowPending, async (req, res, next) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }

    res.json({
      success: true,
      authenticated: true,
      student: {
        id: student._id.toString(),
        email: student.email,
        firstName: student.firstName ?? '',
        // Academic fields let the UI pre-check drive eligibility (the server re-checks on apply)
        branch: student.branch ?? '',
        cgpa: student.cgpa ?? null,
        activeBacklogs: student.activeBacklogs ?? 0,
        missingFields: student.getMissingFields(),
        mustChangePassword: student.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
