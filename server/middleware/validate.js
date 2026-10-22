const { body, validationResult } = require('express-validator');
const {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  DEFAULT_STUDENT_PASSWORD,
  INSTITUTES,
} = require('../constants/auth');
const { BRANCHES } = require('../constants/branches');

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const VALID_TYPES = ['Full-Time', 'Internship', '6M Intern + FTE'];
const VALID_STATUSES = ['Upcoming', 'Ongoing', 'Completed'];

// Validation rules for creating/updating a placement
const placementValidationRules = [
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 200 })
    .withMessage('Company name cannot exceed 200 characters'),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isLength({ max: 200 })
    .withMessage('Role cannot exceed 200 characters'),

  body('type')
    .trim()
    .notEmpty()
    .withMessage('Type is required')
    .isIn(VALID_TYPES)
    .withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('ctc')
    .notEmpty()
    .withMessage('CTC is required')
    .isFloat({ min: 0 })
    .withMessage('CTC must be a non-negative number')
    .toFloat(),

  body('eligibility.branches')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Branches must be an array with at most 20 items'),

  body('eligibility.branches.*')
    .optional()
    .isString()
    .withMessage('Each branch must be a string'),

  body('eligibility.cgpa')
    .optional({ values: 'null' })
    .isFloat({ min: 0, max: 10 })
    .withMessage('CGPA must be between 0 and 10')
    .toFloat(),

  body('eligibility.backlog')
    .optional({ values: 'null' })
    .isInt({ min: 0 })
    .withMessage('Backlog count must be a non-negative integer')
    .toInt(),

  body('driveDate')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Drive date must be a valid date'),

  body('deadline')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Deadline must be a valid date'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

  body('jdDescription')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('JD description cannot exceed 10000 characters'),

  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with at most 20 items'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('formUrl')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Form URL cannot exceed 500 characters')
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Form URL must be a valid HTTPS URL'),

  body('selectionRounds')
    .optional()
    .isArray({ max: 10 })
    .withMessage('selectionRounds must be an array with at most 10 items'),

  body('selectionRounds.*.roundName')
    .trim()
    .notEmpty()
    .withMessage('Each round must have a roundName')
    .isLength({ max: 200 })
    .withMessage('Round name cannot exceed 200 characters'),

  body('selectionRounds.*.roundDescription')
    .optional({ values: 'falsy' })
    .isLength({ max: 1000 })
    .withMessage('Round description cannot exceed 1000 characters'),

  body('isPostponed')
    .optional()
    .isBoolean()
    .withMessage('isPostponed must be a boolean')
    .toBoolean(),

  body('statusManuallySet')
    .optional()
    .isBoolean()
    .withMessage('statusManuallySet must be a boolean')
    .toBoolean(),

  body('applicationMode')
    .optional()
    .isIn(['external', 'in_app', 'both'])
    .withMessage('Application mode must be external, in_app or both')
    .custom((value, { req }) => value !== 'both' || Boolean(req.body.formUrl))
    .withMessage('Add an Application Form URL to offer both ways of applying'),

  body('customPrompts')
    .optional()
    .isArray({ max: 5 })
    .withMessage('A drive can have at most 5 custom questions'),

  body('customPrompts.*.question')
    .isString()
    .withMessage('Each question must be text')
    .trim()
    .notEmpty()
    .withMessage('Questions cannot be empty')
    .isLength({ max: 500 })
    .withMessage('Questions cannot exceed 500 characters'),

  body('customPrompts.*.required')
    .optional()
    .isBoolean()
    .withMessage('required must be a boolean')
    .toBoolean(),
];

// Minimal validation rules for the PATCH /postpone quick-toggle route
const postponeValidationRules = [
  body('isPostponed')
    .notEmpty()
    .withMessage('isPostponed is required')
    .isBoolean()
    .withMessage('isPostponed must be a boolean')
    .toBoolean(),
];

// Minimal validation rules for the PATCH /reset-status-automation quick-toggle route
const resetStatusValidationRules = [
  body('statusManuallySet')
    .notEmpty()
    .withMessage('statusManuallySet is required')
    .isBoolean()
    .withMessage('statusManuallySet must be a boolean')
    .toBoolean(),
];

// --- Student auth ---

const passwordRule = (field) =>
  body(field)
    .isString()
    .withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`)
    .custom((value) => value !== DEFAULT_STUDENT_PASSWORD)
    .withMessage('Please choose a different password');

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

  body('institute')
    .optional()
    .isIn(INSTITUTES)
    .withMessage(`Institute must be one of: ${INSTITUTES.join(', ')}`),

  passwordRule('password'),
];

// Login only checks shape — strength rules apply when a password is set, not when it's used
const studentLoginRules = [
  emailRule,

  body('password')
    .isString()
    .withMessage('Password is required')
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage('Password is required'),
];

// --- Student profile ---
// Every field is optional; an empty string (or null for numbers) clears it.

const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

const optionalName = (field, label) =>
  body(field)
    .optional()
    .isString()
    .withMessage(`${label} must be text`)
    .trim()
    .isLength({ max: 100 })
    .withMessage(`${label} cannot exceed 100 characters`)
    .custom((value) => value === '' || NAME_PATTERN.test(value))
    .withMessage(`${label} can only contain letters, spaces, dots, hyphens and apostrophes`);

const optionalNumber = (field, { min, max, int }, message) => {
  const chain = body(field).optional({ values: 'null' });
  return (int ? chain.isInt({ min, max }) : chain.isFloat({ min, max }))
    .withMessage(message)
    .bail()
    .customSanitizer((value) => (int ? parseInt(value, 10) : parseFloat(value)));
};

const studentProfileRules = [
  optionalName('firstName', 'First name'),
  optionalName('lastName', 'Last name'),

  body('branch')
    .optional()
    .isIn(['', ...BRANCHES])
    .withMessage('Please choose a branch from the list'),

  optionalNumber('cgpa', { min: 0, max: 10 }, 'CGPA must be between 0 and 10'),
  optionalNumber('activeBacklogs', { min: 0, max: 50, int: true }, 'Active backlogs must be a whole number from 0 to 50'),
  optionalNumber('historyBacklogs', { min: 0, max: 50, int: true }, 'Backlog history must be a whole number from 0 to 50'),
  optionalNumber('graduationYear', { min: 2020, max: 2040, int: true }, 'Graduation year must be between 2020 and 2040'),

  body('phone')
    .optional()
    .isString()
    .withMessage('Phone number must be text')
    .trim()
    .customSanitizer((value) => value.replace(/[\s-]/g, ''))
    .custom((value) => value === '' || /^\+?[0-9]{10,15}$/.test(value))
    .withMessage('Phone number must be 10–15 digits, optionally starting with +'),

  body('resumeUrl')
    .optional()
    .isString()
    .withMessage('Resume link must be text')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Resume link cannot exceed 500 characters')
    .custom((value) => value === '' || isHttpsUrl(value))
    .withMessage('Resume link must be a valid https:// URL'),
];

const changePasswordRules = [
  body('currentPassword')
    .isString()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage('Current password is required'),

  passwordRule('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('Your new password must be different from the current one'),
];

// --- Applications ---

const applicationSubmitRules = [
  body('driveId')
    .isMongoId()
    .withMessage('Invalid drive'),

  body('resumeUrl')
    .optional()
    .isString()
    .withMessage('Resume link must be text')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Resume link cannot exceed 500 characters')
    .custom((value) => value === '' || isHttpsUrl(value))
    .withMessage('Resume link must be a valid https:// URL'),

  body('coverNote')
    .optional()
    .isString()
    .withMessage('Note must be text')
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Note cannot exceed 2000 characters'),

  body('consentGiven')
    .custom((value) => value === true)
    .withMessage('Please confirm you agree to share your details'),

  body('customAnswers')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Too many answers'),

  body('customAnswers.*.promptId')
    .isMongoId()
    .withMessage('Invalid question'),

  body('customAnswers.*.answer')
    .isString()
    .withMessage('Answers must be text')
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Answers cannot exceed 2000 characters'),
];

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

module.exports = {
  placementValidationRules,
  postponeValidationRules,
  resetStatusValidationRules,
  studentSignupRules,
  studentLoginRules,
  studentProfileRules,
  changePasswordRules,
  applicationSubmitRules,
  validate,
};
