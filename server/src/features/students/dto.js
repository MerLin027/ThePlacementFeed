const catalog = require('../catalog/cache');
const { REQUIRED_PROFILE_FIELDS, missingProfileFields } = require('../../models/Student');

// The profile as the student themself sees it — never auth internals (hash, token version)
const toProfileDTO = (student) => ({
  id: student._id.toString(),
  email: student.email,
  rollNumber: student.rollNumber,
  university: catalog.getUniversity(),
  institute: catalog.instituteRef(student.instituteId),
  instituteLocked: Boolean(student.instituteId),
  firstName: student.firstName ?? '',
  lastName: student.lastName ?? '',
  branch: student.branch ?? '',
  cgpa: student.cgpa ?? null,
  activeBacklogs: student.activeBacklogs ?? 0,
  graduationYear: student.graduationYear ?? null,
  phone: student.phone ?? '',
  resumeUrl: student.resumeUrl ?? '',
  missingFields: missingProfileFields(student),
  mustChangePassword: student.mustChangePassword,
});

// A row in the admin Students list: only what identifies the account. Phone, CGPA and resume are
// read only to tell whether the profile is complete, never returned.
const toAdminStudentDTO = (s, counts) => ({
  id: s._id.toString(),
  email: s.email,
  rollNumber: s.rollNumber,
  institute: catalog.instituteRef(s.instituteId),
  firstName: s.firstName ?? '',
  lastName: s.lastName ?? '',
  branch: s.branch ?? '',
  graduationYear: s.graduationYear ?? null,
  createdAt: s.createdAt,
  mustChangePassword: Boolean(s.mustChangePassword),
  profileComplete: missingProfileFields(s).length === 0,
  ...(counts && { applications: counts.applications, selected: counts.selected }),
});

// The fields the admin list reads (the required ones only to compute profileComplete)
const ADMIN_LIST_SELECT = `email rollNumber firstName lastName createdAt mustChangePassword ${REQUIRED_PROFILE_FIELDS.join(' ')}`;

module.exports = { toProfileDTO, toAdminStudentDTO, ADMIN_LIST_SELECT };
