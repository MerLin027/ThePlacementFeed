const { body, query, param, validationResult } = require('express-validator');
const { isHttpsUrl } = require('../lib/urls');

/**
 * The validation runner and the rule helpers every feature's validators.js builds on. Each
 * feature keeps its own rules next to its routes; anything two features share lives here.
 */

// Runs after a list of rules: 400 with { field, message } per problem
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

// An optional https:// link, trimmed and capped ('' clears it)
const optionalHttpsLink = (field, label) =>
  body(field)
    .optional()
    .isString()
    .withMessage(`${label} must be text`)
    .trim()
    .isLength({ max: 500 })
    .withMessage(`${label} cannot exceed 500 characters`)
    .custom((value) => value === '' || isHttpsUrl(value))
    .withMessage(`${label} must be a valid https:// URL`);

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

// Academic filters both admin lists share (students, one drive's applicants)
const academicFilterRules = [
  commaList('gradYear', isYear, 'gradYear must be years from 2020 to 2040'),
  query('cgpaMin').optional().isFloat({ min: 0, max: 10 }).withMessage('cgpaMin must be between 0 and 10').toFloat(),
  query('cgpaMax').optional().isFloat({ min: 0, max: 10 }).withMessage('cgpaMax must be between 0 and 10').toFloat(),
  query('backlogsMax').optional().isInt({ min: 0, max: 50 }).withMessage('backlogsMax must be a whole number from 0 to 50').toInt(),
];

// ?page & ?limit for admin lists
const paginationRules = [
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
];

// A search box: trimmed, at most 100 characters
const searchRule = query('search')
  .optional()
  .isString()
  .withMessage('search must be text')
  .trim()
  .isLength({ max: 100 })
  .withMessage('search cannot exceed 100 characters');

const mongoIdParam = (name) => [param(name).isMongoId().withMessage('Invalid ID')];

const sortRule = (sorts) =>
  query('sort').optional().isIn(Object.keys(sorts)).withMessage(`sort must be one of: ${Object.keys(sorts).join(', ')}`);

module.exports = {
  validate,
  optionalHttpsLink,
  commaList,
  isYear,
  isDay,
  academicFilterRules,
  paginationRules,
  searchRule,
  mongoIdParam,
  sortRule,
};
