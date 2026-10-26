const { body, query } = require('express-validator');
const catalog = require('../catalog/cache');
const { APPLICATION_STATUSES } = require('../../models/Application');
const {
  commaList,
  isDay,
  academicFilterRules,
  paginationRules,
  searchRule,
  sortRule,
} = require('../../middleware/validate');
const { APPLICANT_SORTS } = require('./filters');

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
  searchRule,
  sortRule(APPLICANT_SORTS),
];

const applicantListRules = [...applicantFilterRules, ...paginationRules];

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

const selectedApplicantsRule = [
  body('applicationIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Select between 1 and 100 applicants'),
  body('applicationIds.*').isMongoId().withMessage('Invalid applicant'),
];

const applicantBulkStatusRules = [
  ...selectedApplicantsRule,
  body('status').isIn(APPLICATION_STATUSES).withMessage('Unknown status'),
];

const applicantBulkDeleteRules = selectedApplicantsRule;

module.exports = {
  applicantFilterRules,
  applicantListRules,
  applicantUpdateRules,
  applicantBulkStatusRules,
  applicantBulkDeleteRules,
};
