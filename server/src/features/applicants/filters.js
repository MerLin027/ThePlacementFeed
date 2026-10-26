const Application = require('../../models/Application');
const { APPLICATION_STATUSES } = require('../../models/Application');
const { NONE, list, objectId, range } = require('../../lib/filters');
const { containsRegex } = require('../../lib/regex');
const { istDayStart, istDayEnd } = require('../../lib/time');

/**
 * Mongo filters and sorts for one drive's applicants (the list and the export), built from query
 * params that validators.js has already checked.
 */

// Kept records of deleted accounts: flagged, or (before the flag existed) recognised by the scrub
const DELETED_STUDENT = {
  $or: [{ studentDeleted: true }, { 'snapshot.firstName': 'Deleted', 'snapshot.lastName': 'User', 'snapshot.email': '' }],
};

// promptCount: the drive's number of custom questions (for "answered every question")
const buildApplicantFilter = (driveId, q, { promptCount = 0 } = {}) => {
  const filter = { driveId: objectId(driveId) };
  const statuses = list(q.status);
  if (statuses.length === 1) filter.status = statuses[0];
  else if (statuses.length > 1) filter.status = { $in: statuses };
  if (q.branch) filter['snapshot.branch'] = q.branch;
  if (q.institute) filter['snapshot.institute'] = q.institute === NONE ? { $in: [null, ''] } : q.institute;
  if (q.gradYear) filter['snapshot.graduationYear'] = { $in: list(q.gradYear).map(Number) };

  const cgpa = range(q.cgpaMin, q.cgpaMax);
  if (cgpa) filter['snapshot.cgpa'] = cgpa;
  if (q.backlogsMax !== undefined) filter['snapshot.activeBacklogs'] = { $lte: q.backlogsMax };

  if (q.appliedFrom || q.appliedTo) {
    filter.createdAt = {};
    if (q.appliedFrom) filter.createdAt.$gte = istDayStart(q.appliedFrom);
    if (q.appliedTo) filter.createdAt.$lt = istDayEnd(q.appliedTo);
  }

  const and = [];
  if (q.account === 'deleted') and.push(DELETED_STUDENT);
  else if (q.account === 'active') and.push({ $nor: [DELETED_STUDENT] });

  // Answers are stored only when given, so "answered everything" = as many answers as questions
  if (q.answers === 'note') and.push({ coverNote: { $exists: true, $nin: [null, ''] } });
  else if (q.answers === 'all_questions') {
    and.push(promptCount > 0 ? { $expr: { $eq: [{ $size: { $ifNull: ['$customAnswers', []] } }, promptCount] } } : { _id: null });
  }

  if (q.search) {
    const regex = containsRegex(q.search);
    and.push({ $or: [{ 'snapshot.firstName': regex }, { 'snapshot.lastName': regex }, { 'snapshot.email': regex }, { 'snapshot.rollNumber': regex }] });
  }
  if (and.length > 0) filter.$and = and;
  return filter;
};

const APPLICANT_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  cgpa_desc: { 'snapshot.cgpa': -1, createdAt: -1 },
  cgpa_asc: { 'snapshot.cgpa': 1, createdAt: -1 },
  name: { 'snapshot.firstName': 1, 'snapshot.lastName': 1 },
  roll: { 'snapshot.rollNumber': 1 },
  branch: { 'snapshot.branch': 1, 'snapshot.rollNumber': 1 },
  grad_asc: { 'snapshot.graduationYear': 1, 'snapshot.rollNumber': 1 },
  grad_desc: { 'snapshot.graduationYear': -1, 'snapshot.rollNumber': 1 },
  updated: { updatedAt: -1 },
  // Pipeline order (Applied → Offered, Rejected last); needs an aggregation
  status: null,
};

const PIPELINE_RANK = Object.fromEntries(APPLICATION_STATUSES.map((s, i) => [s, i + 1]));

/**
 * The query for one page of applicants (or the export when limit is the export cap). Returns
 * something with .lean()-like plain documents: a Mongoose query for plain sorts, an aggregation for
 * the pipeline-order sort. Both support .cursor() for the streamed export.
 */
const applicantQuery = (filter, sortKey, { skip = 0, limit }) => {
  if (sortKey === 'status') {
    const stages = [
      { $match: filter },
      {
        $addFields: {
          _rank: { $switch: { branches: Object.entries(PIPELINE_RANK).map(([s, n]) => ({ case: { $eq: ['$status', s] }, then: n })), default: 9 } },
        },
      },
      { $sort: { _rank: 1, createdAt: -1, _id: 1 } },
      { $skip: skip },
      ...(limit ? [{ $limit: limit }] : []),
      { $project: { _rank: 0 } },
    ];
    return Application.aggregate(stages);
  }
  const query = Application.find(filter).sort(APPLICANT_SORTS[sortKey] || APPLICANT_SORTS.newest).skip(skip);
  return (limit ? query.limit(limit) : query).lean();
};

module.exports = { APPLICANT_SORTS, buildApplicantFilter, applicantQuery };
