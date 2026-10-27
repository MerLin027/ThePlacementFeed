const express = require('express');
const Admin = require('../../models/Admin');
const { limit } = require('../../middleware/rateLimit');
const { mongoIdParam, validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { record } = require('../audit/service');
const { hashPassword } = require('../auth/passwords');
const { generateTempPassword } = require('../auth/tempPassword');
const { endSessionsFor } = require('../auth/sessions');
const { emailInUse } = require('../auth/accounts');
const { ROLE_LABELS } = require('../auth/permissions');
const { TEMP_PASSWORD_TTL_MS } = require('../auth/constants');
const { createStaffRules, updateStaffRules } = require('./validators');

/**
 * Mounted at /api/admin/staff — the super admin manages the team (staff:manage). Rules the server
 * enforces whatever the client sends:
 * - every account created here is an admin (name + email); there is one super admin, and nobody
 *   can be promoted to it (the database refuses a second one too);
 * - only admin accounts can be changed here: the super admin's own account is edited on its profile
 *   (profile.routes.js), and only scripts/resetAdmin.js can replace it;
 * - an account is disabled before it can be deleted;
 * - disabling an account, changing its email (its sign-in) or resetting its password ends its
 *   sessions at once;
 * - a one-time password is shown once, in the response that creates it, and never again.
 */
const router = express.Router();

const readLimiter = limit('staffRead');
const writeLimiter = limit('staffWrite');

const toStaffDTO = (staff, viewerId) => ({
  id: staff._id.toString(),
  name: staff.name || '',
  email: staff.email || '',
  role: staff.role,
  roleLabel: ROLE_LABELS[staff.role] || staff.role,
  // An admin from before 2026-10-27 without an email still signs in with its old username
  username: staff.username || null,
  needsEmail: staff.role === 'admin' && !staff.email,
  active: staff.active !== false,
  mustChangePassword: Boolean(staff.mustChangePassword),
  createdAt: staff.createdAt,
  lastLoginAt: staff.lastLoginAt || null,
  isYou: staff._id.toString() === viewerId,
});

const notFound = (res) => fail(res, 404, 'Account not found');
const notAnAdmin = (res) =>
  fail(res, 403, "The super admin's account can only be changed from its own profile.", { code: 'SUPER_ADMIN' });
const target = (staff) => ({ type: 'staff', id: staff._id });

// A one-time password and its expiry, for a new account or a reset
const oneTimePassword = async () => {
  const password = generateTempPassword();
  return {
    password,
    fields: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
    },
  };
};

// GET / — every staff account
router.get('/', readLimiter, async (req, res, next) => {
  try {
    // The super admin first, then admins by name
    const staff = await Admin.find().sort({ role: -1, name: 1, email: 1 }).lean();
    res.json({ success: true, data: staff.map((s) => toStaffDTO(s, req.account.id)) });
  } catch (error) {
    next(error);
  }
});

const EMAIL_TAKEN = 'This email is already used by another account';

// POST / — a new admin with a one-time password (returned once)
router.post('/', writeLimiter, createStaffRules, validate, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (await emailInUse(email)) return fieldError(res, 'email', EMAIL_TAKEN);

    const { password, fields } = await oneTimePassword();
    let staff;
    try {
      staff = await Admin.create({ name, email, role: 'admin', createdBy: req.account.id, ...fields });
    } catch (error) {
      if (error.code === 11000) return fieldError(res, 'email', EMAIL_TAKEN);
      throw error;
    }

    await record(req, 'staff.create', { target: target(staff), details: { role: 'admin' } });
    res.status(201).json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id), temporaryPassword: password });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id — an admin's name, email (their sign-in) or whether the account is active
router.patch('/:id', writeLimiter, mongoIdParam('id'), updateStaffRules, validate, async (req, res, next) => {
  try {
    const staff = await Admin.findById(req.params.id);
    if (!staff) return notFound(res);
    if (staff.role !== 'admin') return notAnAdmin(res);

    const { name, email, active } = req.body;
    const emailChanged = email !== undefined && email !== staff.email;
    if (emailChanged && (await emailInUse(email, { type: 'staff', id: staff._id }))) return fieldError(res, 'email', EMAIL_TAKEN);

    const changes = {};
    if (name !== undefined && name !== staff.name) staff.name = changes.name = name;
    if (emailChanged) {
      staff.email = email;
      // Admins sign in with their email; an old username goes once there is one
      staff.username = undefined;
      changes.email = true;
    }
    if (active !== undefined && active !== (staff.active !== false)) staff.active = changes.active = active;
    await staff.save();

    // A disabled account, or one whose sign-in changed, is signed out everywhere
    if (changes.active === false || changes.email) await endSessionsFor({ type: 'staff', id: staff._id });
    await record(req, 'staff.update', {
      target: target(staff),
      // The new state; whether the name or email changed, not their values
      details: { active: changes.active, nameChanged: 'name' in changes || undefined, emailChanged: changes.email },
    });
    res.json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id) });
  } catch (error) {
    if (error.code === 11000) return fieldError(res, 'email', EMAIL_TAKEN);
    next(error);
  }
});

// POST /:id/reset-password — a new one-time password (returned once); ends the account's sessions
router.post('/:id/reset-password', writeLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const existing = await Admin.findById(req.params.id).select('role').lean();
    if (!existing) return notFound(res);
    if (existing.role !== 'admin') return notAnAdmin(res);

    const { password, fields } = await oneTimePassword();
    const staff = await Admin.findOneAndUpdate({ _id: existing._id, role: 'admin' }, { $set: fields }, { returnDocument: 'after' });
    if (!staff) return notFound(res);

    await endSessionsFor({ type: 'staff', id: staff._id });
    await record(req, 'staff.resetPassword', { target: target(staff) });
    res.json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id), temporaryPassword: password });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — only a disabled admin account
router.delete('/:id', writeLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    const staff = await Admin.findById(req.params.id).lean();
    if (!staff) return notFound(res);
    if (staff.role !== 'admin') return notAnAdmin(res);
    if (staff.active !== false) {
      return fail(res, 409, 'Disable the account before deleting it.', { code: 'STILL_ACTIVE' });
    }

    await endSessionsFor({ type: 'staff', id: staff._id });
    await Admin.deleteOne({ _id: staff._id, role: 'admin' });
    await record(req, 'staff.delete', { target: target(staff), details: { role: staff.role } });
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
