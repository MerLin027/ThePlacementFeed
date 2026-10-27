const express = require('express');
const Admin = require('../../models/Admin');
const { limit } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { fail, fieldError } = require('../../lib/http');
const { record } = require('../audit/service');
const catalog = require('../catalog/cache');
const { verifyPassword } = require('../auth/passwords');
const { createSession, endSessionsFor } = require('../auth/sessions');
const { emailInUse, describeAccount } = require('../auth/accounts');
const { ROLE_LABELS } = require('../auth/permissions');
const { updateProfileRules } = require('./validators');

/**
 * Mounted at /api/admin/profile — the super admin's own account (profile:manage). Name and email are
 * optional, the username is required. The username and email are what the account signs in with,
 * so changing either needs the current password (wrong ones count toward a limit of 5 per 15
 * minutes) and signs out every other device. The password itself is changed at /api/auth/password.
 */
const router = express.Router();

const toProfileDTO = (staff) => ({
  id: staff._id.toString(),
  name: staff.name || '',
  username: staff.username || '',
  email: staff.email || '',
  role: staff.role,
  roleLabel: ROLE_LABELS[staff.role] || staff.role,
  createdAt: staff.createdAt || null,
  lastLoginAt: staff.lastLoginAt || null,
});

const sessionGone = (res) => fail(res, 401, 'Invalid or expired session', { code: 'SESSION_EXPIRED' });

// GET / — the profile, and the College/University name it is shown with
router.get('/', limit('staffRead'), async (req, res, next) => {
  try {
    const staff = await Admin.findById(req.account.id).lean();
    if (!staff) return sessionGone(res);
    res.json({ success: true, data: toProfileDTO(staff), university: catalog.getUniversity() });
  } catch (error) {
    next(error);
  }
});

// PATCH / { name?, username?, email?, currentPassword? }
router.patch('/', limit('staffWrite'), limit('password'), updateProfileRules, validate, async (req, res, next) => {
  try {
    const staff = await Admin.findById(req.account.id).select('+passwordHash');
    if (!staff) return sessionGone(res);

    const { name, username, email, currentPassword } = req.body;
    const usernameChanged = username !== undefined && username !== staff.username;
    const emailChanged = email !== undefined && email !== (staff.email || '');
    const signInChanged = usernameChanged || emailChanged;

    if (signInChanged) {
      if (!currentPassword) {
        return fieldError(res, 'currentPassword', 'Enter your current password to change your username or email');
      }
      if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
        res.locals.wrongPassword = true;
        await record(req, 'staff.profile.update', { outcome: 'failure', target: { type: 'staff', id: staff._id } });
        return fieldError(res, 'currentPassword', 'Current password is incorrect');
      }
    }
    if (usernameChanged && (await Admin.exists({ username, _id: { $ne: staff._id } }))) {
      return fieldError(res, 'username', 'This username is taken');
    }
    if (emailChanged && email !== '' && (await emailInUse(email, { type: 'staff', id: staff._id }))) {
      return fieldError(res, 'email', 'This email is already used by another account');
    }

    const nameChanged = name !== undefined && name !== (staff.name || '');
    if (nameChanged) staff.name = name === '' ? undefined : name;
    if (usernameChanged) staff.username = username;
    if (emailChanged) staff.email = email === '' ? undefined : email;
    try {
      await staff.save();
    } catch (error) {
      if (error.code === 11000) {
        return error.keyPattern?.username
          ? fieldError(res, 'username', 'This username is taken')
          : fieldError(res, 'email', 'This email is already used by another account');
      }
      throw error;
    }

    // A new sign-in: every other device is signed out, this one gets a fresh session
    if (signInChanged) {
      await endSessionsFor({ type: 'staff', id: staff._id });
      await createSession(req, res, { type: 'staff', id: staff._id });
    }
    await record(req, 'staff.profile.update', {
      target: { type: 'staff', id: staff._id },
      // Which fields changed, never their values
      details: { nameChanged: nameChanged || undefined, usernameChanged: usernameChanged || undefined, emailChanged: emailChanged || undefined },
    });
    res.json({
      success: true,
      message: 'Profile updated',
      data: toProfileDTO(staff),
      university: catalog.getUniversity(),
      account: describeAccount('staff', staff),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
