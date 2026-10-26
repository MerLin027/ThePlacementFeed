const { body } = require('express-validator');
const catalog = require('../catalog/cache');
const { DRIVE_TYPES, DRIVE_STATUSES, APPLICATION_MODES, MAX_CUSTOM_PROMPTS } = require('../../models/Placement');

// Creating or editing a drive (the admin drive form)
const driveRules = [
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
    .isIn(DRIVE_TYPES)
    .withMessage(`Type must be one of: ${DRIVE_TYPES.join(', ')}`),

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
    .isIn(['auto', ...DRIVE_STATUSES])
    .withMessage(`Status must be auto or one of: ${DRIVE_STATUSES.join(', ')}`),

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
    .isIn(APPLICATION_MODES)
    .withMessage('Application mode must be external, in_app or both')
    .custom((value, { req }) => value !== 'both' || Boolean(req.body.formUrl))
    .withMessage('Add an Application Form URL to offer both ways of applying'),

  body('customPrompts')
    .optional()
    .isArray({ max: MAX_CUSTOM_PROMPTS })
    .withMessage(`A drive can have at most ${MAX_CUSTOM_PROMPTS} custom questions`),

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

// PATCH …/postpone
const postponeRules = [
  body('isPostponed')
    .notEmpty()
    .withMessage('isPostponed is required')
    .isBoolean()
    .withMessage('isPostponed must be a boolean')
    .toBoolean(),
];

// PATCH …/reset-status-automation: restore automation (false) or pin the status (true)
const statusAutomationRules = [
  body('statusManuallySet')
    .notEmpty()
    .withMessage('statusManuallySet is required')
    .isBoolean()
    .withMessage('statusManuallySet must be a boolean')
    .toBoolean(),
];

module.exports = { driveRules, postponeRules, statusAutomationRules };
