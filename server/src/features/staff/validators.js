const { body } = require('express-validator');
const { STAFF_ROLES, USERNAME_PATTERN } = require('../../models/Admin');

const nameRule = (optional) =>
  (optional ? body('name').optional() : body('name'))
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2–100 characters');

// Optional everywhere: '' removes it
const emailRule = body('email')
  .optional()
  .isString()
  .withMessage('Email must be text')
  .bail()
  .trim()
  .toLowerCase()
  .custom((value) => value === '' || (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))
  .withMessage('Please enter a valid email address');

const roleRule = (optional) =>
  (optional ? body('role').optional() : body('role'))
    .isIn(STAFF_ROLES)
    .withMessage(`Role must be one of: ${STAFF_ROLES.join(', ')}`);

const createStaffRules = [
  nameRule(false),
  body('username')
    .isString()
    .withMessage('Username is required')
    .bail()
    .trim()
    .toLowerCase()
    .matches(USERNAME_PATTERN)
    .withMessage('Username must be 3–32 letters, digits, dots, hyphens or underscores, starting with a letter or digit'),
  emailRule,
  roleRule(false),
];

const updateStaffRules = [
  nameRule(true),
  emailRule,
  roleRule(true),
  body('active').optional().isBoolean({ strict: true }).withMessage('active must be true or false'),
  body().custom((value) => value && ['name', 'email', 'role', 'active'].some((key) => value[key] !== undefined))
    .withMessage('Nothing to update'),
];

module.exports = { createStaffRules, updateStaffRules };
