// Admin-managed pipeline — mirrors APPLICATION_STATUSES in server/models/Application.js
export const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offered', 'Rejected'];

// What the UI calls each status. "Offered" is shown as "Selected"; the stored value stays "Offered"
// (renaming it would need a data migration and would look like a status change to students).
export const APPLICATION_STATUS_LABELS = { Offered: 'Selected' };
export const statusLabel = (status) => APPLICATION_STATUS_LABELS[status] || status;

export const APPLICANT_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'Status (pipeline order)' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'cgpa_desc', label: 'CGPA: high to low' },
  { value: 'cgpa_asc', label: 'CGPA: low to high' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'roll', label: 'Roll number' },
  { value: 'branch', label: 'Branch' },
  { value: 'grad_asc', label: 'Graduation year (earliest)' },
  { value: 'grad_desc', label: 'Graduation year (latest)' },
];

export const STUDENT_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'roll', label: 'Roll number' },
  { value: 'branch', label: 'Branch' },
  { value: 'grad_asc', label: 'Graduation year (earliest)' },
  { value: 'grad_desc', label: 'Graduation year (latest)' },
  { value: 'cgpa_desc', label: 'CGPA: high to low' },
  { value: 'cgpa_asc', label: 'CGPA: low to high' },
];
