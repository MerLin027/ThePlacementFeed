// Password rules per kind of account, mirroring the server (server/src/features/auth/passwordPolicy.js
// and constants.js). The server decides; these let the website say the rules up front.
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULES = {
  student: { min: 8, own: 'email name or roll number' },
  // Staff accounts can see every student's details: a longer minimum. Only the super admin has a
  // username; admins sign in with their email.
  staff: { min: 12, own: 'email name or username' },
  admin: { min: 12, own: 'email name' },
};

export const passwordRulesFor = (kind) => PASSWORD_RULES[kind] || PASSWORD_RULES.student;

// One line, for whoever hands over a one-time password: what the new password will have to be
export const passwordRuleSummary = (kind) => {
  const { min, own } = passwordRulesFor(kind);
  return `${min}–${PASSWORD_MAX_LENGTH} characters, not a common password, and without their ${own}`;
};
