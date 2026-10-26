// Staff permissions, mirroring the server (server/src/features/auth/permissions.js). The server checks
// every request; the website uses these only to show what an account can use.
export const PERMISSIONS = {
  DRIVES: 'drives:manage',
  APPLICANTS: 'applicants:manage',
  STUDENTS: 'students:manage',
  INSIGHTS: 'insights:view',
  SETUP: 'setup:manage',
  STAFF: 'staff:manage',
};
