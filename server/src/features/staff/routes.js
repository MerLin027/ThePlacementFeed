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
 * - nobody changes their own role or disables or deletes themselves;
 * - there is always at least one active super admin;
 * - an account is disabled before it can be deleted;
 * - disabling an account, or resetting its password, ends its sessions at once;
 * - a one-time password is shown once, in the response that creates it, and never again.
 */
const router = express.Router();

const readLimiter = limit('staffRead');
const writeLimiter = limit('staffWrite');

const toStaffDTO = (staff, viewerId) => ({
  id: staff._id.toString(),
  username: staff.username,
  name: staff.name || '',
  email: staff.email || '',
  role: staff.role,
  roleLabel: ROLE_LABELS[staff.role] || staff.role,
  active: staff.active !== false,
  mustChangePassword: Boolean(staff.mustChangePassword),
  createdAt: staff.createdAt,
  lastLoginAt: staff.lastLoginAt || null,
  isYou: staff._id.toString() === viewerId,
});

const notFound = (res) => fail(res, 404, 'Account not found');
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

const activeSuperAdmins = (exceptId) =>
  Admin.countDocuments({ role: 'super_admin', active: { $ne: false }, ...(exceptId && { _id: { $ne: exceptId } }) });

// GET / — every staff account
router.get('/', readLimiter, async (req, res, next) => {
  try {
    const staff = await Admin.find().sort({ role: -1, name: 1, username: 1 }).lean();
    res.json({ success: true, data: staff.map((s) => toStaffDTO(s, req.account.id)) });
  } catch (error) {
    next(error);
  }
});

// POST / — a new account with a one-time password (returned once)
router.post('/', writeLimiter, createStaffRules, validate, async (req, res, next) => {
  try {
    const { name, username, role } = req.body;
    const email = req.body.email || undefined;
    if (email && (await emailInUse(email))) return fieldError(res, 'email', 'This email is already used by another account');

    const { password, fields } = await oneTimePassword();
    let staff;
    try {
      staff = await Admin.create({ name, username, email, role, createdBy: req.account.id, ...fields });
    } catch (error) {
      if (error.code === 11000) {
        return error.keyPattern?.email
          ? fieldError(res, 'email', 'This email is already used by another account')
          : fieldError(res, 'username', 'This username is taken');
      }
      throw error;
    }

    await record(req, 'staff.create', { target: target(staff), details: { role } });
    res.status(201).json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id), temporaryPassword: password });
  } catch (error) {
    next(error);
  }
});

// PATCH /:id — name, email, role, active
router.patch('/:id', writeLimiter, mongoIdParam('id'), updateStaffRules, validate, async (req, res, next) => {
  try {
    const staff = await Admin.findById(req.params.id);
    if (!staff) return notFound(res);

    const self = staff._id.toString() === req.account.id;
    const { name, email, role, active } = req.body;
    if (self && ((role !== undefined && role !== staff.role) || active === false)) {
      return fail(res, 409, "You can't change your own role or disable your own account.", { code: 'SELF_CHANGE' });
    }

    const losesSuperAdmin =
      staff.role === 'super_admin' && staff.active !== false && ((role !== undefined && role !== 'super_admin') || active === false);
    if (losesSuperAdmin && (await activeSuperAdmins(staff._id)) === 0) {
      return fail(res, 409, 'There must always be at least one active super admin.', { code: 'LAST_SUPER_ADMIN' });
    }

    if (email !== undefined && email !== '' && (await emailInUse(email, { type: 'staff', id: staff._id }))) {
      return fieldError(res, 'email', 'This email is already used by another account');
    }

    const changes = {};
    if (name !== undefined) staff.name = changes.name = name;
    if (email !== undefined) {
      staff.email = email === '' ? undefined : email;
      changes.email = true;
    }
    if (role !== undefined && role !== staff.role) staff.role = changes.role = role;
    if (active !== undefined && active !== (staff.active !== false)) staff.active = changes.active = active;
    await staff.save();

    if (changes.active === false) await endSessionsFor({ type: 'staff', id: staff._id });
    await record(req, 'staff.update', {
      target: target(staff),
      // The new role/state; whether the name or email changed, not their values
      details: { role: changes.role, active: changes.active, nameChanged: 'name' in changes || undefined, emailChanged: changes.email },
    });
    res.json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id) });
  } catch (error) {
    if (error.code === 11000) return fieldError(res, 'email', 'This email is already used by another account');
    next(error);
  }
});

// POST /:id/reset-password — a new one-time password (returned once); ends the account's sessions
router.post('/:id/reset-password', writeLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    if (req.params.id === req.account.id) {
      return fail(res, 409, 'Use Change password for your own account.', { code: 'SELF_CHANGE' });
    }
    const { password, fields } = await oneTimePassword();
    const staff = await Admin.findByIdAndUpdate(req.params.id, { $set: fields }, { returnDocument: 'after' });
    if (!staff) return notFound(res);

    await endSessionsFor({ type: 'staff', id: staff._id });
    await record(req, 'staff.resetPassword', { target: target(staff) });
    res.json({ success: true, data: toStaffDTO(staff.toObject(), req.account.id), temporaryPassword: password });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — only a disabled account, never your own
router.delete('/:id', writeLimiter, mongoIdParam('id'), validate, async (req, res, next) => {
  try {
    if (req.params.id === req.account.id) {
      return fail(res, 409, "You can't delete your own account.", { code: 'SELF_CHANGE' });
    }
    const staff = await Admin.findById(req.params.id).lean();
    if (!staff) return notFound(res);
    if (staff.active !== false) {
      return fail(res, 409, 'Disable the account before deleting it.', { code: 'STILL_ACTIVE' });
    }

    await endSessionsFor({ type: 'staff', id: staff._id });
    await Admin.deleteOne({ _id: staff._id });
    await record(req, 'staff.delete', { target: target(staff), details: { role: staff.role } });
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
