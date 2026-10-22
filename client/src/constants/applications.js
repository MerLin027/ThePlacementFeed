// Admin-managed pipeline — mirrors APPLICATION_STATUSES in server/models/Application.js
export const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offered', 'Rejected'];

export const APPLICANT_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'cgpa_desc', label: 'CGPA: high to low' },
  { value: 'cgpa_asc', label: 'CGPA: low to high' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'roll', label: 'Roll number' },
];
