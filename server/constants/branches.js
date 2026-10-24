// The original branch list. Branches now live in the database (models/Branch.js, edited by the
// admin); this list seeds it on first boot and is the fallback if it can't be read
// (services/catalog.js).
const BRANCHES = [
  'CE', 'IT', 'CS', 'EC', 'EE', 'ME', 'CL', 'IC', 'BME', 'AI/ML', 'CSE', 'Other',
];

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

module.exports = { BRANCHES, BRANCH_LABELS };
