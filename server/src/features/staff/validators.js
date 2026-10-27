const { body } = require('express-validator');
const { USERNAME_PATTERN } = require('../../models/Admin');
const { PASSWORD_MAX_LENGTH } = require('../auth/constants');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only these fields may be sent; anything else (a role, a username) is refused, not ignored
const onlyFields = (allowed) =>
  body()
    .custom((value) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key)))
    .withMessage(`Only these fields can be sent: ${allowed.join(', ')}`)
    .bail();

const somethingToUpdate = (fields) =>
  body().custom((value) => fields.some((key) => value[key] !== undefined)).withMessage('Nothing to update');

const nameRule = ({ optional, clearable = false }) =>
  (optional ? body('name').optional() : body('name'))
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .custom((value) => (clearable && value === '') || (value.length >= 2 && value.length <= 100))
    .withMessage('Name must be 2–100 characters');

const emailRule = ({ optional, clearable = false }) =>
  (optional ? body('email').optional() : body('email'))
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .toLowerCase()
    .custom((value) => (clearable && value === '') || (value.length <= 254 && EMAIL_PATTERN.test(value)))
    .withMessage('Please enter a valid email address');

// The Team page: admins have a name and an email (their sign-in); the role is always admin
const createStaffRules = [onlyFields(['name', 'email']), nameRule({ optional: false }), emailRule({ optional: false })];

const updateStaffRules = [
  onlyFields(['name', 'email', 'active']),
  nameRule({ optional: true }),
  emailRule({ optional: true }),
  body('active').optional().isBoolean({ strict: true }).withMessage('active must be true or false'),
  somethingToUpdate(['name', 'email', 'active']),
];

// The super admin's own profile: name and email optional ('' clears), the username required.
// Changing the username or email (what you sign in with) needs the current password; the handler
// decides whether it is needed.
const updateProfileRules = [
  onlyFields(['name', 'username', 'email', 'currentPassword']),
  nameRule({ optional: true, clearable: true }),
  body('username')
    .optional()
    .isString()
    .withMessage('Username is required')
    .bail()
    .trim()
    .toLowerCase()
    .matches(USERNAME_PATTERN)
    .withMessage('Username must be 3–32 letters, digits, dots, hyphens or underscores, starting with a letter or digit'),
  emailRule({ optional: true, clearable: true }),
  body('currentPassword')
    .optional()
    .isString()
    .withMessage('Enter your current password')
    .bail()
    .isLength({ max: PASSWORD_MAX_LENGTH })
    .withMessage('Enter your current password'),
  somethingToUpdate(['name', 'username', 'email']),
];

module.exports = { createStaffRules, updateStaffRules, updateProfileRules };
