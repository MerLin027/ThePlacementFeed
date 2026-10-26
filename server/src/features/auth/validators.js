const { body } = require('express-validator');
const { config } = require('../../config/env');
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require('./constants');

// A password being set: length bounds (bcrypt ignores bytes past 72) and never the reset password
const newPasswordRule = (field) =>
  body(field)
    .isString()
    .withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`)
    .custom((value) => value !== config().defaultStudentPassword)
    .withMessage('Please choose a different password');

// A password being used: shape only; strength rules apply when a password is set
const givenPasswordRule = (field, message) =>
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

const studentSignupRules = [
  emailRule,

  body('rollNumber')
    .isString()
    .withMessage('Roll number is required')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9]{4,20}$/)
    .withMessage('Roll number must be 4–20 letters or digits'),

  // The institute is a one-time choice on the profile (PUT …/institute)
  body('institute').not().exists().withMessage('Choose your institute on your profile after signing up'),

  newPasswordRule('password'),
];

const studentLoginRules = [emailRule, givenPasswordRule('password', 'Password is required')];

// A restricted (reset) session was opened with the temporary password, so it isn't asked for again
const notResetSession = (value, { req }) => !req.student?.mustChangePassword;

const studentChangePasswordRules = [
  // .if() gates only the checks after it, so it comes first
  body('currentPassword')
    .if(notResetSession)
    .isString()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage('Current password is required'),

  newPasswordRule('newPassword')
    .custom((value, { req }) => !notResetSession(value, { req }) || value !== req.body.currentPassword)
    .withMessage('Your new password must be different from the current one'),
];

// The admin always confirms the current password (there is no reset session for the admin)
const adminChangePasswordRules = [
  givenPasswordRule('currentPassword', 'Current password is required'),

  body('newPassword')
    .isString()
    .withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`)
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('Your new password must be different from the current one'),
];

module.exports = { studentSignupRules, studentLoginRules, studentChangePasswordRules, adminChangePasswordRules };
