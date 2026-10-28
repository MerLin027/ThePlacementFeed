const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Every rate limit in the API, by name. `limit(name)` returns a new limiter with its own counters,
 * so two routes using the same policy never share a budget.
 *
 * Keys. Students on campus Wi-Fi share ONE public address, so a limit counted per address is
 * shared by the whole campus. So:
 * - signed-in requests are counted per account (every route behind a session guard, and the public
 *   ones when the visitor is signed in);
 * - anonymous requests are counted per address, with ceilings sized for a campus behind one address
 *   (each open tab polls the drive change feed every 30 s);
 * - guessing passwords is limited per (address, identifier) on failures only.
 * Counters live in memory: right for the single API instance; they reset when it restarts.
 */
const WINDOW_MS = 15 * 60 * 1000;

const TRY_LATER = 'Too many requests. Please try again later.';
const LOGIN = 'Too many login attempts. Please try again after 15 minutes.';
const ATTEMPTS = 'Too many attempts. Please try again after 15 minutes.';

// For limits on guessing a password: only a wrong password counts (handlers set this flag), not a
// new password the policy turned down or a successful change
const wrongPasswordOnly = (req, res) => !res.locals.wrongPassword;

// ipKeyGenerator groups IPv6 clients by /56 so one user cannot rotate addresses to dodge the limit
const byAddress = (req) => `ip:${ipKeyGenerator(req.ip)}`;
// The signed-in account (these limiters run after a session guard)
const byAccount = (req) => `${req.account.type}:${req.account.id}`;
// Public routes: the account when signed in, otherwise the address
const byAccountOrAddress = (req) => (req.account ? byAccount(req) : byAddress(req));
const byAddressAndIdentifier = (req) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
  return `${byAddress(req)}|${identifier}`;
};

// { account, address }: one ceiling for a signed-in visitor, a larger one for an address that
// may stand for a whole campus
const perVisitor = ({ account, address }) => ({
  key: byAccountOrAddress,
  limit: (req) => (req.account ? account : address),
});

const POLICIES = {
  // --- Public ---
  publicRead: { ...perVisitor({ account: 600, address: 3000 }), message: TRY_LATER },
  // The notification feed, polled every 30 s by every open tab: its own budget, so polling never
  // uses up browsing
  driveChanges: { ...perVisitor({ account: 300, address: 6000 }), message: TRY_LATER },
  catalogRead: { ...perVisitor({ account: 300, address: 3000 }), message: TRY_LATER },
  cronTrigger: { limit: 10, key: byAddress, message: 'Too many cron trigger attempts. Please try again later.' },

  // --- Signing in (students and staff alike) ---
  // A campus signs in from one address (a morning rush); guessing is limited by loginAccount
  login: { limit: 600, key: byAddress, message: LOGIN },
  // Brute force is throttled per (address, identifier): failed attempts only
  loginAccount: { limit: 5, key: byAddressAndIdentifier, skipSuccessfulRequests: true, message: LOGIN },
  studentSignup: { limit: 300, key: byAddress, message: 'Too many sign-up attempts. Please try again in a few minutes.' },
  session: { ...perVisitor({ account: 300, address: 3000 }), message: TRY_LATER },
  password: { limit: 5, key: byAccount, countOnly: wrongPasswordOnly, message: ATTEMPTS },

  // --- Students (behind the student guard: per account) ---
  profileRead: { limit: 300, key: byAccount, message: TRY_LATER },
  profileUpdate: { limit: 30, key: byAccount, message: 'Too many updates. Please try again in a few minutes.' },
  applicationsRead: { limit: 300, key: byAccount, message: TRY_LATER },
  apply: { limit: 10, key: byAccount, message: 'Too many applications in a short time. Please try again in a few minutes.' },

  // --- Staff (behind the staff guard: per account) ---
  driveWrite: { limit: 50, key: byAccount, message: 'Too many updates. Please try again later.' },
  applicantsRead: { limit: 300, key: byAccount, message: TRY_LATER },
  applicantsWrite: { limit: 200, key: byAccount, message: 'Too many updates. Please try again in a few minutes.' },
  // Exports are expensive and move a lot of personal data at once
  applicantsExport: { limit: 5, key: byAccount, message: 'Too many exports. Please try again in a few minutes.' },
  studentsRead: { limit: 300, key: byAccount, message: TRY_LATER },
  studentsWrite: { limit: 30, key: byAccount, message: 'Too many account changes. Please try again in a few minutes.' },
  catalogAdminRead: { limit: 300, key: byAccount, message: TRY_LATER },
  catalogAdminWrite: { limit: 60, key: byAccount, message: 'Too many changes. Please try again in a few minutes.' },
  insightsRead: { limit: 120, key: byAccount, message: TRY_LATER },
  staffRead: { limit: 300, key: byAccount, message: TRY_LATER },
  staffWrite: { limit: 30, key: byAccount, message: 'Too many account changes. Please try again in a few minutes.' },
};

const limit = (name) => {
  const policy = POLICIES[name];
  if (!policy) throw new Error(`Unknown rate-limit policy: ${name}`);
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: policy.limit,
    keyGenerator: policy.key,
    ...(policy.skipSuccessfulRequests && { skipSuccessfulRequests: true }),
    ...(policy.countOnly && { skipSuccessfulRequests: true, requestWasSuccessful: policy.countOnly }),
    message: { success: false, code: 'RATE_LIMITED', message: policy.message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = { limit, POLICIES };
