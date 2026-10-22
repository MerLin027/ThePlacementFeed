// Canonical branch codes — mirrored in server/constants/branches.js.
// Student branches and drive eligibility branches are stored and matched as these
// codes; the UI always shows the full name from BRANCH_LABELS instead.
export const BRANCHES = [
  'CE', 'IT', 'CS', 'EC', 'EE', 'ME', 'CL', 'IC', 'BME', 'AI/ML', 'CSE', 'Other',
];

export const BRANCH_LABELS = {
  CE: 'Computer Engineering',
  IT: 'Information Technology',
  CS: 'Computer Science',
  EC: 'Electronics & Communication Engineering',
  EE: 'Electrical Engineering',
  ME: 'Mechanical Engineering',
  CL: 'Civil Engineering',
  IC: 'Instrumentation & Control Engineering',
  BME: 'Biomedical Engineering',
  'AI/ML': 'Artificial Intelligence & Machine Learning',
  CSE: 'Computer Science & Engineering',
  Other: 'Other',
};

// Full name for a stored branch code; unknown values (e.g. older data) are shown as-is
export const branchLabel = (code) => BRANCH_LABELS[code] || code;

export const formatBranches = (codes = []) => codes.map(branchLabel).join(', ');
