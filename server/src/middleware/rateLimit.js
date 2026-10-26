const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Every rate limit in the API, by name. `limit(name)` returns a new limiter with its own counters,
 * so two routes using the same policy never share a budget.
 *
 * Keys: by visitor address unless noted. Students on campus Wi-Fi share one public address, so
 * address-only limits stay loose and anything per-person is keyed by the account once it is known
 * (these limiters run after the session guard). Counters live in memory: right for the single API
 * instance; they reset when it restarts.
 */
const WINDOW_MS = 15 * 60 * 1000;

const TRY_LATER = 'Too many requests. Please try again later.';
const LOGIN = 'Too many login attempts. Please try again after 15 minutes.';
const ATTEMPTS = 'Too many attempts. Please try again after 15 minutes.';

// For limits on guessing a password: only a wrong password counts (handlers set this flag), not a
// new password the policy turned down or a successful change
const wrongPasswordOnly = (req, res) => !res.locals.wrongPassword;

const byAdmin = (req) => req.admin.id;
const byStudent = (req) => req.student.id;
// ipKeyGenerator groups IPv6 clients by /56 so one user cannot rotate addresses to dodge the limit
const byAddressAndEmail = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${ipKeyGenerator(req.ip)}|${email}`;
};

const POLICIES = {
  // --- Public ---
  publicRead: { limit: 100, message: TRY_LATER },
  catalogRead: { limit: 300, message: TRY_LATER },
  cronTrigger: { limit: 10, message: 'Too many cron trigger attempts. Please try again later.' },

  // --- Sign-in ---
  adminLogin: { limit: 5, message: LOGIN },
  adminPassword: { limit: 5, key: byAdmin, countOnly: wrongPasswordOnly, message: ATTEMPTS },
  studentSignup: { limit: 30, message: 'Too many sign-up attempts. Please try again in a few minutes.' },
  studentLoginAddress: { limit: 100, message: LOGIN },
  // Brute force is throttled per (address, email): wrong passwords only
  studentLoginAccount: { limit: 5, key: byAddressAndEmail, skipSuccessfulRequests: true, message: LOGIN },
  studentSession: { limit: 300, message: TRY_LATER },
  studentPassword: { limit: 5, key: byStudent, countOnly: wrongPasswordOnly, message: ATTEMPTS },

  // --- Students ---
  profileRead: { limit: 300, message: TRY_LATER },
  profileUpdate: { limit: 30, key: byStudent, message: 'Too many updates. Please try again in a few minutes.' },
  applicationsRead: { limit: 300, message: TRY_LATER },
  apply: { limit: 10, key: byStudent, message: 'Too many applications in a short time. Please try again in a few minutes.' },

  // --- Admin ---
  driveWrite: { limit: 50, message: 'Too many updates. Please try again later.' },
  applicantsRead: { limit: 300, message: TRY_LATER },
  applicantsWrite: { limit: 200, message: 'Too many updates. Please try again in a few minutes.' },
  // Exports are expensive and move a lot of personal data at once
  applicantsExport: { limit: 5, message: 'Too many exports. Please try again in a few minutes.' },
  studentsRead: { limit: 300, message: TRY_LATER },
  studentsWrite: { limit: 30, message: 'Too many account changes. Please try again in a few minutes.' },
  catalogAdminRead: { limit: 300, message: TRY_LATER },
  catalogAdminWrite: { limit: 60, message: 'Too many changes. Please try again in a few minutes.' },
  insightsRead: { limit: 120, message: TRY_LATER },
};

const limit = (name) => {
  const policy = POLICIES[name];
  if (!policy) throw new Error(`Unknown rate-limit policy: ${name}`);
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: policy.limit,
    ...(policy.key && { keyGenerator: policy.key }),
    ...(policy.skipSuccessfulRequests && { skipSuccessfulRequests: true }),
    ...(policy.countOnly && { skipSuccessfulRequests: true, requestWasSuccessful: policy.countOnly }),
    message: { success: false, code: 'RATE_LIMITED', message: policy.message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = { limit, POLICIES };
