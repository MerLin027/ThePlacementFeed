const mongoose = require('mongoose');

/**
 * Helpers for the admin list filters (features/students/filters.js, features/applicants/filters.js).
 * Query params arrive already validated; multi-value params are comma-joined ("Applied,Offered").
 */

// The "not set" option for branch / institute filters
const NONE = '__none';

const list = (value) => (value ? String(value).split(',').filter(Boolean) : []);
const objectId = (id) => new mongoose.Types.ObjectId(id);

// { $gte, $lte } from optional bounds, or undefined when neither is given
const range = (min, max) => {
  const r = {};
  if (min !== undefined) r.$gte = min;
  if (max !== undefined) r.$lte = max;
  return Object.keys(r).length > 0 ? r : undefined;
};

module.exports = { NONE, list, objectId, range };
