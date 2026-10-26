const mongoose = require('mongoose');

// How long audit events are kept (about 13 months: a full academic year plus a margin)
const AUDIT_RETENTION_SECONDS = 400 * 24 * 60 * 60;

/**
 * The audit trail: who did what to which record, and whether it worked. Written for every admin
 * change and every security event (logins, password changes and resets, account deletion).
 * Never holds emails, names, passwords, tokens or free text a user typed: ids and outcomes only.
 */
const auditEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    action: { type: String, required: true, maxlength: 64 },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    actor: {
      type: { type: String, enum: ['admin', 'student', 'anonymous', 'system'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    // The record acted on, e.g. { type: 'drive', id }
    target: {
      type: { type: String, maxlength: 32 },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    // Counts, flags and enum values only (see features/audit/service.js)
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
    requestId: { type: String, maxlength: 64 },
  },
  { versionKey: false }
);

auditEventSchema.index({ at: 1 }, { expireAfterSeconds: AUDIT_RETENTION_SECONDS });
auditEventSchema.index({ action: 1, at: -1 });
auditEventSchema.index({ 'actor.id': 1, at: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema, 'audit_events');
module.exports.AUDIT_RETENTION_SECONDS = AUDIT_RETENTION_SECONDS;
