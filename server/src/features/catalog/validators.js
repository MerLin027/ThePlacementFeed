const { body, query } = require('express-validator');
const { BRANCH_CODE_PATTERN } = require('../../models/Branch');

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

module.exports = { branchCreateRules, catalogUpdateRules, instituteCreateRules, universityRules, catalogDeleteRules };
