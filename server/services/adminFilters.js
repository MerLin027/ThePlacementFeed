const mongoose = require('mongoose');
const Application = require('../models/Application');
const { REQUIRED_PROFILE_FIELDS } = require('../models/Student');
const { escapeRegex } = require('../utils/escapeRegex');

/**
 * Mongo filters and sorts for the admin Students and Applicants lists, built from query params that
 * middleware/validate.js has already checked. Multi-value params arrive comma-joined
 * ("status=Applied,Offered"); sanitizeRequest rejects bracketed or repeated keys.
 */

const NONE = '__none'; // "not set" option for branch / institute
const list = (value) => (value ? String(value).split(',').filter(Boolean) : []);
const ids = (value) => list(value).map((id) => new mongoose.Types.ObjectId(id));

// Whole IST days: from the start of `from` to the end of `to`
const istDayStart = (day) => new Date(`${day}T00:00:00+05:30`);
const istDayEnd = (day) => new Date(istDayStart(day).getTime() + 24 * 60 * 60 * 1000);

const range = (min, max) => {
  const r = {};
  if (min !== undefined) r.$gte = min;
  if (max !== undefined) r.$lte = max;
  return Object.keys(r).length > 0 ? r : undefined;
};

// --- Students ---

// "Empty" per required field: text fields can also hold '' (numbers and ids can't, and '' wouldn't cast)
const TEXT_FIELDS = new Set(['firstName', 'lastName', 'branch', 'phone', 'resumeUrl']);
const emptyValues = (f) => (TEXT_FIELDS.has(f) ? [null, ''] : [null]);
const isComplete = () => ({ $and: REQUIRED_PROFILE_FIELDS.map((f) => ({ [f]: { $nin: emptyValues(f) } })) });
const isIncomplete = () => ({ $or: REQUIRED_PROFILE_FIELDS.map((f) => ({ [f]: { $in: emptyValues(f) } })) });

const buildStudentFilter = async (q) => {
  const and = [];

  if (q.search) {
    const regex = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ email: regex }, { rollNumber: regex }, { firstName: regex }, { lastName: regex }] });
  }
  if (q.branch) and.push({ branch: q.branch === NONE ? { $in: [null, ''] } : q.branch });
  if (q.institute) and.push({ instituteId: q.institute === NONE ? null : new mongoose.Types.ObjectId(q.institute) });
  if (q.gradYear) and.push({ graduationYear: { $in: list(q.gradYear).map(Number) } });

  const cgpa = range(q.cgpaMin, q.cgpaMax);
  if (cgpa) and.push({ cgpa });
  if (q.backlogsMax !== undefined) and.push({ activeBacklogs: { $lte: q.backlogsMax } });

  if (q.profile === 'complete') and.push(isComplete());
  else if (q.profile === 'incomplete') and.push(isIncomplete());
  else if (q.profile === 'no_institute') and.push({ instituteId: null });

  if (q.account === 'reset_pending') and.push({ mustChangePassword: true });

  if (q.applications) {
    // A bounded id list: one entry per student who applied (or was selected) at least once
    const match = q.applications === 'selected' ? { status: 'Offered' } : {};
    const applied = await Application.distinct('studentId', match);
    and.push({ _id: q.applications === 'never' ? { $nin: applied } : { $in: applied } });
  }

  return and.length > 0 ? { $and: and } : {};
};

const STUDENT_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { firstName: 1, lastName: 1, createdAt: -1 },
  roll: { rollNumber: 1 },
  grad_asc: { graduationYear: 1, rollNumber: 1 },
  grad_desc: { graduationYear: -1, rollNumber: 1 },
  branch: { branch: 1, rollNumber: 1 },
  cgpa_desc: { cgpa: -1, rollNumber: 1 },
  cgpa_asc: { cgpa: 1, rollNumber: 1 },
};

// --- Applicants (one drive) ---

const buildApplicantFilter = (driveId, q) => {
  const filter = { driveId: new mongoose.Types.ObjectId(driveId) };
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

  // Kept records of deleted accounts: flagged, or (before the flag existed) recognised by the scrub
  const deleted = { $or: [{ studentDeleted: true }, { 'snapshot.firstName': 'Deleted', 'snapshot.lastName': 'User', 'snapshot.email': '' }] };
  const and = [];
  if (q.account === 'deleted') and.push(deleted);
  else if (q.account === 'active') and.push({ $nor: [deleted] });

  if (q.search) {
    const regex = new RegExp(escapeRegex(q.search), 'i');
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

const PIPELINE_RANK = { Applied: 1, Shortlisted: 2, Interviewing: 3, Offered: 4, Rejected: 5 };

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

module.exports = {
  NONE,
  STUDENT_SORTS,
  APPLICANT_SORTS,
  buildStudentFilter,
  buildApplicantFilter,
  applicantQuery,
  istDayStart,
};
