const Admin = require('../../models/Admin');
const Student = require('../../models/Student');
const { missingProfileFields } = require('../../models/Student');
const { permissionsFor, ROLE_LABELS } = require('./permissions');

/**
 * Accounts across both collections: students and admins sign in with their email, the super admin
 * with its username or email. An email belongs to one account only (checked when either kind is
 * created, and a sign-in that matches both is refused).
 */

const isEmail = (identifier) => identifier.includes('@');

// Every account an identifier could name, with password hashes (for sign-in only)
const findByIdentifier = async (identifier) => {
  const email = isEmail(identifier);
  const [staff, student] = await Promise.all([
    Admin.findOne(email ? { email: identifier } : { username: identifier }).select('+passwordHash'),
    email ? Student.findOne({ email: identifier }).select('+passwordHash') : null,
  ]);
  return { staff, student };
};

// Is this email already used by an account (other than `except`, { type, id })?
const emailInUse = async (email, except) => {
  const [staff, student] = await Promise.all([
    Admin.exists({ email, ...(except?.type === 'staff' && { _id: { $ne: except.id } }) }),
    Student.exists({ email, ...(except?.type === 'student' && { _id: { $ne: except.id } }) }),
  ]);
  return Boolean(staff || student);
};

// What the website needs to know about the signed-in account (GET /api/auth/session, login)
const describeAccount = (type, doc) => {
  if (type === 'student') {
    return {
      type: 'student',
      id: doc._id.toString(),
      email: doc.email,
      firstName: doc.firstName ?? '',
      lastName: doc.lastName ?? '',
      // Academic fields let the UI pre-check drive eligibility (the server re-checks on apply)
      branch: doc.branch ?? '',
      cgpa: doc.cgpa ?? null,
      activeBacklogs: doc.activeBacklogs ?? 0,
      missingFields: missingProfileFields(doc),
      mustChangePassword: Boolean(doc.mustChangePassword),
    };
  }
  return {
    type: 'staff',
    id: doc._id.toString(),
    // The super admin's; admins sign in with their email
    username: doc.username || '',
    name: doc.name || '',
    email: doc.email || '',
    role: doc.role,
    roleLabel: ROLE_LABELS[doc.role] || doc.role,
    permissions: permissionsFor(doc.role),
    mustChangePassword: Boolean(doc.mustChangePassword),
  };
};

const loadAccountDoc = (type, id) =>
  type === 'student' ? Student.findById(id) : Admin.findById(id);

const loadAccountDocWithPassword = (type, id) => loadAccountDoc(type, id).select('+passwordHash');

module.exports = { findByIdentifier, emailInUse, describeAccount, loadAccountDoc, loadAccountDocWithPassword };
