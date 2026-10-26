const { STAFF_ROLES } = require('../../models/Admin');

/**
 * What each staff role may do. The server checks these (guards.js: requirePermission) on every
 * request; the website only mirrors them to hide what a role can't use.
 */
const PERMISSIONS = {
  DRIVES: 'drives:manage', // create, edit, postpone, delete drives
  APPLICANTS: 'applicants:manage', // view, update, export, delete applications
  STUDENTS: 'students:manage', // list accounts, reset password/institute, delete
  INSIGHTS: 'insights:view', // dashboard numbers
  SETUP: 'setup:manage', // branches, institutes, the university name
  STAFF: 'staff:manage', // create, disable, reset and change the role of staff accounts
};

const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: [PERMISSIONS.DRIVES, PERMISSIONS.APPLICANTS, PERMISSIONS.STUDENTS, PERMISSIONS.INSIGHTS],
};

const permissionsFor = (role) => ROLE_PERMISSIONS[role] || [];

const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Admin' };

module.exports = { PERMISSIONS, STAFF_ROLES, ROLE_PERMISSIONS, ROLE_LABELS, permissionsFor };
