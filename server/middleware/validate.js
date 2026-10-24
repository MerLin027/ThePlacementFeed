const { body, query, param, validationResult } = require('express-validator');
const {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  DEFAULT_STUDENT_PASSWORD,
} = require('../constants/auth');
const catalog = require('../services/catalog');
const { BRANCH_CODE_PATTERN } = require('../models/Branch');
const { NONE, STUDENT_SORTS, APPLICANT_SORTS } = require('../services/adminFilters');
const { APPLICATION_STATUSES } = require('../models/Application');

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
  // Text fields are type-checked before .trim(), which would otherwise turn 123 or {} into "123"/"[object Object]"
  body('company')
    .notEmpty()
    .withMessage('Company name is required')
    .bail()
    .isString()
    .withMessage('Company name must be text')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 200 })
    .withMessage('Company name cannot exceed 200 characters'),

  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .bail()
    .isString()
    .withMessage('Role must be text')
    .bail()
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
    .withMessage('Each branch must be a string')
    .bail()
    .custom((value) => catalog.isBranchCode(value))
    .withMessage('Unknown branch'),

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
    .withMessage('Deadline must be a valid date')
    .bail()
    .custom((value, { req }) => {
      const driveDate = req.body.driveDate;
      if (!value || !driveDate) return true;
      return new Date(value).getTime() <= new Date(driveDate).getTime();
    })
    .withMessage('Deadline cannot be after the drive date'),

  // "auto" = status follows the dates; a real status pins it manually
  body('status')
    .optional()
    .isIn(['auto', ...VALID_STATUSES])
    .withMessage(`Status must be auto or one of: ${VALID_STATUSES.join(', ')}`),

  body('jdDescription')
    .optional()
    .isString()
    .withMessage('JD description must be text')
    .bail()
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
    .notEmpty()
    .withMessage('Each round must have a roundName')
    .bail()
    .isString()
    .withMessage('Round name must be text')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Each round must have a roundName')
    .isLength({ max: 200 })
    .withMessage('Round name cannot exceed 200 characters'),

  body('selectionRounds.*.roundDescription')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Round description must be text')
    .bail()
    .isLength({ max: 1000 })
    .withMessage('Round description cannot exceed 1000 characters'),

  body('isPostponed')
    .optional()
    .isBoolean()
    .withMessage('isPostponed must be a boolean')
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

  // The institute is a one-time choice on the profile (PUT /api/students/me/institute)
  body('institute').not().exists().withMessage('Choose your institute on your profile after signing up'),

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
    // Archived branches are still accepted here; routes/students.js only lets a student keep one
    .custom((value) => value === '' || catalog.isBranchCode(value))
    .withMessage('Please choose a branch from the list'),

  optionalNumber('cgpa', { min: 0, max: 10 }, 'CGPA must be between 0 and 10'),
  optionalNumber('activeBacklogs', { min: 0, max: 50, int: true }, 'Active backlogs must be a whole number from 0 to 50'),
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

// A restricted (reset) session was opened with the temporary password, so it isn't asked for again
const notResetSession = (value, { req }) => !req.student?.mustChangePassword;

const changePasswordRules = [
  body('currentPassword')
    .if(notResetSession)
    .isString()
    .withMessage('Current password is required')
    .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
    .withMessage('Current password is required'),

  passwordRule('newPassword')
    .custom((value, { req }) => !notResetSession(value, { req }) || value !== req.body.currentPassword)
    .withMessage('Your new password must be different from the current one'),
];

const chooseInstituteRules = [
  body('instituteId').isMongoId().withMessage('Please choose an institute from the list'),
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

// --- Admin: students ---

const SORT_LIST = (sorts) => Object.keys(sorts);

// Comma-joined values ("Applied,Offered"), each checked; arrays (repeated keys) are rejected
const commaList = (field, check, message) =>
  query(field)
    .optional()
    .isString()
    .withMessage(message)
    .bail()
    .custom((value) => value.split(',').length <= 20 && value.split(',').every((v) => v !== '' && check(v)))
    .withMessage(message);

const isYear = (v) => /^\d{4}$/.test(v) && Number(v) >= 2020 && Number(v) <= 2040;
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Filters both admin lists share
const academicFilterRules = [
  commaList('gradYear', isYear, 'gradYear must be years from 2020 to 2040'),
  query('cgpaMin').optional().isFloat({ min: 0, max: 10 }).withMessage('cgpaMin must be between 0 and 10').toFloat(),
  query('cgpaMax').optional().isFloat({ min: 0, max: 10 }).withMessage('cgpaMax must be between 0 and 10').toFloat(),
  query('backlogsMax').optional().isInt({ min: 0, max: 50 }).withMessage('backlogsMax must be a whole number from 0 to 50').toInt(),
];

const adminStudentListRules = [
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be text')
    .trim()
    .isLength({ max: 100 })
    .withMessage('search cannot exceed 100 characters'),
  query('branch').optional().custom((value) => value === NONE || catalog.isBranchCode(value)).withMessage('Unknown branch'),
  query('institute').optional().custom((value) => value === NONE || /^[a-f0-9]{24}$/i.test(value)).withMessage('Unknown institute'),
  ...academicFilterRules,
  query('profile').optional().isIn(['complete', 'incomplete', 'no_institute']).withMessage('profile must be complete, incomplete or no_institute'),
  query('account').optional().isIn(['reset_pending']).withMessage('account must be reset_pending'),
  query('applications').optional().isIn(['applied', 'never', 'selected']).withMessage('applications must be applied, never or selected'),
  query('joinedFrom').optional().custom(isDay).withMessage('joinedFrom must be a date (YYYY-MM-DD)'),
  query('joinedTo').optional().custom(isDay).withMessage('joinedTo must be a date (YYYY-MM-DD)'),
  query('sort').optional().isIn(SORT_LIST(STUDENT_SORTS)).withMessage(`sort must be one of: ${SORT_LIST(STUDENT_SORTS).join(', ')}`),
];

const adminStudentDeleteRules = [
  query('applications').optional().isIn(['retain', 'delete']).withMessage('applications must be retain or delete'),
];

const mongoIdParam = (name) => [param(name).isMongoId().withMessage('Invalid ID')];

// --- Admin: applicants ---

// Filters shared by the applicant list and the export
const applicantFilterRules = [
  commaList('status', (v) => APPLICATION_STATUSES.includes(v), 'Unknown status'),
  query('branch').optional().custom((value) => catalog.isBranchCode(value)).withMessage('Unknown branch'),
  query('institute').optional().isString().withMessage('institute must be text').bail().isLength({ max: 120 }).withMessage('institute is too long'),
  ...academicFilterRules,
  query('appliedFrom').optional().custom(isDay).withMessage('appliedFrom must be a date (YYYY-MM-DD)'),
  query('appliedTo').optional().custom(isDay).withMessage('appliedTo must be a date (YYYY-MM-DD)'),
  query('account').optional().isIn(['active', 'deleted']).withMessage('account must be active or deleted'),
  query('answers').optional().isIn(['note', 'all_questions']).withMessage('answers must be note or all_questions'),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be text')
    .trim()
    .isLength({ max: 100 })
    .withMessage('search cannot exceed 100 characters'),
  query('sort').optional().isIn(SORT_LIST(APPLICANT_SORTS)).withMessage(`sort must be one of: ${SORT_LIST(APPLICANT_SORTS).join(', ')}`),
];

const applicantListRules = [
  ...applicantFilterRules,
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
];

const applicantUpdateRules = [
  body('status').optional().isIn(APPLICATION_STATUSES).withMessage('Unknown status'),
  body('adminNote')
    .optional()
    .isString()
    .withMessage('Note must be text')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note cannot exceed 1000 characters'),
  body().custom((value) => value && (value.status !== undefined || value.adminNote !== undefined))
    .withMessage('Nothing to update'),
];

const applicantBulkRules = [
  body('applicationIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Select between 1 and 100 applicants'),
  body('applicationIds.*').isMongoId().withMessage('Invalid applicant'),
  body('status').isIn(APPLICATION_STATUSES).withMessage('Unknown status'),
];

const applicantBulkDeleteRules = [
  body('applicationIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Select between 1 and 100 applicants'),
  body('applicationIds.*').isMongoId().withMessage('Invalid applicant'),
];

// --- Admin: catalog (branches, institutes, university) ---

const catalogName = (field, label, { optional = false } = {}) => {
  const chain = optional ? body(field).optional() : body(field);
  return chain
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage(`${label} must be 2–120 characters`);
};

const branchCreateRules = [
  body('code')
    .isString()
    .withMessage('Branch code is required')
    .bail()
    .trim()
    .toUpperCase()
    .matches(BRANCH_CODE_PATTERN)
    .withMessage('Use 1–12 letters or digits; / & . - are allowed, commas are not'),
  catalogName('name', 'Branch name'),
];

const catalogUpdateRules = (label) => [
  catalogName('name', label, { optional: true }),
  body('active').optional().isBoolean({ strict: true }).withMessage('active must be true or false'),
  body().custom((value) => value && (value.name !== undefined || value.active !== undefined))
    .withMessage('Nothing to update'),
];

const instituteCreateRules = [catalogName('name', 'Institute name')];

const universityRules = [catalogName('name', 'College/University name')];

const catalogDeleteRules = [
  query('force').optional().isIn(['true', 'false']).withMessage('force must be true or false'),
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
  chooseInstituteRules,
  applicationSubmitRules,
  adminStudentListRules,
  adminStudentDeleteRules,
  mongoIdParam,
  applicantFilterRules,
  applicantListRules,
  applicantUpdateRules,
  applicantBulkRules,
  applicantBulkDeleteRules,
  branchCreateRules,
  catalogUpdateRules,
  instituteCreateRules,
  universityRules,
  catalogDeleteRules,
  validate,
};
