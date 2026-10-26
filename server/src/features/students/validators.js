const { body, query } = require('express-validator');
const catalog = require('../catalog/cache');
const { NONE } = require('../../lib/filters');
const {
  optionalHttpsLink,
  isDay,
  academicFilterRules,
  paginationRules,
  searchRule,
  sortRule,
} = require('../../middleware/validate');
const { STUDENT_SORTS } = require('./filters');

// --- The student's own profile ---
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

const profileRules = [
  optionalName('firstName', 'First name'),
  optionalName('lastName', 'Last name'),

  body('branch')
    .optional()
    // Archived branches are still accepted here; the route only lets a student keep one
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

  optionalHttpsLink('resumeUrl', 'Resume link'),
];

const chooseInstituteRules = [
  body('instituteId').isMongoId().withMessage('Please choose an institute from the list'),
];

// --- Admin: the Students list ---

const adminStudentListRules = [
  ...paginationRules,
  searchRule,
  query('branch').optional().custom((value) => value === NONE || catalog.isBranchCode(value)).withMessage('Unknown branch'),
  query('institute').optional().custom((value) => value === NONE || /^[a-f0-9]{24}$/i.test(value)).withMessage('Unknown institute'),
  ...academicFilterRules,
  query('profile').optional().isIn(['complete', 'incomplete', 'no_institute']).withMessage('profile must be complete, incomplete or no_institute'),
  query('account').optional().isIn(['reset_pending']).withMessage('account must be reset_pending'),
  query('applications').optional().isIn(['applied', 'never', 'selected']).withMessage('applications must be applied, never or selected'),
  query('joinedFrom').optional().custom(isDay).withMessage('joinedFrom must be a date (YYYY-MM-DD)'),
  query('joinedTo').optional().custom(isDay).withMessage('joinedTo must be a date (YYYY-MM-DD)'),
  sortRule(STUDENT_SORTS),
];

const adminStudentDeleteRules = [
  query('applications').optional().isIn(['retain', 'delete']).withMessage('applications must be retain or delete'),
];

module.exports = { profileRules, chooseInstituteRules, adminStudentListRules, adminStudentDeleteRules };
