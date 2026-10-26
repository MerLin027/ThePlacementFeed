const mongoose = require('mongoose');

const STAFF_ROLES = ['super_admin', 'admin'];

// Usernames are what staff type to sign in: no "@", so they can never be mistaken for an email.
// Checked when an account is created (features/staff); not here, so the original admin's username
// keeps working whatever it is.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/**
 * A staff account (shown as an admin in the website). The first one is the super admin; it can
 * create more (features/staff). Students live in their own collection; one sign-in page serves both
 * (features/auth), and an email can belong to only one account of either kind.
 */
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: { type: String, trim: true, maxlength: 100 },
  // Optional; another way to sign in
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
  toJSON: {
    transform: function (doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

adminSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

module.exports = mongoose.model('Admin', adminSchema);
Object.assign(module.exports, { STAFF_ROLES, USERNAME_PATTERN });
