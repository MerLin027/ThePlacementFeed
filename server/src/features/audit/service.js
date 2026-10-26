const mongoose = require('mongoose');
const AuditEvent = require('../../models/AuditEvent');

/**
 * The audit trail. record() writes one event to the audit_events collection (kept ~13 months) and
 * one [Audit] line to the log. Events hold ids, counts, flags and enum values only: never emails,
 * names, passwords, tokens or anything a user typed. A failed write is logged and never fails the
 * request it describes.
 */

const asObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : undefined);

// Who made the request: the signed-in admin or student, else anonymous
const actorOf = (req) => {
  if (req.admin) return { type: 'admin', id: asObjectId(req.admin.id) };
  if (req.student) return { type: 'student', id: asObjectId(req.student.id) };
  return { type: 'anonymous' };
};

/**
 * record(req, action, { outcome, actor, target: { type, id }, details })
 * action: dotted name, e.g. 'drive.create', 'admin.login'. outcome: 'success' (default) | 'failure'.
 * actor: overrides the request's (e.g. the account that just logged in).
 */
const record = async (req, action, { outcome = 'success', actor, target, details: given } = {}) => {
  // Plain values only, without the unset ones
  const details = given && JSON.parse(JSON.stringify(given));
  const event = {
    at: new Date(),
    action,
    outcome,
    actor: actor ? { type: actor.type, id: asObjectId(actor.id) } : actorOf(req),
    ...(target && { target: { type: target.type, id: asObjectId(target.id) } }),
    ...(details && Object.keys(details).length > 0 && { details }),
    ip: req.ip,
    requestId: req.id,
  };
  console.info('[Audit]', JSON.stringify(event));
  try {
    await AuditEvent.create(event);
  } catch (error) {
    console.error('[Audit] Could not store the event:', error.message);
  }
};

module.exports = { record };
