// Canonical branch list — mirrored in client/src/constants/branches.js.
// Student.branch and Placement.eligibility.branches are matched against each other,
// so both sides must draw from the same values.
const BRANCHES = [
  'CE', 'IT', 'CS', 'EC', 'EE', 'ME', 'CL', 'IC', 'BME', 'AI/ML', 'CSE', 'Other',
];

// Full names for display (e.g. the applicant export) — mirrors client BRANCH_LABELS
const BRANCH_LABELS = {
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

const branchLabel = (code) => BRANCH_LABELS[code] || code || '';

module.exports = { BRANCHES, BRANCH_LABELS, branchLabel };
