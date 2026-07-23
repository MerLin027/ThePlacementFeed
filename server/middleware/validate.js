const { body, validationResult } = require('express-validator');

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
    .isArray()
    .withMessage('Branches must be an array'),

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
    .isLength({ max: 50000 })
    .withMessage('JD description cannot exceed 50000 characters'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('formUrl')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('formUrl must be a valid URL string'),

  body('selectionRounds')
    .optional()
    .isArray()
    .withMessage('selectionRounds must be an array'),

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

module.exports = { placementValidationRules, validate };
