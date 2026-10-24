// The original branch list, used only until GET /api/catalog loads (stores/catalog.js). Branches
// are managed by the admin now; codes are what's stored and matched, names are what's shown.
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
