const Application = require('../../models/Application');
const { REQUIRED_PROFILE_FIELDS } = require('../../models/Student');
const { NONE, list, objectId, range } = require('../../lib/filters');
const { containsRegex } = require('../../lib/regex');
const { istDayStart, istDayEnd } = require('../../lib/time');

/**
 * Mongo filters and sorts for the admin Students list, built from query params that
 * validators.js has already checked.
 */

// "Empty" per required field: text fields can also hold '' (numbers and ids can't, and '' wouldn't cast)
const TEXT_FIELDS = new Set(['firstName', 'lastName', 'branch', 'phone', 'resumeUrl']);
const emptyValues = (f) => (TEXT_FIELDS.has(f) ? [null, ''] : [null]);
const completeProfileFilter = () => ({ $and: REQUIRED_PROFILE_FIELDS.map((f) => ({ [f]: { $nin: emptyValues(f) } })) });
const incompleteProfileFilter = () => ({ $or: REQUIRED_PROFILE_FIELDS.map((f) => ({ [f]: { $in: emptyValues(f) } })) });

const buildStudentFilter = async (q) => {
  const and = [];

  if (q.search) {
    const regex = containsRegex(q.search);
    and.push({ $or: [{ email: regex }, { rollNumber: regex }, { firstName: regex }, { lastName: regex }] });
  }
  if (q.branch) and.push({ branch: q.branch === NONE ? { $in: [null, ''] } : q.branch });
  if (q.institute) and.push({ instituteId: q.institute === NONE ? null : objectId(q.institute) });
  if (q.gradYear) and.push({ graduationYear: { $in: list(q.gradYear).map(Number) } });

  const cgpa = range(q.cgpaMin, q.cgpaMax);
  if (cgpa) and.push({ cgpa });
  if (q.backlogsMax !== undefined) and.push({ activeBacklogs: { $lte: q.backlogsMax } });

  if (q.profile === 'complete') and.push(completeProfileFilter());
  else if (q.profile === 'incomplete') and.push(incompleteProfileFilter());
  else if (q.profile === 'no_institute') and.push({ instituteId: null });

  if (q.account === 'reset_pending') and.push({ mustChangePassword: true });

  if (q.joinedFrom || q.joinedTo) {
    const createdAt = {};
    if (q.joinedFrom) createdAt.$gte = istDayStart(q.joinedFrom);
    if (q.joinedTo) createdAt.$lt = istDayEnd(q.joinedTo);
    and.push({ createdAt });
  }

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

module.exports = { STUDENT_SORTS, buildStudentFilter, completeProfileFilter };
