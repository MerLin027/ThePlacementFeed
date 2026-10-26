const mongoose = require('mongoose');

/**
 * A signed-in browser. The cookie holds a random 256-bit token; only its SHA-256 is stored, so a
 * copy of this collection can't be turned back into working cookies. Deleting a document ends that
 * session at once (logout, password change, admin reset, account disabled or deleted). MongoDB
 * removes expired documents by itself (TTL index on expiresAt).
 */
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    accountType: { type: String, enum: ['student', 'staff'], required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Absolute end: the session never outlives this, however active it is
    expiresAt: { type: Date, required: true },
    // For the staff idle timeout; written at most every few minutes (see features/auth/sessions.js)
    lastUsedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ accountType: 1, accountId: 1 });

module.exports = mongoose.model('Session', sessionSchema);
