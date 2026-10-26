const { body } = require('express-validator');
const { PASSWORD_MAX_LENGTH } = require('./constants');

// Shape only: whether a new password is good enough is decided by passwordPolicy.js in the handler
// (the rules depend on the account)
const passwordShape = (field, message) =>
  body(field)
    .isString()
    .withMessage(message)
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage(message);

const emailRule = body('email')
  .isString()
  .withMessage('Email is required')
  .trim()
  .toLowerCase()
  .isLength({ max: 254 })
  .withMessage('Email cannot exceed 254 characters')
  .isEmail()
  .withMessage('Please enter a valid email address');

// One sign-in for everyone: a student's email, or a staff member's username or email
const loginRules = [
  body('identifier')
    .isString()
    .withMessage('Enter your email or username')
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ min: 1, max: 254 })
    .withMessage('Enter your email or username'),
  passwordShape('password', 'Password is required'),
];

// Students only: staff accounts are created by a super admin
const signupRules = [
  emailRule,

  body('rollNumber')
    .isString()
    .withMessage('Roll number is required')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9]{4,20}$/)
    .withMessage('Roll number must be 4–20 letters or digits'),

  // The institute is a one-time choice on the profile
  body('institute').not().exists().withMessage('Choose your institute on your profile after signing up'),

  passwordShape('password', 'Password is required'),
];

// After a reset (or for a new staff account) the session was opened with the one-time password, so
// the current password isn't asked for again
const notPending = (value, { req }) => !req.account?.mustChangePassword;

const changePasswordRules = [
  // .if() gates only the checks after it, so it comes first
  body('currentPassword')
    .if(notPending)
    .isString()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage('Current password is required'),

  passwordShape('newPassword', 'Password is required')
    .custom((value, { req }) => !notPending(value, { req }) || value !== req.body.currentPassword)
    .withMessage('Your new password must be different from the current one'),
];

module.exports = { loginRules, signupRules, changePasswordRules };
