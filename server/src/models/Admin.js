const mongoose = require('mongoose');

const STAFF_ROLES = ['super_admin', 'admin'];

// Only the super admin has a username (admins sign in with their email). No "@", so it can never be
// mistaken for an email. Checked when it is set (features/staff/profile); not here, so the original
// admin's username keeps working whatever it is.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/**
 * A staff account (shown as an admin in the website). There is exactly one super admin (a unique
 * index below makes a second impossible): it signs in with its username or email and manages the
 * team (features/staff). Admins are created by it with a name and an email, and sign in with the
 * email. Students live in their own collection; one sign-in page serves both (features/auth), and an
 * email can belong to only one account of either kind.
 *
 * Indexes are built at startup by features/auth/seed.js, after it has moved older data out of their
 * way (autoIndex is off for this model).
 */
const adminSchema = new mongoose.Schema({
  // The super admin's; an admin from before 2026-10-27 may still have one until it has an email
  username: { type: String, trim: true, lowercase: true },
  name: { type: String, trim: true, maxlength: 100 },
  // Required for admins (their sign-in); optional for the super admin
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, enum: STAFF_ROLES, default: 'admin', required: true },
  // A disabled account can't sign in, and disabling it ends its sessions
  active: { type: Boolean, default: true },
  // Never loaded unless a query asks for it (.select('+passwordHash'))
  passwordHash: { type: String, required: true, select: false },
  // Set for a new account or after a reset: the one-time password only opens change-password
  mustChangePassword: { type: Boolean, default: false },
  tempPasswordExpiresAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, {
  autoIndex: false,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

adminSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
adminSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
// One super admin, enforced by the database whatever the code above it does
adminSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: 'super_admin' }, name: 'one_super_admin' });

// Every account needs something to sign in with
adminSchema.pre('validate', function () {
  if (this.role === 'super_admin' && !this.username) this.invalidate('username', 'The super admin needs a username');
  if (!this.username && !this.email) this.invalidate('email', 'An email is required');
});

module.exports = mongoose.model('Admin', adminSchema);
Object.assign(module.exports, { STAFF_ROLES, USERNAME_PATTERN });
