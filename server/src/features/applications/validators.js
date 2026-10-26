const { body, query } = require('express-validator');
const { optionalHttpsLink } = require('../../middleware/validate');
const { MAX_CUSTOM_PROMPTS } = require('../../models/Placement');

// A student's in-app application. status, studentId and the profile snapshot are never read from
// the body: the server builds them.
const applicationSubmitRules = [
  body('driveId')
    .isMongoId()
    .withMessage('Invalid drive'),

  optionalHttpsLink('resumeUrl', 'Resume link'),

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
    .isArray({ max: MAX_CUSTOM_PROMPTS })
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

// Tabs on the My Applications page
const STATUS_GROUPS = {
  active: ['Applied', 'Shortlisted', 'Interviewing'],
  selected: ['Offered'],
  closed: ['Rejected'],
};

const myApplicationsRules = [
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').toInt(),
  query('group').optional().isIn(Object.keys(STATUS_GROUPS)).withMessage('group must be active, selected or closed'),
];

module.exports = { applicationSubmitRules, myApplicationsRules, STATUS_GROUPS };
